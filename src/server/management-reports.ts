import "server-only";
import { z } from "zod";
import { getPool } from "./postgres";
import { managementContext } from "./management";
import { HttpError } from "./errors";
import { operationalDate, rounded, shiftDate } from "@/lib/management-math";
import type { Report, Totals, HistoricalOrder } from "@/lib/management";

export function reportRange(
  from: string | undefined,
  to: string | undefined,
  today: string,
) {
  const start = from ?? `${today.slice(0, 7)}-01`,
    end = to ?? today;
  if (
    !z.iso.date().safeParse(start).success ||
    !z.iso.date().safeParse(end).success ||
    start > end
  )
    throw new HttpError(
      422,
      "Revisá las fechas: el inicio debe ser anterior al final.",
    );
  const days =
    Math.round(
      (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
        86_400_000,
    ) + 1;
  if (days > 366)
    throw new HttpError(422, "Elegí un período de hasta 366 días.");
  return {
    from: start,
    to: end,
    previousFrom: shiftDate(start, -days),
    previousTo: shiftDate(start, -1),
    days,
  };
}

// Aggregate in Postgres over the full period, independently of paged UI lists.
const events = `WITH sale_events AS (
  SELECT s.*,s.operational_date AS day,1 AS sign FROM management_sales s WHERE business_id=$1
  UNION ALL
  SELECT s.*,o.operational_date AS day,-1 AS sign FROM management_sales s JOIN management_operations o ON o.business_id=s.business_id AND o.id=s.cancellation_id WHERE s.business_id=$1
), legacy AS (
  SELECT o.*,c.result->>'costCents' AS historical_cost,to_char((COALESCE(accepted_at,created_at) AT TIME ZONE $4)-make_interval(hours => $5),'YYYY-MM-DD') AS day FROM orders o LEFT JOIN LATERAL(SELECT result FROM management_operations WHERE business_id=o.business_id AND type='historical_cost' AND result->>'orderId'=o.id::text ORDER BY created_at,id LIMIT 1) c ON true WHERE o.business_id=$1 AND o.status='accepted' AND NOT EXISTS(SELECT 1 FROM management_sales s WHERE s.business_id=o.business_id AND s.order_id=o.id)
), facts AS (
  SELECT day,total_cents*sign AS revenue,delivery_cents*sign AS delivery,known_cost_cents*sign AS cost,0::numeric AS expense,0::numeric AS waste,CASE WHEN sign=1 THEN 1 ELSE 0 END AS sales,CASE WHEN sign=-1 THEN 1 ELSE 0 END AS cancellations,CASE WHEN sign=1 AND cost_complete THEN 1 ELSE 0 END AS complete,CASE WHEN sign=1 AND NOT cost_complete THEN 1 ELSE 0 END AS incomplete,CASE WHEN NOT cost_complete THEN 1 ELSE 0 END AS unknown,0 AS legacy,0 AS unknown_waste,0 AS estimated FROM sale_events
  UNION ALL SELECT day,total_cents,delivery_cents,COALESCE(historical_cost::numeric,0),0,0,1,0,CASE WHEN historical_cost IS NOT NULL THEN 1 ELSE 0 END,CASE WHEN historical_cost IS NULL THEN 1 ELSE 0 END,CASE WHEN historical_cost IS NULL THEN 1 ELSE 0 END,1,0,CASE WHEN historical_cost IS NOT NULL THEN 1 ELSE 0 END FROM legacy
  UNION ALL SELECT date,0,0,0,amount_cents,0,0,0,0,0,0,0,0,0 FROM management_expenses WHERE business_id=$1
  UNION ALL SELECT o.operational_date,0,0,0,-e.amount_cents,0,0,0,0,0,0,0,0,0 FROM management_expenses e JOIN management_operations o ON o.business_id=e.business_id AND o.id=e.reversal_id WHERE e.business_id=$1
  UNION ALL SELECT o.operational_date,0,0,0,0,COALESCE(m.cost_cents,0),0,0,0,0,CASE WHEN m.cost_cents IS NULL THEN 1 ELSE 0 END,0,CASE WHEN m.cost_cents IS NULL THEN 1 ELSE 0 END,0 FROM inventory_movements m JOIN management_operations o ON o.business_id=m.business_id AND o.id=m.operation_id WHERE m.business_id=$1 AND m.kind='waste'
  UNION ALL SELECT operational_date,0,0,0,0,0,0,0,0,0,1,0,1,0 FROM management_operations WHERE business_id=$1 AND type='cancel_sale' AND result->>'incompleteWaste'='true'
)`;
type Day = {
  date: string;
  revenue: string;
  delivery: string;
  cost: string;
  expenses: string;
  waste: string;
  saleCount: string;
  cancelledCount: string;
  completeCount: string;
  incompleteCount: string;
  unknown: string;
  unknownWaste: string;
  legacy: string;
  estimated: string;
};
function totals(days: Day[]): Totals {
  const sum = (key: keyof Day) => days.reduce((n, d) => n + BigInt(d[key]), 0n);
  const revenue = sum("revenue"),
    cost = sum("cost"),
    expense = sum("expenses"),
    waste = sum("waste");
  const netCount = sum("saleCount") - sum("cancelledCount"),
    unknown = sum("unknown") > 0n;
  return {
    revenue: revenue.toString(),
    delivery: sum("delivery").toString(),
    cost: cost.toString(),
    expenses: expense.toString(),
    waste: waste.toString(),
    saleCount: Number(sum("saleCount")),
    cancelledCount: Number(sum("cancelledCount")),
    completeCount: Number(sum("completeCount")),
    incompleteCount: Number(sum("incompleteCount")),
    costsIncomplete: sum("unknown") > sum("unknownWaste"),
    wasteIncomplete: sum("unknownWaste") > 0n,
    grossMargin:
      sum("unknown") > sum("unknownWaste") ? null : (revenue - cost).toString(),
    result: unknown ? null : (revenue - cost - expense - waste).toString(),
    ticket:
      netCount > 0n && revenue >= 0n
        ? rounded(revenue, netCount).toString()
        : null,
  };
}
export async function getManagementReport(
  businessId: string,
  from?: string,
  to?: string,
): Promise<Report> {
  const pool = getPool(),
    context = await managementContext(pool, businessId);
  const today = operationalDate(
    new Date(),
    context.timezone,
    context.cutoffHour,
  );
  const range = reportRange(from, to, today);
  const params = [
    businessId,
    range.previousFrom,
    range.to,
    context.timezone,
    context.cutoffHour,
  ];
  const [daily, products, channel, historicalOrders] = await Promise.all([
    pool.query<Day>(
      `${events} SELECT day AS date,sum(revenue)::text AS revenue,sum(delivery)::text AS delivery,sum(cost)::text AS cost,sum(expense)::text AS expenses,sum(waste)::text AS waste,sum(sales)::text AS "saleCount",sum(cancellations)::text AS "cancelledCount",sum(complete)::text AS "completeCount",sum(incomplete)::text AS "incompleteCount",sum(unknown)::text AS unknown,sum(unknown_waste)::text AS "unknownWaste",sum(legacy)::text AS legacy,sum(estimated)::text AS estimated FROM facts WHERE day BETWEEN $2 AND $3 GROUP BY day ORDER BY day`,
      params,
    ),
    pool.query<{ name: string; quantity: string; revenue: string }>(
      `${events} , product_events AS (
      SELECT (line->>'name') || ' · ' || (line->>'variant') AS name,(line->>'quantity')::numeric*sign AS quantity,(line->>'lineCents')::numeric*sign AS revenue,day FROM sale_events CROSS JOIN LATERAL jsonb_array_elements(lines) line
      UNION ALL SELECT (line->>'name') || ' · ' || (line->>'variant'),(line->>'quantity')::numeric,(line->>'lineCents')::numeric,day FROM legacy CROSS JOIN LATERAL jsonb_array_elements(items) line
    ) SELECT name,sum(quantity)::text AS quantity,sum(revenue)::text AS revenue FROM product_events WHERE day BETWEEN $2 AND $3 GROUP BY name ORDER BY sum(quantity) DESC,name LIMIT 12`,
      [businessId, range.from, range.to, context.timezone, context.cutoffHour],
    ),
    pool.query<{ channel: string; revenue: string; count: number }>(
      `${events} , channel_events AS (SELECT channel,total_cents*sign AS revenue,sign,day FROM sale_events UNION ALL SELECT 'store',total_cents,1,day FROM legacy) SELECT channel,sum(revenue)::text AS revenue,sum(sign)::integer AS count FROM channel_events WHERE day BETWEEN $2 AND $3 GROUP BY channel ORDER BY sum(revenue) DESC`,
      [businessId, range.from, range.to, context.timezone, context.cutoffHour],
    ),
    pool.query<HistoricalOrder>(
      `${events} SELECT id,number,items FROM legacy WHERE day BETWEEN $2 AND $3 AND historical_cost IS NULL ORDER BY created_at,id LIMIT 50`,
      [businessId, range.from, range.to, context.timezone, context.cutoffHour],
    ),
  ]);
  const current = daily.rows.filter((d) => d.date >= range.from),
    previous = daily.rows.filter((d) => d.date < range.from);
  const lookup = new Map(current.map((d) => [d.date, d]));
  const days: Report["days"] = [];
  for (let i = 0; i < range.days; i++) {
    const date = shiftDate(range.from, i),
      d = lookup.get(date);
    days.push({
      date,
      revenue: d?.revenue ?? "0",
      expenses: d?.expenses ?? "0",
      cost: d?.cost ?? "0",
      waste: d?.waste ?? "0",
      complete: !d || d.unknown === "0",
    });
  }
  return {
    ...range,
    totals: totals(current),
    previous: totals(previous),
    days,
    products: products.rows,
    byChannel: channel.rows,
    legacyCount: current.reduce((n, d) => n + Number(d.legacy), 0),
    legacyEstimatedCount: current.reduce((n, d) => n + Number(d.estimated), 0),
    legacyPendingCount: current.reduce(
      (n, d) => n + Number(d.legacy) - Number(d.estimated),
      0,
    ),
    historicalOrders: historicalOrders.rows,
  };
}

/** CSV cells starting with spreadsheet formula characters are neutralized. */
export function csv(rows: (string | number | null)[][]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            const s = String(value ?? "");
            const safe =
              !/^-?\d+(\.\d+)?$/.test(s) && /^[\s]*[=+@-]/.test(s)
                ? `'${s}`
                : s;
            return `"${safe.replace(/"/g, '""')}"`;
          })
          .join(";"),
      )
      .join("\r\n")
  );
}

export async function exportMovements(
  businessId: string,
  from?: string,
  to?: string,
) {
  const pool = getPool(),
    context = await managementContext(pool, businessId);
  const range = reportRange(
    from,
    to,
    operationalDate(new Date(), context.timezone, context.cutoffHour),
  );
  const { rows } = await pool.query<{
    date: string;
    name: string;
    unit: string;
    quantity: string;
    kind: string;
    cost: string | null;
    reason: string;
    actor: string;
    reference: string;
  }>(
    `SELECT o.operational_date AS date,i.name,i.unit,m.quantity,m.kind,m.cost_cents AS cost,m.reason,o.actor_id AS actor,o.id AS reference FROM inventory_movements m JOIN inventory_items i ON i.business_id=m.business_id AND i.id=m.item_id JOIN management_operations o ON o.business_id=m.business_id AND o.id=m.operation_id WHERE m.business_id=$1 AND o.operational_date BETWEEN $2 AND $3 ORDER BY m.created_at,m.id`,
    [businessId, range.from, range.to],
  );
  return csv([
    [
      "Día",
      "Insumo",
      "Unidad",
      "Cantidad",
      "Movimiento",
      "Costo (centavos)",
      "Motivo",
      "Actor",
      "Operación",
    ],
    ...rows.map((r) => [
      r.date,
      r.name,
      r.unit,
      r.quantity,
      r.kind,
      r.cost,
      r.reason,
      r.actor,
      r.reference,
    ]),
  ]);
}
