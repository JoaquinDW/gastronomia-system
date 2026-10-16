import "server-only";
import { createHash } from "node:crypto";
import { getPool } from "./postgres";
import { HttpError } from "./http";
import { lockBusiness } from "./menu";
import {
  isStoreOpen,
  formatMoney,
  type Product,
  type StoreSettings,
} from "@/lib/menu";
import type { CheckoutInput, Order, OrderItem } from "@/lib/checkout";

const fields = `id,number,status,customer_name AS "customerName",customer_phone AS "customerPhone",fulfillment,address,zone_name AS "zoneName",payment_method AS "paymentMethod",note,items,subtotal_cents AS "subtotalCents",delivery_cents AS "deliveryCents",total_cents AS "totalCents",version,created_at AS "createdAt"`;
function orderResult(order: Order, whatsapp: string, businessName: string) {
  const message = [
    `Hola ${businessName}, quiero confirmar el pedido #${order.number}.`,
    "",
    ...order.items.map(
      (i) =>
        `${i.quantity} × ${i.name}${i.variant !== "Única" ? ` (${i.variant})` : ""}${i.addOns.length ? ` + ${i.addOns.join(", ")}` : ""}: ${formatMoney(i.lineCents)}`,
    ),
    "",
    `Modalidad: ${order.fulfillment === "pickup" ? "Retiro en el local" : "Delivery"}`,
    ...(order.address
      ? [`Dirección: ${order.address}`, `Zona: ${order.zoneName}`]
      : []),
    `Envío: ${formatMoney(order.deliveryCents)}`,
    `Total: ${formatMoney(order.totalCents)}`,
    `Pago: ${order.paymentMethod === "cash" ? "Efectivo" : "Transferencia a confirmar"}`,
    `Nombre: ${order.customerName}`,
    `Teléfono: ${order.customerPhone}`,
    ...(order.note ? [`Nota: ${order.note}`] : []),
    "Pendiente de confirmación del local.",
  ].join("\n");
  return {
    id: order.id,
    number: order.number,
    totalCents: order.totalCents,
    whatsappUrl: `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
  };
}
export async function checkout(slug: string, input: CheckoutInput) {
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
      return orderResult(existing.rows[0], b.whatsapp, b.name);
    }
    const { rows } = await client.query<StoreSettings>(
      `SELECT is_published AS "isPublished",hours,pickup_enabled AS "pickupEnabled",delivery_enabled AS "deliveryEnabled",delivery_zones AS "deliveryZones",payment_methods AS "paymentMethods" FROM store_settings WHERE business_id=$1 FOR UPDATE`,
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
      `SELECT id,name,variants,add_ons AS "addOns",is_available AS "isAvailable" FROM menu_products WHERE business_id=$1 AND archived_at IS NULL AND id=ANY($2::uuid[])`,
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
      const unitCents =
        variant.priceCents + addOns.reduce((n, a) => n + a!.priceCents, 0);
      if (unitCents !== line.quotedUnitCents)
        throw new HttpError(
          409,
          "Cambió un precio. Actualizá la carta y revisá el total antes de confirmar.",
        );
      items.push({
        name: product.name,
        variant: variant.name,
        addOns: addOns.map((a) => a!.name),
        quantity: line.quantity,
        unitCents,
        lineCents: unitCents * line.quantity,
      });
    }
    const subtotal = items.reduce((n, i) => n + i.lineCents, 0);
    let fee = 0,
      zoneName: string | null = null;
    if (input.fulfillment === "delivery") {
      const zone = s.deliveryZones.find((z) => z.id === input.zoneId);
      if (!s.deliveryEnabled || !zone)
        throw new HttpError(422, "Seleccioná una zona de delivery disponible.");
      if (input.address.length < 5)
        throw new HttpError(422, "Completá la dirección de entrega.");
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
      `INSERT INTO orders(business_id,number,request_key,payload_hash,customer_name,customer_phone,fulfillment,address,zone_name,payment_method,note,items,subtotal_cents,delivery_cents,total_cents) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING ${fields}`,
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
      ],
    );
    await client.query("COMMIT");
    return orderResult(saved.rows[0], b.whatsapp, b.name);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function listOrders(businessId: string): Promise<Order[]> {
  const { rows } = await getPool().query<Order>(
    `SELECT ${fields} FROM orders WHERE business_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [businessId],
  );
  return rows;
}
export async function decideOrder(
  businessId: string,
  id: string,
  version: number,
  status: "accepted" | "rejected",
) {
  const { rows } = await getPool().query<Order>(
    `UPDATE orders SET status=$4,version=version+1 WHERE business_id=$1 AND id=$2 AND version=$3 AND status='pending_confirmation' RETURNING ${fields}`,
    [businessId, id, version, status],
  );
  if (!rows[0])
    throw new HttpError(
      409,
      "El pedido ya fue atendido en otra pantalla. Actualizá la lista.",
    );
  return rows[0];
}
