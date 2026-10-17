import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { checkoutInput } from "../src/lib/checkout";

const order = {
  requestKey: randomUUID(),
  customerName: "Cliente de prueba",
  fulfillment: "pickup",
  zoneId: null,
  paymentMethod: "transfer",
  items: [
    {
      productId: randomUUID(),
      variantId: randomUUID(),
      addOnIds: [],
      quantity: 1,
      quotedUnitCents: 650000,
    },
  ],
};

test("checkout accepts pickup and delivery without a customer phone", () => {
  assert.equal(checkoutInput.parse(order).customerPhone, undefined);
  assert.equal(
    checkoutInput.parse({
      ...order,
      fulfillment: "delivery",
      zoneId: randomUUID(),
      address: "Calle de prueba 123",
    }).customerPhone,
    undefined,
  );
});

test("older checkout clients can still send a validated, normalized phone", () => {
  assert.equal(
    checkoutInput.parse({
      ...order,
      customerPhone: "+54 9 351 123 4567",
    }).customerPhone,
    "+5493511234567",
  );
  assert.equal(
    checkoutInput.safeParse({
      ...order,
      customerPhone: "no-es-un-telefono",
    }).success,
    false,
  );
});

test("older carts without choices are read as no choices", () => {
  const parsed = checkoutInput.parse({
    ...order,
    customerPhone: "+5493511234567",
  });
  assert.deepEqual(parsed.items[0].choiceIds, []);
  const pick = randomUUID();
  assert.deepEqual(
    checkoutInput.parse({
      ...order,
      customerPhone: "+5493511234567",
      items: [{ ...order.items[0], choiceIds: [pick, pick] }],
    }).items[0].choiceIds,
    [pick, pick],
  );
});
