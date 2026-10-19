import assert from "node:assert/strict";
import { test } from "node:test";
import { trackingStatus, orderWhatsappUrl, trackingUrl } from "../src/lib/order-tracking";
import { nextStage, type Order } from "../src/lib/checkout";

test("tracking reflects the existing kitchen stages without changing acceptance", () => {
  assert.equal(trackingStatus({status:"pending_confirmation",stage:null}), "pending_confirmation");
  for (const [stage, label] of [["preparing","accepted"],["ready","ready"],["on_the_way","out_for_delivery"],["delivered","completed"]] as const)
    assert.equal(trackingStatus({status:"accepted",stage}), label);
  assert.equal(trackingStatus({status:"cancelled",stage:"delivered"}), "cancelled");
  assert.equal(nextStage("delivery", "ready"), "on_the_way");
  assert.equal(nextStage("pickup", "ready"), "delivered");
  assert.equal(nextStage("pickup", "on_the_way"), null);
  assert.equal(nextStage("delivery", "delivered"), null);
});
test("links support custom store hosts and single-host development", () => {
  const saved = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  try {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "";
    assert.equal(trackingUrl("local", "uuid", "http://localhost:3000"), "http://localhost:3000/t/local/pedido/uuid");
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "pedipue.com";
    assert.equal(trackingUrl("local", "uuid", "https://app.pedipue.com"), "https://local.pedipue.com/pedido/uuid");
  } finally { if (saved === undefined) delete process.env.NEXT_PUBLIC_ROOT_DOMAIN; else process.env.NEXT_PUBLIC_ROOT_DOMAIN = saved; }
});
test("WhatsApp preserves totals, options, address, note and tracking link", () => {
  const order = { number: 123, customerName: "Ana", fulfillment: "delivery", address: "San Martín 123", zoneName: "Centro", paymentMethod: "transfer", note: "Sin sal", items: [{ name: "Combo", quantity: 2, variant: "Grande", addOns: ["Queso"], choices: ["Sabores: 2 Pollo completo"], unitCents: 100000, lineCents: 200000 }], subtotalCents: 200000, deliveryCents: 50000, totalCents: 250000 } as Order;
  const url = new URL(orderWhatsappUrl(order, "+54 9 3511234567", "https://local.test/pedido/secret"));
  assert.equal(url.pathname, "/5493511234567");
  const message = url.searchParams.get("text")!;
  for (const text of ["DELIVERY 123", "soy Ana", "2 × Combo", "• Grande", "• Queso", "• Sabores: 2 Pollo completo", "TOTAL (Pago Transferencia)", "San Martín 123", "Sin sal", "https://local.test/pedido/secret"]) assert.ok(message.includes(text), text);
  assert.match(message, /\$\s*2[.,]500 TOTAL/);
  const unknownFee = new URL(orderWhatsappUrl({ ...order, zoneName: null }, "123", "url")).searchParams.get("text")!;
  assert.match(unknownFee, /TOTAL SIN ENVÍO/);
  assert.match(unknownFee, /costo a confirmar/);
});
