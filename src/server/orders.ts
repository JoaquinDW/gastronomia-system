import "server-only";
import { createHash } from "node:crypto";
import { getPool } from "./postgres";
import { HttpError } from "./errors";
import { lockBusiness } from "./menu";
import {
  isStoreOpen,
  formatMoney,
  resolveChoices,
  type Product,
  type StoreSettings,
} from "@/lib/menu";
import {
  isDeliveryFeePending,
  nextStage,
  trackingTokenPattern,
  type CheckoutInput,
  type Order,
  type OrderItem,
  type OrderStage,
} from "@/lib/checkout";
import { deliveryQuote } from "@/lib/delivery";
import { storeUrl } from "@/lib/hosts";
import { recordStoreSale } from "./management";

const fields = `id,number,status,customer_name AS "customerName",customer_phone AS "customerPhone",fulfillment,address,zone_name AS "zoneName",delivery_location AS "deliveryLocation",payment_method AS "paymentMethod",note,items,subtotal_cents AS "subtotalCents",delivery_cents AS "deliveryCents",total_cents AS "totalCents",version,created_at AS "createdAt",accepted_at AS "acceptedAt",stage,stage_changed_at AS "stageChangedAt",tracking_token AS "trackingToken"`;
// Absolute link for the customer; without a root domain the store lives under
// /t/<slug> on the request's own origin.
export function trackingUrl(slug: string, token: string, origin: string) {
  return new URL(`${storeUrl(slug)}/pedido/${token}`, origin).toString();
}
function orderResult(
  order: Order,
  whatsapp: string,
  businessName: string,
  tracking: string,
) {
  const deliveryFeePending = isDeliveryFeePending(order);
  const message = [
    `Hola ${businessName}, quiero confirmar el pedido #${order.number}.`,
    "",
    ...order.items.flatMap((i) => [
      `${i.quantity} × ${i.name}${i.variant !== "Única" ? ` (${i.variant})` : ""}${i.addOns.length ? ` + ${i.addOns.join(", ")}` : ""}: ${formatMoney(i.lineCents)}`,
      ...(i.choices ?? []).map((c) => `   ${c}`),
    ]),
    "",
    `Modalidad: ${order.fulfillment === "pickup" ? "Retiro en el local" : "Delivery"}`,
    ...(order.address
      ? [`Dirección: ${order.address}`, ...(order.zoneName ? [`Zona: ${order.zoneName}`] : [])]
      : []),
    ...(order.deliveryLocation ? [`Ubicación: https://www.google.com/maps/search/?api=1&query=${order.deliveryLocation.lat},${order.deliveryLocation.lng}`] : []),
    deliveryFeePending ? "Envío: el local confirmará el costo" : `Envío: ${formatMoney(order.deliveryCents)}`,
    `${deliveryFeePending ? "Total sin envío" : "Total"}: ${formatMoney(order.totalCents)}`,
    `Pago: ${order.paymentMethod === "cash" ? "Efectivo" : "Transferencia a confirmar"}`,
    `Nombre: ${order.customerName}`,
    `Teléfono: ${order.customerPhone}`,
    ...(order.note ? [`Nota: ${order.note}`] : []),
    "Pendiente de confirmación del local.",
    `Seguimiento: ${tracking}`,
  ].join("\n");
  return {
    id: order.id,
    number: order.number,
    totalCents: order.totalCents,
    trackingUrl: tracking,
    deliveryFeePending,
    whatsappUrl: `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
  };
}
export async function checkout(
  slug: string,
  input: CheckoutInput,
  origin: string,
) {
  const pool = getPool();
  const businessResult = await pool.query<{
    id: string;
    name: string;
    whatsapp: string;
    timezone: string;
  }>("SELECT id,name,whatsapp,timezone FROM businesses WHERE slug=$1", [slug]);
  const b = businessResult.rows[0];
  if (!b) throw new HttpError(404, "No encontramos la tienda.");
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockBusiness(client, b.id);
    const existing = await client.query<Order & { payloadHash: string }>(
      `SELECT ${fields},payload_hash AS "payloadHash" FROM orders WHERE business_id=$1 AND request_key=$2`,
      [b.id, input.requestKey],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].payloadHash !== hash)
        throw new HttpError(
          409,
          "Esta solicitud ya se usó con otros datos. Revisá tu carrito antes de continuar.",
        );
      await client.query("COMMIT");
      const order = existing.rows[0];
      return orderResult(
        order,
        b.whatsapp,
        b.name,
        trackingUrl(slug, order.trackingToken!, origin),
      );
    }
    const { rows } = await client.query<StoreSettings>(
      `SELECT is_published AS "isPublished",hours,pickup_enabled AS "pickupEnabled",delivery_enabled AS "deliveryEnabled",delivery_zones AS "deliveryZones",delivery_config AS "deliveryConfig",payment_methods AS "paymentMethods" FROM store_settings WHERE business_id=$1 FOR UPDATE`,
      [b.id],
    );
    const s = rows[0];
    if (!s?.isPublished)
      throw new HttpError(404, "La tienda no está disponible.");
    if (!isStoreOpen(s.hours, new Date(), b.timezone))
      throw new HttpError(
        409,
        "El local está cerrado. Volvé a intentar dentro de su horario de atención.",
      );
    if (!s.paymentMethods.includes(input.paymentMethod))
      throw new HttpError(422, "Ese medio de pago no está disponible.");
    if (input.items.reduce((n, i) => n + i.quantity, 0) > 100)
      throw new HttpError(
        422,
        "El pedido supera las 100 unidades. Consultá al local para pedidos grandes.",
      );
    const productRows = await client.query<Product>(
      `SELECT id,name,variants,add_ons AS "addOns",option_groups AS "optionGroups",is_available AS "isAvailable" FROM menu_products WHERE business_id=$1 AND archived_at IS NULL AND id=ANY($2::uuid[])`,
      [b.id, input.items.map((i) => i.productId)],
    );
    const products = new Map(productRows.rows.map((p) => [p.id, p]));
    const items: OrderItem[] = [];
    for (const line of input.items) {
      const product = products.get(line.productId);
      const variant = product?.variants.find((v) => v.id === line.variantId);
      if (!product?.isAvailable || !variant)
        throw new HttpError(
          409,
          "Un producto ya no está disponible. Actualizá la carta.",
        );
      if (new Set(line.addOnIds).size !== line.addOnIds.length)
        throw new HttpError(
          422,
          "No se pueden repetir adicionales en la misma unidad.",
        );
      const addOns = line.addOnIds.map((id) =>
        product.addOns.find((a) => a.id === id),
      );
      if (addOns.some((a) => !a))
        throw new HttpError(409, "Un adicional cambió. Actualizá la carta.");
      const choices = resolveChoices(product, line.choiceIds);
      if (!choices.ok)
        throw new HttpError(
          choices.stale ? 409 : 422,
          choices.stale
            ? choices.message
            : `${product.name}: ${choices.message}`,
        );
      const unitCents =
        variant.priceCents +
        addOns.reduce((n, a) => n + a!.priceCents, 0) +
        choices.value.cents;
      if (unitCents !== line.quotedUnitCents)
        throw new HttpError(
          409,
          "Cambió un precio. Actualizá la carta y revisá el total antes de confirmar.",
        );
      items.push({
        productId: line.productId,
        variantId: line.variantId,
        addOnIds: line.addOnIds,
        choiceIds: line.choiceIds,
        name: product.name,
        variant: variant.name,
        addOns: addOns.map((a) => a!.name),
        choices: choices.value.labels,
        quantity: line.quantity,
        unitCents,
        lineCents: unitCents * line.quantity,
      });
    }
    const subtotal = items.reduce((n, i) => n + i.lineCents, 0);
    let fee = 0,
      zoneName: string | null = null;
    if (input.fulfillment === "delivery") {
      if (!s.deliveryEnabled)
        throw new HttpError(422, "El delivery no está disponible.");
      if (input.address.length < 5)
        throw new HttpError(422, "Completá la dirección de entrega.");
      let zone = s.deliveryZones.find((z) => z.id === input.zoneId);
      if (s.deliveryConfig?.mode === "radius") {
        if (!input.deliveryLocation)
          throw new HttpError(422, "Confirmá la ubicación de entrega en el mapa.");
        const quote = deliveryQuote(s.deliveryConfig, s.deliveryZones, input.deliveryLocation);
        if (!quote)
          throw new HttpError(422, "La dirección está fuera de la cobertura de delivery. Podés elegir retiro si está disponible.");
        zone = quote.zone;
        if (input.quotedDeliveryCents !== quote.feeCents || input.zoneId !== zone.id)
          throw new HttpError(409, "Cambió la tarifa de envío. Actualizá la tienda y revisá el total antes de confirmar.");
      }
      if (!zone)
        throw new HttpError(422, "Seleccioná una zona de delivery disponible.");
      if (subtotal < zone.minimumCents)
        throw new HttpError(
          422,
          `El mínimo para esa zona es ${formatMoney(zone.minimumCents)}.`,
        );
      fee = zone.feeCents;
      zoneName = zone.name;
    } else if (!s.pickupEnabled)
      throw new HttpError(422, "El retiro en el local no está disponible.");
    if (subtotal + fee > 1_999_999_999)
      throw new HttpError(
        422,
        "El pedido supera el importe permitido. Consultá con el local.",
      );
    const counter = await client.query<{ number: number }>(
      "UPDATE store_settings SET next_order_number=next_order_number+1 WHERE business_id=$1 RETURNING next_order_number-1 AS number",
      [b.id],
    );
    const saved = await client.query<Order>(
      `INSERT INTO orders(business_id,number,request_key,payload_hash,customer_name,customer_phone,fulfillment,address,zone_name,payment_method,note,items,subtotal_cents,delivery_cents,total_cents,delivery_location) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING ${fields}`,
      [
        b.id,
        counter.rows[0].number,
        input.requestKey,
        hash,
        input.customerName,
        input.customerPhone,
        input.fulfillment,
        input.fulfillment === "delivery" ? input.address : null,
        zoneName,
        input.paymentMethod,
        input.note,
        JSON.stringify(items),
        subtotal,
        fee,
        subtotal + fee,
        input.fulfillment === "delivery" && s.deliveryConfig?.mode === "radius" ? JSON.stringify(input.deliveryLocation) : null,
      ],
    );
    await client.query("COMMIT");
    const order = saved.rows[0];
    return orderResult(
      order,
      b.whatsapp,
      b.name,
      trackingUrl(slug, order.trackingToken!, origin),
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function hasOrders(businessId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    "SELECT 1 FROM orders WHERE business_id=$1 LIMIT 1",
    [businessId],
  );
  return Boolean(rowCount);
}
export async function listOrders(businessId: string): Promise<Order[]> {
  const { rows } = await getPool().query<Order>(
    `SELECT ${fields},(SELECT s.id FROM management_sales s WHERE s.business_id=orders.business_id AND s.order_id=orders.id) AS "saleId" FROM orders WHERE business_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [businessId],
  );
  return rows;
}
export async function decideOrder(
  businessId: string,
  id: string,
  version: number,
  status: "accepted" | "rejected",
  actor = "system",
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await lockBusiness(client, businessId);
    const { rows } = await client.query<Order>(
      `UPDATE orders SET status=$4::varchar,version=version+1,accepted_at=CASE WHEN $4::varchar='accepted' THEN now() ELSE accepted_at END,stage=CASE WHEN $4::varchar='accepted' THEN 'preparing' END,stage_changed_at=CASE WHEN $4::varchar='accepted' THEN now() END WHERE business_id=$1 AND id=$2 AND version=$3 AND status='pending_confirmation' RETURNING ${fields}`,
      [businessId, id, version, status],
    );
    if (!rows[0])
      throw new HttpError(
        409,
        "El pedido ya fue atendido en otra pantalla. Actualizá la lista.",
      );
    const management =
      status === "accepted"
        ? await recordStoreSale(client, businessId, actor, rows[0])
        : null;
    await client.query("COMMIT");
    return { ...rows[0], management };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function advanceOrder(
  businessId: string,
  id: string,
  version: number,
  stage: OrderStage,
) {
  const pool = getPool();
  const current = await pool.query<Order>(
    `SELECT ${fields} FROM orders WHERE business_id=$1 AND id=$2`,
    [businessId, id],
  );
  const order = current.rows[0];
  if (!order) throw new HttpError(404, "No encontramos el pedido.");
  if (order.status !== "accepted" || order.version !== version)
    throw new HttpError(
      409,
      "El pedido cambió en otra pantalla. Actualizá la lista.",
    );
  if (nextStage(order.fulfillment, order.stage) !== stage)
    throw new HttpError(422, "Ese pedido no puede pasar a ese estado.");
  // The version check makes a concurrent change lose instead of skipping steps.
  const { rows } = await pool.query<Order>(
    `UPDATE orders SET stage=$4,stage_changed_at=now(),version=version+1 WHERE business_id=$1 AND id=$2 AND version=$3 AND status='accepted' RETURNING ${fields}`,
    [businessId, id, version, stage],
  );
  if (!rows[0])
    throw new HttpError(
      409,
      "El pedido cambió en otra pantalla. Actualizá la lista.",
    );
  return rows[0];
}
export type TrackedOrder = Pick<
  Order,
  | "number"
  | "status"
  | "fulfillment"
  | "zoneName"
  | "paymentMethod"
  | "items"
  | "deliveryCents"
  | "totalCents"
  | "createdAt"
  | "stage"
  | "stageChangedAt"
> & { businessName: string; whatsapp: string };
// Public view for the customer: no phone, address or note, only what the
// tracking link needs to show.
export async function trackOrder(
  slug: string,
  token: string,
): Promise<TrackedOrder | null> {
  if (!trackingTokenPattern.test(token)) return null;
  const { rows } = await getPool().query<TrackedOrder>(
    `SELECT o.number,o.status,o.fulfillment,o.zone_name AS "zoneName",o.payment_method AS "paymentMethod",o.items,o.delivery_cents AS "deliveryCents",o.total_cents AS "totalCents",o.created_at AS "createdAt",o.stage,o.stage_changed_at AS "stageChangedAt",b.name AS "businessName",b.whatsapp FROM orders o JOIN businesses b ON b.id=o.business_id WHERE b.slug=$1 AND o.tracking_token=$2`,
    [slug, token],
  );
  return rows[0] ?? null;
}
