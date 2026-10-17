import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createBusiness } from "../src/server/businesses";
import { getPool } from "../src/server/postgres";
import { saveProduct, saveSettings, getSettings, publishStore } from "../src/server/menu";
import { checkout as checkoutOrder, listOrders } from "../src/server/orders";
import { checkoutInput } from "../src/lib/checkout";
import { emptySettings, productInput } from "../src/lib/menu";

assert.ok(process.env.GASTRONOMIA_ENV_FILE && process.env.DELIVERY_TEST_HOST, "Select an isolated test environment and endpoint");
process.loadEnvFile(process.env.GASTRONOMIA_ENV_FILE);
assert.match(process.env.NEON_BRANCH ?? "", /^(codex-|test|dev|preview)/);
assert.equal(new URL(process.env.DATABASE_URL!).hostname.replace("-pooler", ""), process.env.DELIVERY_TEST_HOST);
const pool = getPool();

async function main() {
  const slug = `delivery-${randomUUID().slice(0, 8)}`;
  const businessId = await createBusiness(`delivery-test-${randomUUID()}`, {
    name: "Local de prueba · Delivery", slug, kind: "hamburgueseria",
    whatsapp: "+5493511234567", city: "Córdoba", address: "Datos sintéticos 123", requestKey: randomUUID(),
  });
  const product = await saveProduct(businessId, productInput.parse({
    name: "Burger de prueba", category: "Hamburguesas",
    variants: [{ id: randomUUID(), name: "Única", priceCents: 650000 }],
  }));
  const near = { id: randomUUID(), name: "Cerca", radiusMeters: 1500, feeCents: 100000, minimumCents: 0 };
  const far = { id: randomUUID(), name: "Lejos", radiusMeters: 5000, feeCents: 200000, minimumCents: 600000 };
  const origin = { lat: -31.4201, lng: -64.1888 };
  const { isPublished, version, ...base } = emptySettings;
  void isPublished; void version;
  const settings = { ...base, hours: Array.from({ length: 7 }, (_, day) => [{ day, opens: "00:00", closes: "12:00" }, { day, opens: "12:00", closes: "00:00" }]).flat(), deliveryEnabled: true,
    deliveryZones: [far, near], deliveryConfig: { mode: "radius" as const, origin, address: "Datos sintéticos 123, Córdoba" } };
  await saveSettings(businessId, settings, 0);
  await publishStore(businessId, true);
  assert.deepEqual((await getSettings(businessId)).deliveryConfig, settings.deliveryConfig);
  const input = (extra = {}) => checkoutInput.parse({
    requestKey: randomUUID(), customerName: "Cliente sintético", customerPhone: "+5493511234567",
    fulfillment: "delivery", address: "Destino sintético 456", zoneId: near.id, paymentMethod: "cash",
    deliveryLocation: origin, quotedDeliveryCents: near.feeCents,
    items: [{ productId: product.id, variantId: product.variants[0].id, addOnIds: [], quantity: 1, quotedUnitCents: 650000 }], ...extra,
  });
  const checkout = (slug: string, request: ReturnType<typeof input>) => checkoutOrder(slug, request, "http://localhost:3107");
  const request = input();
  const order = await checkout(slug, request);
  assert.equal(order.totalCents, 750000);
  assert.deepEqual(await checkout(slug, request), order);
  const message = new URL(order.whatsappUrl).searchParams.get("text")!;
  assert.match(message, /Ubicación: https:\/\/www.google.com\/maps\/search/);
  const saved = (await listOrders(businessId))[0];
  assert.deepEqual(saved.deliveryLocation, origin);
  assert.equal(saved.zoneName, "Cerca");
  await assert.rejects(checkout(slug, input({ deliveryLocation: null })), /ubicación de entrega/);
  await assert.rejects(checkout(slug, input({ deliveryLocation: { lat: -32, lng: -64 } })), /fuera de la cobertura/);
  await assert.rejects(checkout(slug, input({ quotedDeliveryCents: 0 })), /Cambió la tarifa/);
  await assert.rejects(checkout(slug, input({ zoneId: far.id })), /Cambió la tarifa/);
  const farRequest = input({ deliveryLocation: { lat: -31.45, lng: -64.1888 }, zoneId: far.id, quotedDeliveryCents: far.feeCents });
  assert.equal((await checkout(slug, farRequest)).totalCents, 850000);
  // Reject stale quotes, but retries keep the saved fee and location snapshot.
  const current = await getSettings(businessId);
  const { isPublished: published, version: savedVersion, ...changed } = current;
  void published;
  changed.deliveryZones = changed.deliveryZones.map(z => ({ ...z, feeCents: z.feeCents + 10000 }));
  await saveSettings(businessId, changed, savedVersion);
  await assert.rejects(checkout(slug, input()), /Cambió la tarifa/);
  assert.deepEqual(await checkout(slug, request), order);
  // A valid outer-zone quote still has to meet that zone's minimum order.
  let next = await getSettings(businessId);
  const { isPublished: p, version: v, ...minimumSettings } = next;
  void p;
  minimumSettings.deliveryZones = [near, { ...far, minimumCents: 700000 }];
  await saveSettings(businessId, minimumSettings, v);
  await assert.rejects(checkout(slug, input({ ...farRequest, requestKey: randomUUID() })), /mínimo para esa zona/);
  // Pickup remains usable without a location even in an automatic-delivery store.
  assert.equal((await checkout(slug, input({ fulfillment: "pickup", deliveryLocation: null, zoneId: null }))).totalCents, 650000);
  next = await getSettings(businessId);
  const { isPublished: p2, version: v2, ...manual } = next;
  void p2;
  manual.deliveryConfig = { mode: "manual" };
  manual.deliveryZones = [near];
  await saveSettings(businessId, manual, v2);
  assert.equal((await checkout(slug, input({ deliveryLocation: undefined, quotedDeliveryCents: undefined }))).totalCents, 750000);
  // Leave this synthetic store in radius mode for the browser regression test.
  next = await getSettings(businessId);
  await saveSettings(businessId, settings, next.version);
  if (process.env.DELIVERY_FIXTURE_FILE) writeFileSync(process.env.DELIVERY_FIXTURE_FILE, JSON.stringify({ slug, businessId, product, settings, origin, near, far }));
  console.log("PASS: delivery settings, computed fees, coverage, minimums, stale quotes, retries, Maps link, pickup and manual compatibility on isolated Postgres");
}
main().catch(() => { console.error("FAIL: delivery integration; secrets and customer data omitted"); process.exitCode = 1; }).finally(() => pool.end());
