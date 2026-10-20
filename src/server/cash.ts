import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "./postgres";
import { HttpError } from "./errors";
import { lockBusiness } from "./menu";
import { formatMoney } from "@/lib/menu";
import {
  cashTotals,
  type CashCommand,
  type CashMovement,
  type CashSession,
  type CashState,
  type ClosedSession,
  type UnpaidOrder,
} from "@/lib/cash";

const sessionFields = `id,number,opened_at AS "openedAt",opening_cents AS "openingCents",closed_at AS "closedAt",declared_cents AS "declaredCents",expected_cents AS "expectedCents",note`;
const movementFields = `m.id,m.kind,m.method,m.amount_cents AS "amountCents",m.tendered_cents AS "tenderedCents",m.order_id AS "orderId",o.number AS "orderNumber",o.status AS "orderStatus",m.note,m.created_at AS "createdAt",m.voided_at AS "voidedAt",m.void_reason AS "voidReason"`;
// Orders charged in a shift; older ones from before the business used the
// register are not asked for again.
const UNPAID_WINDOW = "24 hours";
const hashOf = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function openSession(client: PoolClient | ReturnType<typeof getPool>, businessId: string, lock = false) {
  const { rows } = await client.query<CashSession>(
    `SELECT ${sessionFields} FROM cash_sessions WHERE business_id=$1 AND closed_at IS NULL${lock ? " FOR UPDATE" : ""}`,
    [businessId],
  );
  return rows[0] ?? null;
}

async function movementsOf(client: PoolClient | ReturnType<typeof getPool>, businessId: string, sessionId: string) {
  const { rows } = await client.query<CashMovement>(
    `SELECT ${movementFields} FROM cash_movements m LEFT JOIN orders o ON o.business_id=m.business_id AND o.id=m.order_id WHERE m.business_id=$1 AND m.session_id=$2 ORDER BY m.created_at DESC`,
    [businessId, sessionId],
  );
  return rows;
}

/** Charged so far against an order, across every shift, without voided rows. */
async function paidFor(client: PoolClient, businessId: string, orderId: string) {
  const { rows } = await client.query<{ paid: number }>(
    `SELECT COALESCE(sum(amount_cents),0)::int AS paid FROM cash_movements WHERE business_id=$1 AND order_id=$2 AND kind='payment' AND voided_at IS NULL`,
    [businessId, orderId],
  );
  return rows[0].paid;
}

export async function listUnpaid(businessId: string): Promise<UnpaidOrder[]> {
  const { rows } = await getPool().query<UnpaidOrder>(
    `SELECT o.id,o.number,o.customer_name AS "customerName",o.payment_method AS "paymentMethod",o.total_cents AS "totalCents",COALESCE(p.paid,0)::int AS "paidCents",o.created_at AS "createdAt"
     FROM orders o
     LEFT JOIN (SELECT order_id,sum(amount_cents) AS paid FROM cash_movements WHERE business_id=$1 AND kind='payment' AND voided_at IS NULL GROUP BY order_id) p ON p.order_id=o.id
     WHERE o.business_id=$1 AND o.status='accepted' AND o.accepted_at >= now()-interval '${UNPAID_WINDOW}'
       AND o.total_cents > COALESCE(p.paid,0)
     ORDER BY o.accepted_at LIMIT 100`,
    [businessId],
  );
  return rows;
}

async function closedSessions(businessId: string, limit: number): Promise<ClosedSession[]> {
  const { rows } = await getPool().query<CashSession & { movements: CashMovement[] | null }>(
    `SELECT ${sessionFields.split(",").map((f) => "s." + f).join(",")},
       (SELECT json_agg(json_build_object('kind',kind,'method',method,'amountCents',amount_cents,'voidedAt',voided_at)) FROM cash_movements m WHERE m.business_id=s.business_id AND m.session_id=s.id) AS movements
     FROM cash_sessions s WHERE s.business_id=$1 AND s.closed_at IS NOT NULL ORDER BY s.closed_at DESC LIMIT $2`,
    [businessId, limit],
  );
  return rows.map(({ movements, ...s }) => ({
    ...(s as ClosedSession),
    totals: cashTotals(s.openingCents, movements ?? []),
  }));
}

/**
 * What the Caja screen needs. The open shift never carries its expected cash:
 * that is the blind part of the count. Only the owner sees past shifts.
 */
export async function getCashState(businessId: string, owner: boolean): Promise<CashState> {
  const pool = getPool();
  const session = await openSession(pool, businessId);
  const [movements, unpaid, history] = await Promise.all([
    session ? movementsOf(pool, businessId, session.id) : Promise.resolve([]),
    listUnpaid(businessId),
    owner ? closedSessions(businessId, 20) : Promise.resolve(null),
  ]);
  return {
    session: session ? { ...session, movements } : null,
    unpaid,
    history,
  };
}

/** Whether a shift is open, for the orders inbox. */
export async function cashOpen(businessId: string) {
  return Boolean(await openSession(getPool(), businessId));
}

async function transaction<T>(businessId: string, run: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await lockBusiness(client, businessId);
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function summary(client: PoolClient, businessId: string, session: CashSession): Promise<ClosedSession> {
  const movements = await movementsOf(client, businessId, session.id);
  const unpaid = await client.query<{ count: number; cents: number }>(
    `SELECT count(*)::int AS count,COALESCE(sum(o.total_cents-COALESCE(p.paid,0)),0)::int AS cents FROM orders o
     LEFT JOIN (SELECT order_id,sum(amount_cents) AS paid FROM cash_movements WHERE business_id=$1 AND kind='payment' AND voided_at IS NULL GROUP BY order_id) p ON p.order_id=o.id
     WHERE o.business_id=$1 AND o.status='accepted' AND o.accepted_at BETWEEN $2 AND $3 AND o.total_cents > COALESCE(p.paid,0)`,
    [businessId, session.openedAt, session.closedAt],
  );
  return {
    ...(session as ClosedSession),
    totals: cashTotals(session.openingCents, movements),
    unpaid: unpaid.rows[0],
  };
}

export async function runCashCommand(businessId: string, actor: string, command: CashCommand) {
  return transaction(businessId, async (client) => {
    if (command.type === "open") {
      const again = await client.query<CashSession>(
        `SELECT ${sessionFields} FROM cash_sessions WHERE business_id=$1 AND open_request_key=$2`,
        [businessId, command.requestKey],
      );
      if (again.rows[0]) return { session: again.rows[0] };
      if (await openSession(client, businessId))
        throw new HttpError(409, "Ya hay un turno abierto. Actualizá la pantalla.");
      const { rows } = await client.query<CashSession>(
        `INSERT INTO cash_sessions(business_id,number,open_request_key,opening_cents,opened_by)
         VALUES($1,(SELECT COALESCE(max(number),0)+1 FROM cash_sessions WHERE business_id=$1),$2,$3,$4) RETURNING ${sessionFields}`,
        [businessId, command.requestKey, command.openingCents, actor],
      );
      return { session: rows[0] };
    }

    if (command.type === "close") {
      const again = await client.query<CashSession>(
        `SELECT ${sessionFields} FROM cash_sessions WHERE business_id=$1 AND id=$2 FOR UPDATE`,
        [businessId, command.sessionId],
      );
      const current = again.rows[0];
      if (!current) throw new HttpError(404, "No encontramos el turno.");
      if (current.closedAt) {
        const key = await client.query<{ key: string }>(
          `SELECT close_request_key AS key FROM cash_sessions WHERE id=$1`,
          [current.id],
        );
        if (key.rows[0].key !== command.requestKey)
          throw new HttpError(409, "Este turno ya se cerró en otra pantalla.");
        return { closed: await summary(client, businessId, current) };
      }
      const movements = await movementsOf(client, businessId, current.id);
      const expected = cashTotals(current.openingCents, movements).expectedCents;
      const { rows } = await client.query<CashSession>(
        `UPDATE cash_sessions SET closed_at=now(),closed_by=$3,close_request_key=$4,declared_cents=$5,expected_cents=$6,note=$7 WHERE business_id=$1 AND id=$2 RETURNING ${sessionFields}`,
        [businessId, current.id, actor, command.requestKey, command.declaredCents, expected, command.note],
      );
      return { closed: await summary(client, businessId, rows[0]) };
    }

    if (command.type === "void") {
      const { rows } = await client.query<{ sessionId: string; voidedAt: string | null; closedAt: string | null }>(
        `SELECT m.session_id AS "sessionId",m.voided_at AS "voidedAt",s.closed_at AS "closedAt" FROM cash_movements m JOIN cash_sessions s ON s.business_id=m.business_id AND s.id=m.session_id WHERE m.business_id=$1 AND m.id=$2 FOR UPDATE OF m`,
        [businessId, command.movementId],
      );
      const m = rows[0];
      if (!m) throw new HttpError(404, "No encontramos ese movimiento.");
      if (m.closedAt)
        throw new HttpError(409, "Ese turno ya se cerró. Si devolviste plata, registrá un retiro en el turno actual.");
      if (!m.voidedAt)
        await client.query(
          `UPDATE cash_movements SET voided_at=now(),voided_by=$3,void_reason=$4 WHERE business_id=$1 AND id=$2`,
          [businessId, command.movementId, actor, command.reason],
        );
      return { voided: command.movementId };
    }

    // Payments and cash in/out: a retry with the same key returns the same row.
    const hash = hashOf(command);
    const again = await client.query<{ id: string; payloadHash: string }>(
      `SELECT id,payload_hash AS "payloadHash" FROM cash_movements WHERE business_id=$1 AND request_key=$2`,
      [businessId, command.requestKey],
    );
    if (again.rows[0]) {
      if (again.rows[0].payloadHash !== hash)
        throw new HttpError(409, "Este movimiento ya se registró con otros datos. Actualizá la pantalla.");
      return { movementId: again.rows[0].id };
    }
    const session = await openSession(client, businessId, true);
    if (!session)
      throw new HttpError(409, "La caja está cerrada. Abrí un turno en Caja para cobrar.");

    if (command.type === "movement") {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO cash_movements(business_id,session_id,request_key,payload_hash,kind,method,amount_cents,note,created_by) VALUES($1,$2,$3,$4,$5,'cash',$6,$7,$8) RETURNING id`,
        [businessId, session.id, command.requestKey, hash, command.kind, command.amountCents, command.note, actor],
      );
      return { movementId: rows[0].id };
    }

    const order = await client.query<{ number: number; status: string; totalCents: number }>(
      `SELECT number,status,total_cents AS "totalCents" FROM orders WHERE business_id=$1 AND id=$2 FOR UPDATE`,
      [businessId, command.orderId],
    );
    const o = order.rows[0];
    if (!o) throw new HttpError(404, "No encontramos el pedido.");
    if (o.status === "pending_confirmation")
      throw new HttpError(409, "Aceptá el pedido antes de cobrarlo.");
    if (o.status !== "accepted")
      throw new HttpError(409, "Ese pedido está rechazado o anulado; no se puede cobrar.");
    const left = o.totalCents - (await paidFor(client, businessId, command.orderId));
    if (left <= 0) throw new HttpError(409, `El pedido #${o.number} ya está cobrado.`);
    if (command.amountCents > left)
      throw new HttpError(409, `Al pedido #${o.number} le falta cobrar ${formatMoney(left)}; no se puede cobrar más que eso.`);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO cash_movements(business_id,session_id,request_key,payload_hash,kind,method,order_id,amount_cents,tendered_cents,created_by) VALUES($1,$2,$3,$4,'payment',$5,$6,$7,$8,$9) RETURNING id`,
      [businessId, session.id, command.requestKey, hash, command.method, command.orderId, command.amountCents, command.tenderedCents, actor],
    );
    return { movementId: rows[0].id, leftCents: left - command.amountCents };
  });
}

export async function businessTimezone(businessId: string) {
  const { rows } = await getPool().query<{ timezone: string }>(
    "SELECT timezone FROM businesses WHERE id=$1",
    [businessId],
  );
  return rows[0]?.timezone ?? "America/Argentina/Buenos_Aires";
}
