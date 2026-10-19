import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { defaultCustomerName, manualOrderInput } from "../src/lib/checkout";
import { pesosToCents } from "../src/lib/cart";

const order = {
  requestKey: randomUUID(),
  channel: "counter",
  fulfillment: "pickup",
  paymentMethod: "cash",
  items: [{ productId: randomUUID(), variantId: randomUUID(), addOnIds: [], quantity: 1, quotedUnitCents: 650000 }],
};

test("a counter order needs only products", () => {
  const parsed = manualOrderInput.parse(order);
  assert.equal(parsed.customerName, "");
  assert.equal(parsed.customerPhone, "");
  assert.equal(parsed.zoneId, null);
  assert.equal(parsed.deliveryCents, 0);
  assert.equal(parsed.preparationMinutes, null);
  assert.equal(defaultCustomerName("counter"), "Mostrador");
  assert.equal(defaultCustomerName("phone"), "Pedido por Teléfono");
});

test("phones are optional but normalized when given", () => {
  assert.equal(manualOrderInput.parse({ ...order, customerPhone: "351 555-1234" }).customerPhone, "+3515551234");
  assert.equal(manualOrderInput.parse({ ...order, customerPhone: "  " }).customerPhone, "");
  assert.throws(() => manualOrderInput.parse({ ...order, customerPhone: "abc" }));
  assert.throws(() => manualOrderInput.parse({ ...order, customerPhone: "123" }));
});

test("only panel channels and real items are accepted", () => {
  assert.throws(() => manualOrderInput.parse({ ...order, channel: "store" }));
  assert.throws(() => manualOrderInput.parse({ ...order, items: [] }));
  assert.throws(() => manualOrderInput.parse({ ...order, deliveryCents: -1 }));
  assert.throws(() => manualOrderInput.parse({ ...order, status: "accepted" }));
});

test("typed delivery fees read like Argentine prices", () => {
  assert.equal(pesosToCents(""), 0);
  assert.equal(pesosToCents("1500"), 150000);
  assert.equal(pesosToCents("1.500"), 150000);
  assert.equal(pesosToCents("$ 1.500,50"), 150050);
  assert.equal(pesosToCents("12.345.678"), 1234567800);
  assert.equal(pesosToCents("1,5"), 150);
  assert.equal(pesosToCents("mil"), null);
  assert.equal(pesosToCents("-200"), null);
});
