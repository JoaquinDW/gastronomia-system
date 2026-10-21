import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import snapshot from "../src/lib/demo/brasa-snapshot.json";
import { createSandbox, type DemoState } from "../src/lib/demo/sandbox";
import type { Order } from "../src/lib/checkout";

const fresh = () => createSandbox(snapshot as unknown as DemoState);
const get = <T>(s: ReturnType<typeof fresh>, path: string) => {
  const r = s.handle("GET", path, null);
  assert.equal(r.status, 200);
  return r.body as T;
};
const pending = (s: ReturnType<typeof fresh>) =>
  get<{ orders: Order[] }>(s, "/orders").orders.find(
    (o) => o.status === "pending_confirmation",
  )!;

test("the snapshot has orders in every state and an open shift", () => {
  const s = fresh();
  const { orders, cashOpen } = get<{ orders: Order[]; cashOpen: boolean }>(
    s,
    "/orders",
  );
  assert.ok(cashOpen);
  const states = new Set(orders.map((o) => o.stage ?? o.status));
  for (const state of [
    "pending_confirmation",
    "preparing",
    "ready",
    "on_the_way",
    "delivered",
    "rejected",
  ])
    assert.ok(states.has(state), state);
});

test("accepting, advancing and charging an order stays in memory", () => {
  const s = fresh();
  const order = pending(s);
  const accepted = s.handle("POST", "/orders", {
    orderId: order.id,
    version: order.version,
    status: "accepted",
    preparationMinutes: 25,
  });
  assert.equal(accepted.status, 200);
  const next = (accepted.body as { order: Order }).order;
  assert.equal(next.stage, "preparing");
  assert.ok(next.estimatedReadyAt);
  // A stale version loses, like on the real server.
  assert.equal(
    s.handle("POST", "/orders", {
      orderId: order.id,
      version: order.version,
      stage: "ready",
    }).status,
    409,
  );
  assert.equal(
    s.handle("POST", "/orders", {
      orderId: order.id,
      version: next.version,
      stage: "ready",
    }).status,
    200,
  );
  const unpaid = s.cashState().unpaid.find((u) => u.id === order.id);
  assert.equal(unpaid?.totalCents, order.totalCents);
  const charge = s.handle("POST", "/cash", {
    type: "payment",
    requestKey: randomUUID(),
    orderId: order.id,
    method: "transfer",
    amountCents: order.totalCents,
  });
  assert.equal(charge.status, 200);
  assert.ok(!s.cashState().unpaid.some((u) => u.id === order.id));
  assert.equal(
    s.handle("POST", "/cash", {
      type: "payment",
      requestKey: randomUUID(),
      orderId: order.id,
      method: "cash",
      amountCents: 100,
    }).status,
    409,
  );
  // Another sandbox starts over from the snapshot.
  assert.equal(pending(fresh()).id, order.id);
});

test("closing the shift reveals the expected cash only after the count", () => {
  const s = fresh();
  const session = s.cashState().session!;
  assert.equal(session.expectedCents, null);
  const r = s.handle("POST", "/cash", {
    type: "close",
    requestKey: randomUUID(),
    sessionId: session.id,
    declaredCents: 0,
  });
  assert.equal(r.status, 200);
  const closed = (
    r.body as { closed: { expectedCents: number; declaredCents: number } }
  ).closed;
  assert.ok(closed.expectedCents > 0);
  assert.equal(s.cashState().session, null);
  assert.equal(
    s.handle("POST", "/cash", {
      type: "open",
      requestKey: randomUUID(),
      openingCents: 500_000,
    }).status,
    200,
  );
});

test("a manual order is priced from the carta and rejects a stale quote", () => {
  const s = fresh();
  const product = s.state.products.find(
    (p) => !p.optionGroups.some((g) => g.min > 0),
  )!;
  const variant = product.variants[0];
  const body = (quoted: number) => ({
    requestKey: randomUUID(),
    channel: "counter",
    fulfillment: "pickup",
    paymentMethod: "cash",
    items: [
      {
        productId: product.id,
        variantId: variant.id,
        addOnIds: [],
        choiceIds: [],
        quantity: 2,
        quotedUnitCents: quoted,
      },
    ],
  });
  assert.equal(
    s.handle("POST", "/orders/manual", body(variant.priceCents + 1)).status,
    409,
  );
  const r = s.handle("POST", "/orders/manual", body(variant.priceCents));
  assert.equal(r.status, 201);
  const order = (r.body as { order: Order }).order;
  assert.equal(order.totalCents, variant.priceCents * 2);
  assert.equal(order.customerName, "Mostrador");
  assert.equal(order.stage, "preparing");
});

test("store orders keep arriving while the demo is open, up to a limit", (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const s = fresh();
  const count = () => get<{ orders: Order[] }>(s, "/orders").orders.length;
  // Make room: the snapshot already has two waiting.
  for (const o of get<{ orders: Order[] }>(s, "/orders").orders.filter(
    (o) => o.status === "pending_confirmation",
  ))
    s.handle("POST", "/orders", {
      orderId: o.id,
      version: o.version,
      status: "rejected",
    });
  const before = s.state.orders.length;
  count();
  assert.equal(s.state.orders.length, before);
  now += 80_000;
  count();
  assert.equal(s.state.orders.length, before + 1);
  const arrived = s.state.orders.at(-1)!;
  assert.equal(arrived.status, "pending_confirmation");
  assert.equal(
    arrived.totalCents,
    arrived.subtotalCents + arrived.deliveryCents,
  );
});

test("uploads and unknown endpoints answer like the demo, not the server", () => {
  const s = fresh();
  assert.equal(s.handle("POST", "/menu/images", null).status, 403);
  assert.equal(s.handle("POST", "/menu/import", null).status, 403);
  assert.equal(s.handle("GET", "/whatever", null).status, 404);
});
