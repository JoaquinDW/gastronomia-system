import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "./postgres";
import { lockBusiness } from "./menu";
import { HttpError } from "./errors";
import type { Product } from "@/lib/menu";
import type { Order } from "@/lib/checkout";
import type {
  ManagementCommand,
  ManagementData,
  StockItem,
  Supplier,
  Recipe,
  Movement,
  Operation,
  Expense,
  Sale,
  SaleLine,
} from "@/lib/management";
import {
  averageCost,
  costOf,
  decimal,
  fixed,
  multiply,
  operationalDate,
  rounded,
  SCALE,
  unitCostOf,
} from "@/lib/management-math";

const itemFields = `id,name,kind,unit,minimum,quantity,unit_cost AS "unitCost",version`;
const recipeFields = `id,product_id AS "productId",option_id AS "optionId",option_kind AS "optionKind",version,lines,no_consumption AS "noConsumption"`;
export const saleFields = `id,channel,order_id AS "orderId",note,total_cents AS "totalCents",delivery_cents AS "deliveryCents",cost_cents AS "costCents",known_cost_cents AS "knownCostCents",cost_complete AS "costComplete",lines,operational_date AS "operationalDate",created_at AS "createdAt",cancelled_at AS "cancelledAt"`;

export async function managementContext(
  client: Pick<PoolClient, "query">,
  businessId: string,
) {
  const { rows } = await client.query<{
    locationId: string;
    timezone: string;
    cutoffHour: number;
    version: number;
  }>(
    `SELECT (SELECT id FROM locations WHERE business_id=b.id ORDER BY created_at,id LIMIT 1) AS "locationId", b.timezone,COALESCE(s.cutoff_hour,4) AS "cutoffHour", COALESCE(s.version,0) AS version FROM businesses b LEFT JOIN management_settings s ON s.business_id=b.id WHERE b.id=$1`,
    [businessId],
  );
  if (!rows[0]?.locationId)
    throw new HttpError(404, "No encontramos la sucursal del negocio.");
  return rows[0];
}

export async function getManagementData(
  businessId: string,
  options: {
    salesOffset?: number;
    movementsOffset?: number;
    operationsOffset?: number;
    owner?: boolean;
  } = {},
): Promise<ManagementData> {
  const pool = getPool();
  const context = await managementContext(pool, businessId);
  const [items, suppliers, recipes, movements, operations, sales, expenses] =
    await Promise.all([
      pool.query<StockItem>(
        `SELECT ${itemFields} FROM inventory_items WHERE business_id=$1 ORDER BY name,id`,
        [businessId],
      ),
      pool.query<Supplier>(
        `SELECT id,name,contact,note,version FROM suppliers WHERE business_id=$1 ORDER BY name,id`,
        [businessId],
      ),
      pool.query<Recipe>(
        `SELECT DISTINCT ON (product_id,option_id,option_kind) ${recipeFields} FROM management_recipes WHERE business_id=$1 ORDER BY product_id,option_id,option_kind,version DESC`,
        [businessId],
      ),
      pool.query<Movement>(
        `SELECT m.id,m.item_id AS "itemId",i.name AS "itemName",m.quantity,m.cost_cents AS "costCents",m.kind,m.operation_id AS "operationId",m.created_at AS "createdAt",m.reason FROM inventory_movements m JOIN inventory_items i ON i.id=m.item_id AND i.business_id=m.business_id WHERE m.business_id=$1 ORDER BY m.created_at DESC,m.id LIMIT 101 OFFSET $2`,
        [businessId, options.movementsOffset ?? 0],
      ),
      pool.query<Operation>(
        `SELECT id,type,payload,created_at AS "createdAt",actor_id AS "actorId" FROM management_operations WHERE business_id=$1 AND type IN ('purchase','production','adjustment') ORDER BY created_at DESC,id LIMIT 51 OFFSET $2`,
        [businessId, options.operationsOffset ?? 0],
      ),
      pool.query<Sale>(
        `SELECT ${saleFields} FROM management_sales WHERE business_id=$1 ORDER BY created_at DESC,id LIMIT 51 OFFSET $2`,
        [businessId, options.salesOffset ?? 0],
      ),
      options.owner === false
        ? Promise.resolve({ rows: [] as Expense[] })
        : pool.query<Expense>(
            `SELECT id,date,category,concept,amount_cents AS "amountCents",supplier_id AS "supplierId",note,reversed_at AS "reversedAt" FROM management_expenses WHERE business_id=$1 ORDER BY date DESC,id`,
            [businessId],
          ),
    ]);
  return JSON.parse(
    JSON.stringify({
      items: items.rows,
      suppliers: suppliers.rows,
      recipes: recipes.rows,
      movements: movements.rows.slice(0, 100),
      movementsHasMore: movements.rows.length > 100,
      operations: operations.rows.slice(0, 50),
      operationsHasMore: operations.rows.length > 50,
      sales: sales.rows.slice(0, 50),
      salesHasMore: sales.rows.length > 50,
      expenses: expenses.rows,
      settings: context,
      today: operationalDate(new Date(), context.timezone, context.cutoffHour),
    }),
  );
}

async function beginOperation(
  client: PoolClient,
  businessId: string,
  actor: string,
  input: { requestKey: string; type: string },
) {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const existing = await client.query<{
    id: string;
    payloadHash: string;
    result: Record<string, unknown>;
  }>(
    `SELECT id,payload_hash AS "payloadHash",result FROM management_operations WHERE business_id=$1 AND request_key=$2`,
    [businessId, input.requestKey],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].payloadHash !== hash)
      throw new HttpError(
        409,
        "Este envío ya se usó con otros datos. Volvé a cargar la operación.",
      );
    return { id: existing.rows[0].id, replay: existing.rows[0].result };
  }
  const context = await managementContext(client, businessId);
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO management_operations(business_id,request_key,payload_hash,type,actor_id,payload,operational_date) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      businessId,
      input.requestKey,
      hash,
      input.type,
      actor,
      JSON.stringify(input),
      operationalDate(new Date(), context.timezone, context.cutoffHour),
    ],
  );
  return { id: rows[0].id, replay: null };
}
async function finish(
  client: PoolClient,
  businessId: string,
  operationId: string,
  result: Record<string, unknown>,
) {
  await client.query(
    `UPDATE management_operations SET result=$3 WHERE business_id=$1 AND id=$2`,
    [businessId, operationId, JSON.stringify(result)],
  );
  return result;
}
async function stock(client: PoolClient, businessId: string) {
  const { rows } = await client.query<StockItem>(
    `SELECT ${itemFields} FROM inventory_items WHERE business_id=$1 ORDER BY id FOR UPDATE`,
    [businessId],
  );
  return new Map(rows.map((i) => [i.id, i]));
}
function requireItem(items: Map<string, StockItem>, id: string): StockItem {
  const item = items.get(id);
  if (!item)
    throw new HttpError(
      422,
      "Un insumo no pertenece a este negocio. Actualizá el inventario.",
    );
  return item;
}
async function supplierExists(
  client: PoolClient,
  businessId: string,
  id: string | null,
) {
  if (
    id &&
    !(
      await client.query(
        `SELECT id FROM suppliers WHERE business_id=$1 AND id=$2`,
        [businessId, id],
      )
    ).rowCount
  )
    throw new HttpError(422, "El proveedor no pertenece a este negocio.");
}
async function move(
  client: PoolClient,
  businessId: string,
  locationId: string,
  operationId: string,
  item: StockItem,
  quantity: string,
  kind: string,
  costCents: string | null,
  reason = "",
  newUnitCost?: string | null,
) {
  const balance = decimal(fixed(item.quantity) + fixed(quantity));
  item.quantity = balance;
  if (newUnitCost !== undefined) item.unitCost = newUnitCost;
  item.version += 1;
  await client.query(
    `UPDATE inventory_items SET quantity=$3,unit_cost=$4,version=version+1 WHERE business_id=$1 AND id=$2`,
    [businessId, item.id, balance, item.unitCost],
  );
  await client.query(
    `INSERT INTO inventory_movements(business_id,location_id,item_id,operation_id,kind,quantity,cost_cents,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      businessId,
      locationId,
      item.id,
      operationId,
      kind,
      quantity,
      costCents,
      reason,
    ],
  );
}
function conflict() {
  throw new HttpError(
    409,
    "Cambió en otra pantalla. Actualizá los datos antes de guardar.",
  );
}

export async function createSale(
  client: PoolClient,
  businessId: string,
  operationId: string,
  input: {
    channel: string;
    orderId?: string;
    note: string;
    deliveryCents: string;
    lines: Omit<SaleLine, "costCents" | "knownCostCents">[];
  },
) {
  const context = await managementContext(client, businessId);
  const items = await stock(client, businessId);
  const { rows: recipes } = await client.query<Recipe>(
    `SELECT DISTINCT ON (product_id,option_id,option_kind) ${recipeFields} FROM management_recipes WHERE business_id=$1 ORDER BY product_id,option_id,option_kind,version DESC`,
    [businessId],
  );
  const lookup = new Map(
    recipes.map((r) => [`${r.productId}/${r.optionKind}/${r.optionId}`, r]),
  );
  const needed = new Map<string, bigint>();
  const neededCosts = new Map<string, bigint | null>();
  const lines: SaleLine[] = [];
  for (const line of input.lines) {
    let complete = true,
      known = 0n;
    const options = [
      lookup.get(`${line.productId}/variant/${line.variantId}`),
      ...(line.addOnIds ?? []).map((id) =>
        lookup.get(`${line.productId}/addon/${id}`),
      ),
    ];
    if (!line.productId || !line.variantId || !line.addOnIds) complete = false;
    // Freeze the components and unit costs used for each sold line.
    for (const recipe of options) {
      if (!recipe) {
        complete = false;
        continue;
      }
      for (const component of recipe.lines) {
        const item = requireItem(items, component.itemId);
        const q = multiply(component.quantity, line.quantity.toString());
        const cost = costOf(q, item.unitCost);
        if (cost === null) complete = false;
        else known += BigInt(cost);
        needed.set(item.id, (needed.get(item.id) ?? 0n) + fixed(q));
        const previous = neededCosts.get(item.id);
        neededCosts.set(
          item.id,
          cost === null || previous === null
            ? null
            : (previous ?? 0n) + BigInt(cost),
        );
      }
    }
    lines.push({
      ...line,
      costCents: complete ? known.toString() : null,
      knownCostCents: known.toString(),
    });
  }
  for (const [id, quantity] of [...needed].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const item = requireItem(items, id);
    await move(
      client,
      businessId,
      context.locationId,
      operationId,
      item,
      decimal(-quantity),
      "sale",
      neededCosts.get(id)?.toString() ?? null,
    );
  }
  const knownCost = lines.reduce(
    (sum, l) => sum + BigInt(l.knownCostCents),
    0n,
  );
  const complete = lines.every((l) => l.costCents !== null);
  const total = lines.reduce(
    (sum, l) => sum + BigInt(l.lineCents),
    BigInt(input.deliveryCents),
  );
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO management_sales(business_id,location_id,operation_id,order_id,channel,note,total_cents,delivery_cents,cost_cents,known_cost_cents,cost_complete,lines,operational_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      businessId,
      context.locationId,
      operationId,
      input.orderId ?? null,
      input.channel,
      input.note,
      total.toString(),
      input.deliveryCents,
      complete ? knownCost.toString() : null,
      knownCost.toString(),
      complete,
      JSON.stringify(lines),
      operationalDate(new Date(), context.timezone, context.cutoffHour),
    ],
  );
  return {
    id: rows[0].id,
    costComplete: complete,
    warnings: [...items.values()]
      .filter((i) => fixed(i.quantity) < 0n)
      .map((i) => `${i.name}: stock negativo`),
    incomplete: !complete,
  };
}

/** Called inside the order acceptance transaction and business lock. */
export async function recordStoreSale(
  client: PoolClient,
  businessId: string,
  actor: string,
  order: Order,
) {
  const input = { requestKey: order.id, type: "store_sale", orderId: order.id };
  const op = await beginOperation(client, businessId, actor, input);
  if (op.replay) return op.replay;
  const result = await createSale(client, businessId, op.id, {
    channel: "store",
    orderId: order.id,
    note: `Pedido #${order.number}`,
    deliveryCents: order.deliveryCents.toString(),
    lines: order.items.map((i) => ({
      ...i,
      unitCents: i.unitCents.toString(),
      lineCents: i.lineCents.toString(),
    })),
  });
  return finish(client, businessId, op.id, result);
}

export async function executeManagement(
  businessId: string,
  actor: string,
  input: ManagementCommand,
  owner: boolean,
) {
  if (!owner && ["expense", "reverse_expense", "settings"].includes(input.type))
    throw new HttpError(
      403,
      "Solo el propietario puede gestionar gastos y configuración.",
    );
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await lockBusiness(client, businessId);
    const op = await beginOperation(client, businessId, actor, input);
    if (op.replay) {
      await client.query("COMMIT");
      return op.replay;
    }
    const context = await managementContext(client, businessId);
    const items = await stock(client, businessId);
    let result: Record<string, unknown> = { id: op.id };
    switch (input.type) {
      case "item": {
        if (input.id) {
          const item = requireItem(items, input.id);
          if (input.version !== item.version) conflict();
          if (item.unit !== input.unit || item.kind !== input.kind)
            throw new HttpError(
              422,
              "La unidad y el tipo no se cambian: creá otro insumo para conservar el historial.",
            );
          await client.query(
            `UPDATE inventory_items SET name=$3,minimum=$4,version=version+1 WHERE business_id=$1 AND id=$2`,
            [businessId, item.id, input.name, input.minimum],
          );
          result.id = item.id;
        } else {
          if (
            fixed(input.initialQuantity) === 0n &&
            input.initialValueCents !== null &&
            BigInt(input.initialValueCents) !== 0n
          )
            throw new HttpError(
              422,
              "No se puede cargar el costo de un stock inicial de cero.",
            );
          const unitCost =
            input.initialValueCents !== null &&
            fixed(input.initialQuantity) > 0n
              ? unitCostOf(input.initialQuantity, input.initialValueCents)
              : null;
          const { rows } = await client.query<StockItem>(
            `INSERT INTO inventory_items(business_id,location_id,name,kind,unit,minimum,unit_cost) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${itemFields}`,
            [
              businessId,
              context.locationId,
              input.name,
              input.kind,
              input.unit,
              input.minimum,
              unitCost,
            ],
          );
          const item = rows[0];
          await move(
            client,
            businessId,
            context.locationId,
            op.id,
            item,
            input.initialQuantity,
            "opening",
            input.initialValueCents,
          );
          result.id = item.id;
        }
        break;
      }
      case "supplier": {
        if (input.id) {
          const updated = await client.query(
            `UPDATE suppliers SET name=$3,contact=$4,note=$5,version=version+1 WHERE business_id=$1 AND id=$2 AND version=$6 RETURNING id`,
            [
              businessId,
              input.id,
              input.name,
              input.contact,
              input.note,
              input.version,
            ],
          );
          if (!updated.rowCount) conflict();
          result.id = input.id;
        } else
          result.id = (
            await client.query<{ id: string }>(
              `INSERT INTO suppliers(business_id,name,contact,note) VALUES($1,$2,$3,$4) RETURNING id`,
              [businessId, input.name, input.contact, input.note],
            )
          ).rows[0].id;
        break;
      }
      case "recipe": {
        const { rows } = await client.query<Product>(
          `SELECT variants,add_ons AS "addOns" FROM menu_products WHERE business_id=$1 AND id=$2 AND archived_at IS NULL`,
          [businessId, input.productId],
        );
        if (
          !rows[0] ||
          !(
            input.optionKind === "variant" ? rows[0].variants : rows[0].addOns
          ).some((o) => o.id === input.optionId)
        )
          throw new HttpError(
            422,
            "La opción ya no está en la carta. Actualizala antes de guardar.",
          );
        const current = await client.query<{ version: number }>(
          `SELECT version FROM management_recipes WHERE business_id=$1 AND product_id=$2 AND option_id=$3 AND option_kind=$4 ORDER BY version DESC LIMIT 1`,
          [businessId, input.productId, input.optionId, input.optionKind],
        );
        if ((current.rows[0]?.version ?? 0) !== input.version) conflict();
        if (input.noConsumption === !!input.lines.length)
          throw new HttpError(
            422,
            "Agregá ingredientes o marcá que esta opción no usa insumos.",
          );
        if (
          new Set(input.lines.map((l) => l.itemId)).size !== input.lines.length
        )
          throw new HttpError(
            422,
            "Sumá los insumos repetidos en una sola línea.",
          );
        for (const line of input.lines) requireItem(items, line.itemId);
        await client.query(
          `INSERT INTO management_recipes(business_id,product_id,option_id,option_kind,version,lines,no_consumption,operation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            businessId,
            input.productId,
            input.optionId,
            input.optionKind,
            input.version + 1,
            JSON.stringify(input.lines),
            input.noConsumption,
            op.id,
          ],
        );
        break;
      }
      case "purchase": {
        await supplierExists(client, businessId, input.supplierId);
        for (const line of input.lines) {
          const item = requireItem(items, line.itemId);
          if (
            (line.unit === "kg" && item.unit !== "g") ||
            (line.unit === "l" && item.unit !== "ml") ||
            (["g", "ml", "unit"].includes(line.unit) && item.unit !== line.unit)
          )
            throw new HttpError(
              422,
              `La unidad de compra no corresponde a ${item.name}.`,
            );
          const factor =
            line.unit === "kg" || line.unit === "l"
              ? "1000"
              : line.unit === "pack"
                ? line.factor
                : "1";
          const quantity = multiply(line.quantity, factor);
          if (fixed(quantity) <= 0n)
            throw new HttpError(
              422,
              "La conversión debe dar una cantidad mayor que cero.",
            );
          const average = averageCost(
            item.quantity,
            item.unitCost,
            quantity,
            line.totalCents,
          );
          await move(
            client,
            businessId,
            context.locationId,
            op.id,
            item,
            quantity,
            "purchase",
            line.totalCents,
            input.note,
            average,
          );
        }
        break;
      }
      case "production": {
        const output = requireItem(items, input.outputItemId);
        if (output.kind !== "finished")
          throw new HttpError(
            422,
            "Elegí un producto ya preparado para registrar lo que obtuviste.",
          );
        let total = 0n,
          complete = true;
        for (const line of input.lines) {
          const item = requireItem(items, line.itemId);
          if (item.kind !== "ingredient")
            throw new HttpError(
              422,
              "Usá insumos como ingredientes de esta preparación.",
            );
          const cost = costOf(line.quantity, item.unitCost);
          if (cost === null) complete = false;
          else total += BigInt(cost);
          await move(
            client,
            businessId,
            context.locationId,
            op.id,
            item,
            decimal(-fixed(line.quantity)),
            "production_input",
            cost,
            input.note,
          );
        }
        const avg = complete
          ? averageCost(
              output.quantity,
              output.unitCost,
              input.outputQuantity,
              total.toString(),
            )
          : null;
        await move(
          client,
          businessId,
          context.locationId,
          op.id,
          output,
          input.outputQuantity,
          "production_output",
          complete ? total.toString() : null,
          input.note,
          avg,
        );
        result.costComplete = complete;
        break;
      }
      case "adjustment": {
        const item = requireItem(items, input.itemId);
        if (item.version !== input.version) conflict();
        if (
          input.referenceId &&
          !(
            await client.query(
              `SELECT id FROM management_operations WHERE business_id=$1 AND id=$2`,
              [businessId, input.referenceId],
            )
          ).rowCount
        )
          throw new HttpError(
            422,
            "La operación a corregir no pertenece a este negocio.",
          );
        const change =
          input.mode === "count"
            ? fixed(input.quantity) - fixed(item.quantity)
            : -fixed(input.quantity);
        if (input.mode === "waste" && change === 0n)
          throw new HttpError(422, "La pérdida debe ser mayor que cero.");
        if (
          input.mode === "count" &&
          input.totalValueCents !== null &&
          fixed(input.quantity) === 0n &&
          BigInt(input.totalValueCents) !== 0n
        )
          throw new HttpError(
            422,
            "Para cargar un costo, primero indicá cuánto stock tenés.",
          );
        const newCost =
          input.mode === "count" &&
          input.totalValueCents !== null &&
          fixed(input.quantity) > 0n
            ? unitCostOf(input.quantity, input.totalValueCents)
            : undefined;
        await move(
          client,
          businessId,
          context.locationId,
          op.id,
          item,
          decimal(change),
          input.mode === "waste" ? "waste" : "adjustment",
          costOf(decimal(change < 0n ? -change : change), item.unitCost),
          input.reason,
          newCost,
        );
        break;
      }
      case "sale": {
        const { rows } = await client.query<Product>(
          `SELECT id,name,variants,add_ons AS "addOns",is_available AS "isAvailable" FROM menu_products WHERE business_id=$1 AND archived_at IS NULL AND id=ANY($2::uuid[])`,
          [businessId, input.lines.map((l) => l.productId)],
        );
        const products = new Map(rows.map((p) => [p.id, p]));
        const lines: Omit<SaleLine, "costCents" | "knownCostCents">[] = [];
        for (const line of input.lines) {
          const p = products.get(line.productId),
            variant = p?.variants.find((v) => v.id === line.variantId);
          if (!p || !variant)
            throw new HttpError(
              422,
              "Un producto o variante ya no existe en la carta.",
            );
          if (new Set(line.addOnIds).size !== line.addOnIds.length)
            throw new HttpError(422, "No repitas adicionales.");
          const addOns = line.addOnIds.map((id) =>
            p.addOns.find((a) => a.id === id),
          );
          if (addOns.some((a) => !a))
            throw new HttpError(422, "Un adicional ya no existe en la carta.");
          lines.push({
            ...line,
            name: p.name,
            variant: variant.name,
            addOns: addOns.map((a) => a!.name),
            lineCents: (
              BigInt(line.unitCents) * BigInt(line.quantity)
            ).toString(),
          });
        }
        result = await createSale(client, businessId, op.id, {
          ...input,
          lines,
        });
        break;
      }
      case "cancel_sale": {
        const { rows } = await client.query<Sale & { operationId: string }>(
          `SELECT ${saleFields},operation_id AS "operationId" FROM management_sales WHERE business_id=$1 AND id=$2 FOR UPDATE`,
          [businessId, input.saleId],
        );
        const sale = rows[0];
        if (!sale) throw new HttpError(404, "No encontramos la venta.");
        if (sale.cancelledAt)
          throw new HttpError(409, "Esta venta ya está anulada.");
        const consumed = await client.query<Movement>(
          `SELECT id,item_id AS "itemId",quantity,cost_cents AS "costCents" FROM inventory_movements WHERE business_id=$1 AND operation_id=$2 AND kind='sale' ORDER BY item_id,id`,
          [businessId, sale.operationId],
        );
        const recovery = new Map(
          input.recoveries.map((r) => [r.movementId, r.quantity]),
        );
        if (
          recovery.size !== input.recoveries.length ||
          [...recovery.keys()].some(
            (id) => !consumed.rows.some((m) => m.id === id),
          )
        )
          throw new HttpError(
            422,
            "Las cantidades recuperadas no corresponden a los insumos usados en esta venta.",
          );
        for (const movement of consumed.rows) {
          const item = requireItem(items, movement.itemId),
            original = -fixed(movement.quantity),
            recovered = fixed(recovery.get(movement.id) ?? "0");
          if (recovered > original)
            throw new HttpError(
              422,
              `No podés recuperar más ${item.name} de lo que consumiste.`,
            );
          const recoveredCost =
            movement.costCents === null
              ? null
              : rounded(
                  BigInt(movement.costCents) * recovered,
                  original,
                ).toString();
          if (recovered > 0n) {
            const avg =
              recoveredCost === null
                ? null
                : averageCost(
                    item.quantity,
                    item.unitCost,
                    decimal(recovered),
                    recoveredCost,
                  );
            await move(
              client,
              businessId,
              context.locationId,
              op.id,
              item,
              decimal(recovered),
              "recovery",
              recoveredCost,
              input.reason,
              avg,
            );
          }
          if (original > recovered) {
            const lost =
              movement.costCents === null
                ? null
                : (
                    BigInt(movement.costCents) - BigInt(recoveredCost!)
                  ).toString();
            // Already removed at sale time: zero quantity avoids consuming twice.
            await move(
              client,
              businessId,
              context.locationId,
              op.id,
              item,
              "0",
              "waste",
              lost,
              `${input.reason} · no recuperado: ${decimal(original - recovered)} ${item.unit}`,
            );
          }
        }
        await client.query(
          `UPDATE management_sales SET cancelled_at=now(),cancellation_id=$3 WHERE business_id=$1 AND id=$2`,
          [businessId, sale.id, op.id],
        );
        if (sale.orderId)
          await client.query(
            `UPDATE orders SET status='cancelled',version=version+1 WHERE business_id=$1 AND id=$2`,
            [businessId, sale.orderId],
          );
        result.incompleteWaste = !sale.costComplete;
        break;
      }
      case "expense": {
        if (
          input.date >
          operationalDate(new Date(), context.timezone, context.cutoffHour)
        )
          throw new HttpError(
            422,
            "Elegí la fecha de hoy o una fecha anterior para el gasto.",
          );
        await supplierExists(client, businessId, input.supplierId);
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO management_expenses(business_id,operation_id,supplier_id,date,category,concept,amount_cents,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [
            businessId,
            op.id,
            input.supplierId,
            input.date,
            input.category,
            input.concept,
            input.amountCents,
            input.note,
          ],
        );
        result.id = rows[0].id;
        break;
      }
      case "reverse_expense": {
        const updated = await client.query(
          `UPDATE management_expenses SET reversed_at=now(),reversal_id=$3 WHERE business_id=$1 AND id=$2 AND reversed_at IS NULL RETURNING id`,
          [businessId, input.expenseId, op.id],
        );
        if (!updated.rowCount)
          throw new HttpError(409, "El gasto no existe o ya fue anulado.");
        break;
      }
      case "settings": {
        if (context.version !== input.version) conflict();
        await client.query(
          `INSERT INTO management_settings(business_id,cutoff_hour) VALUES($1,$2) ON CONFLICT(business_id) DO UPDATE SET cutoff_hour=$2,version=management_settings.version+1`,
          [businessId, input.cutoffHour],
        );
        break;
      }
    }
    result.warnings =
      result.warnings ??
      [...items.values()]
        .filter((i) => fixed(i.quantity) < 0n)
        .map((i) => `${i.name}: stock negativo`);
    await finish(client, businessId, op.id, result);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      throw new HttpError(
        409,
        "Ya existe un registro con ese nombre o referencia.",
      );
    if ((e as { code?: string }).code === "22003")
      throw new HttpError(
        422,
        "La cantidad o el importe supera el límite permitido.",
      );
    throw e;
  } finally {
    client.release();
  }
}

export async function saleConsumptions(businessId: string, saleId: string) {
  const { rows } = await getPool().query<Movement>(
    `SELECT m.id,m.item_id AS "itemId",i.name AS "itemName",m.quantity,m.cost_cents AS "costCents",m.kind,m.operation_id AS "operationId",m.created_at AS "createdAt",m.reason FROM inventory_movements m JOIN management_sales s ON s.operation_id=m.operation_id AND s.business_id=m.business_id JOIN inventory_items i ON i.id=m.item_id AND i.business_id=m.business_id WHERE s.business_id=$1 AND s.id=$2 AND m.kind='sale' ORDER BY i.name,m.id`,
    [businessId, saleId],
  );
  return rows;
}
