import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createBusiness } from "../src/server/businesses";
import { getPool } from "../src/server/postgres";
import { saveProduct, saveSettings, publishStore } from "../src/server/menu";
import { advanceOrder, checkout, createManualOrder, listOrders } from "../src/server/orders";
import { checkoutInput, manualOrderInput } from "../src/lib/checkout";
import { emptySettings, productInput } from "../src/lib/menu";

assert.ok(process.env.GASTRONOMIA_ENV_FILE && process.env.MANUAL_TEST_HOST, "Use an isolated test environment and explicitly selected endpoint");
process.loadEnvFile(process.env.GASTRONOMIA_ENV_FILE);
assert.match(process.env.NEON_BRANCH ?? "", /^(codex-|test|dev|preview)/);
assert.equal(new URL(process.env.DATABASE_URL!).hostname.replace("-pooler", ""), process.env.MANUAL_TEST_HOST);
const pool = getPool();
const sales = async (orderId: string) =>
  (await pool.query<{ channel: string; totalCents: string }>(`SELECT channel,total_cents AS "totalCents" FROM management_sales WHERE order_id=$1`, [orderId])).rows;

async function main() {
  const slug = `manual-${randomUUID().slice(0, 8)}`;
  const businessId = await createBusiness(`manual-test-${randomUUID()}`, { name: "Rotisería Prueba", slug, kind: "rotiseria", whatsapp: "+5493511234567", city: "Córdoba", address: "Datos sintéticos 123", requestKey: randomUUID() });
  const variant = { id: randomUUID(), name: "Docena", priceCents: 1800000 };
  const empanadas = await saveProduct(businessId, productInput.parse({ name: "Empanadas", category: "Empanadas", variants: [variant, { id: randomUUID(), name: "Media", priceCents: 950000 }] }));
  const line = (extra = {}) => ({ productId: empanadas.id, variantId: variant.id, addOnIds: [], quantity: 1, quotedUnitCents: 1800000, ...extra });
  const input = (extra = {}) => manualOrderInput.parse({ requestKey: randomUUID(), channel: "counter", fulfillment: "pickup", paymentMethod: "cash", items: [line()], ...extra });

  // The store was never configured: the counter still takes orders.
  const counterInput = input();
  const counter = await createManualOrder(businessId, "test", counterInput);
  assert.equal(counter.number, 1);
  assert.equal(counter.channel, "counter");
  assert.equal(counter.customerName, "Mostrador");
  assert.equal(counter.customerPhone, "");
  assert.equal(counter.status, "accepted");
  assert.equal(counter.stage, "preparing");
  assert.ok(counter.acceptedAt);
  assert.equal(counter.estimatedReadyAt, null);
  assert.equal(counter.totalCents, 1800000);
  assert.ok(counter.management);
  assert.deepEqual(await sales(counter.id), [{ channel: "counter", totalCents: "1800000" }]);

  // A retry returns the same order and never a second sale.
  const retry = await createManualOrder(businessId, "test", counterInput);
  assert.equal(retry.id, counter.id);
  assert.equal((await sales(counter.id)).length, 1);
  await assert.rejects(createManualOrder(businessId, "test", { ...counterInput, note: "otra cosa" }), /otros datos/);

  // Phone delivery with a saved zone takes its fee; without one, the typed fee.
  const zone = { id: randomUUID(), name: "Centro", feeCents: 250000, minimumCents: 5000000 };
  const { isPublished, version, ...base } = emptySettings;
  void isPublished; void version;
  await saveSettings(businessId, { ...base, hours: Array.from({ length: 7 }, (_, day) => [{ day, opens: "00:00", closes: "12:00" }, { day, opens: "12:00", closes: "00:00" }]).flat(), deliveryEnabled: true, deliveryZones: [zone], paymentMethods: ["cash", "transfer"] }, 1);
  const phone = await createManualOrder(businessId, "test", input({ channel: "phone", customerName: "Marta", customerPhone: "351 555-1234", fulfillment: "delivery", address: "Belgrano 450", zoneId: zone.id, preparationMinutes: 40, items: [line({ quantity: 2 })] }));
  assert.equal(phone.number, 2);
  assert.equal(phone.customerPhone, "+3515551234");
  assert.equal(phone.zoneName, "Centro");
  // The zone minimum is for the public store; a phone order is the business's call.
  assert.equal(phone.deliveryCents, 250000);
  assert.equal(phone.totalCents, 3850000);
  assert.ok(Math.abs(new Date(phone.estimatedReadyAt!).getTime() - Date.now() - 40 * 60000) < 15000);
  assert.deepEqual(await sales(phone.id), [{ channel: "phone", totalCents: "3850000" }]);
  const typed = await createManualOrder(businessId, "test", input({ channel: "whatsapp", fulfillment: "delivery", address: "Lejos 1234", deliveryCents: 400000 }));
  assert.equal(typed.zoneName, "Envío");
  assert.equal(typed.customerName, "Pedido por WhatsApp");
  assert.equal(typed.totalCents, 2200000);

  // Same server checks as the store.
  await assert.rejects(createManualOrder(businessId, "test", input({ fulfillment: "delivery", address: "" })), /dirección/);
  await assert.rejects(createManualOrder(businessId, "test", input({ fulfillment: "delivery", address: "Belgrano 450", zoneId: randomUUID() })), /zona/);
  await assert.rejects(createManualOrder(businessId, "test", input({ items: [line({ quotedUnitCents: 100 })] })), /precio/);
  await assert.rejects(createManualOrder(businessId, "test", input({ items: [line({ productId: randomUUID() })] })), /disponible/);
  assert.throws(() => input({ customerPhone: "abc" }));
  assert.throws(() => input({ channel: "store" }));
  const other = await createBusiness(`manual-test-${randomUUID()}`, { name: "Otro local", slug: `${slug}-b`, kind: "rotiseria", whatsapp: "+5493511234568", city: "Córdoba", address: "Datos sintéticos 456", requestKey: randomUUID() });
  await assert.rejects(createManualOrder(other, "test", input()), /disponible/);

  // Manual orders follow the same stages; store orders keep the store channel.
  const ready = await advanceOrder(businessId, counter.id, counter.version, "ready");
  await advanceOrder(businessId, counter.id, ready.version, "delivered");
  await publishStore(businessId, true);
  const store = await checkout(slug, checkoutInput.parse({ requestKey: randomUUID(), customerName: "Cliente web", customerPhone: "+5493511234567", fulfillment: "pickup", zoneId: null, paymentMethod: "cash", items: [line()] }), "http://localhost:3021");
  const listed = await listOrders(businessId);
  assert.equal(listed.find((o) => o.id === store.id)!.channel, "store");
  assert.equal(store.number, 4);
  assert.deepEqual(listed.filter((o) => o.channel !== "store").map((o) => o.channel).sort(), ["counter", "phone", "whatsapp"]);
  console.log("PASS: counter, phone and WhatsApp orders: accepted with one sale, retries, fees, validation, tenant isolation and numbering shared with the store");
}
main().catch((e) => { console.error("FAIL:", e); process.exitCode = 1; }).finally(() => pool.end());
