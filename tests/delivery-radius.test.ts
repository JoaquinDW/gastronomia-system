import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { coordinatesSchema, deliveryFeeByLocal, deliveryQuote, distanceMeters, type DeliveryConfig } from "../src/lib/delivery";
import { emptySettings, settingsInput } from "../src/lib/menu";
import { checkoutInput } from "../src/lib/checkout";

const config: DeliveryConfig = { mode: "radius", origin: { lat: -31.4201, lng: -64.1888 }, address: "Local de prueba, Córdoba" };
const near = { id: randomUUID(), name: "Cerca", radiusMeters: 1500, feeCents: 100000, minimumCents: 0 };
const far = { id: randomUUID(), name: "Lejos", radiusMeters: 5000, feeCents: 200000, minimumCents: 600000 };
test("distance uses meters, including across the antimeridian and at the poles", () => {
  assert.equal(distanceMeters(config.origin, config.origin), 0);
  assert.ok(Math.abs(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111195) < 1);
  assert.ok(distanceMeters({ lat: 0, lng: 179.99 }, { lat: 0, lng: -179.99 }) < 2300);
  assert.ok(Number.isFinite(distanceMeters({ lat: 90, lng: 0 }, { lat: -90, lng: 180 })));
});
test("the smallest matching radius wins regardless of order or tariff", () => {
  assert.equal(deliveryQuote(config, [far, near], config.origin)?.zone.id, near.id);
  assert.equal(deliveryQuote(config, [{ ...far, feeCents: 0 }, near], config.origin)?.feeCents, near.feeCents);
  assert.equal(deliveryQuote(config, [far, near], { lat: -31.45, lng: -64.1888 })?.zone.id, far.id);
});
test("coverage is inclusive at the exact boundary and rejects any distance beyond it", () => {
  const destination = { lat: -31.43, lng: -64.1888 };
  const radiusMeters = distanceMeters(config.origin, destination);
  assert.ok(deliveryQuote(config, [{ ...near, radiusMeters }], destination));
  assert.equal(deliveryQuote(config, [{ ...near, radiusMeters: radiusMeters - 0.01 }], destination), null);
});
test("missing location, missing coverage and manual mode do not produce a quote", () => {
  assert.equal(deliveryQuote(config, [near], null), null);
  assert.equal(deliveryQuote(config, [near], { lat: -32, lng: -64 }), null);
  assert.equal(deliveryQuote(config, [{ ...near, radiusMeters: undefined }], config.origin), null);
  assert.equal(deliveryQuote({ mode: "manual" }, [near], config.origin), null);
});
test("free delivery is a known quote with a zero price", () => {
  assert.equal(deliveryQuote(config, [{ ...near, feeCents: 0 }], config.origin)?.feeCents, 0);
});
test("coordinates reject nonfinite and out-of-range values", () => {
  for (const point of [{ lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: NaN, lng: 0 }, { lat: 0, lng: Infinity }])
    assert.equal(coordinatesSchema.safeParse(point).success, false);
});
test("automatic coverage requires an origin, nonempty radii and no duplicate boundaries", () => {
  const { isPublished, version, ...settings } = emptySettings;
  void isPublished; void version;
  const valid = { ...settings, deliveryEnabled: true, deliveryConfig: config, deliveryZones: [near, far] };
  assert.equal(settingsInput.safeParse(valid).success, true);
  for (const deliveryZones of [[], [{ ...near, radiusMeters: undefined }], [near, { ...far, radiusMeters: near.radiusMeters }], [{ ...near, radiusMeters: 30001 }]])
    assert.equal(settingsInput.safeParse({ ...valid, deliveryZones }).success, false);
  assert.equal(settingsInput.safeParse({ ...valid, deliveryConfig: { ...config, origin: null } }).success, false);
  const { deliveryConfig, ...legacy } = settings;
  void deliveryConfig;
  assert.deepEqual(settingsInput.parse(legacy).deliveryConfig, { mode: "manual" });
});
test("checkout rejects invalid pins and arbitrary delivery prices", () => {
  const valid = { requestKey: randomUUID(), customerName: "Cliente", customerPhone: "+5493511234567", fulfillment: "delivery", address: "Calle de prueba 123", zoneId: near.id, paymentMethod: "cash", deliveryLocation: config.origin, quotedDeliveryCents: 100000, items: [{ productId: randomUUID(), variantId: randomUUID(), addOnIds: [], quantity: 1, quotedUnitCents: 650000 }] };
  assert.equal(checkoutInput.safeParse(valid).success, true);
  assert.equal(checkoutInput.safeParse({ ...valid, deliveryLocation: { lat: 100, lng: 0 } }).success, false);
  assert.equal(checkoutInput.safeParse({ ...valid, quotedDeliveryCents: -1 }).success, false);
});
test("delivery confirmed by the local needs no zones and never quotes a fee", () => {
  const { isPublished, version, ...settings } = emptySettings;
  void isPublished; void version;
  const confirm = { ...settings, deliveryEnabled: true, deliveryConfig: { mode: "confirm" as const }, deliveryZones: [] };
  assert.deepEqual(settingsInput.parse(confirm).deliveryConfig, { mode: "confirm" });
  assert.equal(settingsInput.safeParse({ ...confirm, deliveryConfig: { mode: "confirm", origin: config.origin } }).success, false);
  assert.equal(deliveryQuote({ mode: "confirm" }, [near], config.origin), null);
  assert.equal(deliveryFeeByLocal(confirm), true);
  assert.equal(deliveryFeeByLocal({ ...confirm, deliveryEnabled: false }), false);
  assert.equal(deliveryFeeByLocal({ ...confirm, deliveryConfig: { mode: "manual" } }), false);
});
