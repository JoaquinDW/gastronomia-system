import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createBusiness } from "../src/server/businesses";
import { getPool } from "../src/server/postgres";
import { publishStore, saveProduct } from "../src/server/menu";
import { checkout, createManualOrder, listOrders } from "../src/server/orders";
import { getCashState, runCashCommand } from "../src/server/cash";
import { cashCommand } from "../src/lib/cash";
import { checkoutInput, manualOrderInput } from "../src/lib/checkout";
import { productInput } from "../src/lib/menu";

assert.ok(process.env.GASTRONOMIA_ENV_FILE && process.env.CASH_TEST_HOST, "Use an isolated test environment and explicitly selected endpoint");
process.loadEnvFile(process.env.GASTRONOMIA_ENV_FILE);
assert.match(process.env.NEON_BRANCH ?? "", /^(codex-|test|dev|preview)/);
assert.equal(new URL(process.env.DATABASE_URL!).hostname.replace("-pooler", ""), process.env.CASH_TEST_HOST);
const pool = getPool();

async function main() {
  const slug = `caja-${randomUUID().slice(0, 8)}`;
  const businessId = await createBusiness(`cash-test-${randomUUID()}`, { name: "Rotisería Caja", slug, kind: "rotiseria", whatsapp: "+5493511234567", city: "Córdoba", address: "Datos sintéticos 123", requestKey: randomUUID() });
  const variant = { id: randomUUID(), name: "Docena", priceCents: 1800000 };
  const empanadas = await saveProduct(businessId, productInput.parse({ name: "Empanadas", category: "Empanadas", variants: [variant] }));
  const line = { productId: empanadas.id, variantId: variant.id, addOnIds: [], quantity: 1, quotedUnitCents: 1800000 };
  const order = () => createManualOrder(businessId, "test", manualOrderInput.parse({ requestKey: randomUUID(), channel: "counter", fulfillment: "pickup", paymentMethod: "cash", items: [line] }));
  const run = (c: Record<string, unknown>, actor = "cajero") => runCashCommand(businessId, actor, cashCommand.parse(c));
  const pay = (orderId: string, method: string, amountCents: number, extra = {}) => run({ type: "payment", requestKey: randomUUID(), orderId, method, amountCents, ...extra });

  const first = await order();
  // No charges without an open shift.
  await assert.rejects(pay(first.id, "cash", 1800000), /caja está cerrada/);

  const openKey = randomUUID();
  const { session } = await run({ type: "open", requestKey: openKey, openingCents: 1000000 }) as { session: { id: string; number: number } };
  assert.equal(session.number, 1);
  // A double tap returns the same shift; a second shift is refused.
  assert.equal(((await run({ type: "open", requestKey: openKey, openingCents: 1000000 })) as { session: { id: string } }).session.id, session.id);
  await assert.rejects(run({ type: "open", requestKey: randomUUID(), openingCents: 0 }), /Ya hay un turno abierto/);

  // Split payment: part cash with change, the rest by transfer.
  const cashKey = randomUUID();
  const cash = { type: "payment", requestKey: cashKey, orderId: first.id, method: "cash", amountCents: 1000000, tenderedCents: 2000000 };
  const partial = await run(cash) as { movementId: string; leftCents: number };
  assert.equal(partial.leftCents, 800000);
  assert.equal(((await run(cash)) as { movementId: string }).movementId, partial.movementId);
  await assert.rejects(run({ ...cash, amountCents: 900000 }), /otros datos/);
  await assert.rejects(pay(first.id, "transfer", 900000), /falta cobrar/);
  await pay(first.id, "transfer", 800000);
  await assert.rejects(pay(first.id, "qr", 100), /ya está cobrado/);
  assert.equal((await listOrders(businessId)).find((o) => o.id === first.id)!.paidCents, 1800000);

  // Concurrent charges for the same balance: only one goes through.
  const second = await order();
  const race = await Promise.allSettled([pay(second.id, "cash", 1800000), pay(second.id, "card", 1800000)]);
  assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await listOrders(businessId)).find((o) => o.id === second.id)!.paidCents, 1800000);
  const cashWon = race[0].status === "fulfilled";

  // Pending, rejected and cancelled orders can't be charged.
  await publishStore(businessId, true).catch(() => {});
  await pool.query("UPDATE store_settings SET is_published=true,hours=$2 WHERE business_id=$1", [businessId, JSON.stringify(Array.from({ length: 7 }, (_, day) => [{ day, opens: "00:00", closes: "12:00" }, { day, opens: "12:00", closes: "00:00" }]).flat())]);
  const web = await checkout(slug, checkoutInput.parse({ requestKey: randomUUID(), customerName: "Cliente web", customerPhone: "+5493511234567", fulfillment: "pickup", zoneId: null, paymentMethod: "cash", items: [line] }), "http://localhost:3021");
  await assert.rejects(pay(web.id, "transfer", 100), /Aceptá el pedido/);
  const third = await order();
  await pay(third.id, "cash", 500000);
  await pool.query("UPDATE orders SET status='cancelled' WHERE id=$1", [third.id]);
  await assert.rejects(pay(third.id, "cash", 100), /anulado/);

  // Cash in and out, and voiding keeps the row but drops it from the count.
  await run({ type: "movement", requestKey: randomUUID(), kind: "deposit", amountCents: 200000, note: "Más cambio" });
  await run({ type: "movement", requestKey: randomUUID(), kind: "withdrawal", amountCents: 450000, note: "Pago al cadete" });
  const state = await getCashState(businessId, false);
  const refund = state.session!.movements.find((m) => m.orderId === third.id)!;
  assert.equal(refund.orderStatus, "cancelled");
  await run({ type: "void", movementId: refund.id, reason: "Devolvimos la plata" });
  await run({ type: "void", movementId: refund.id, reason: "Doble toque" });
  assert.equal((await getCashState(businessId, false)).session!.movements.find((m) => m.id === refund.id)!.voidReason, "Devolvimos la plata");

  // Blind: the open shift carries movements but never the expected cash, and
  // only the owner gets past shifts.
  assert.equal("expectedCents" in state.session! && state.session!.expectedCents, null);
  assert.equal(state.history, null);
  const unpaid = (await getCashState(businessId, true)).unpaid.map((o) => o.id);
  assert.ok(!unpaid.includes(first.id) && !unpaid.includes(second.id) && !unpaid.includes(third.id) && !unpaid.includes(web.id));
  const fourth = await order();
  assert.ok((await getCashState(businessId, true)).unpaid.some((o) => o.id === fourth.id));

  const expected = 1000000 + 1000000 + (cashWon ? 1800000 : 0) + 200000 - 450000;
  const closeKey = randomUUID();
  const close = { type: "close", requestKey: closeKey, sessionId: session.id, declaredCents: expected - 150000, note: "Faltó un billete" };
  const { closed } = await run(close) as { closed: { expectedCents: number; declaredCents: number; totals: { byMethod: Record<string, number> }; unpaid: { count: number; cents: number } } };
  assert.equal(closed.expectedCents, expected);
  assert.equal(closed.declaredCents - closed.expectedCents, -150000);
  assert.equal(closed.totals.byMethod.transfer, 800000);
  assert.equal(closed.totals.byMethod.cash + closed.totals.byMethod.card, 1000000 + 1800000);
  assert.deepEqual(closed.unpaid, { count: 1, cents: 1800000 });
  // A retry of the same close returns it; another close or a void in it is refused.
  assert.equal(((await run(close)) as { closed: { expectedCents: number } }).closed.expectedCents, expected);
  await assert.rejects(run({ ...close, requestKey: randomUUID() }), /ya se cerró/);
  await assert.rejects(run({ type: "void", movementId: partial.movementId, reason: "Tarde" }), /ya se cerró/);
  await assert.rejects(pay(fourth.id, "cash", 100), /caja está cerrada/);

  const history = (await getCashState(businessId, true)).history!;
  assert.equal(history.length, 1);
  assert.equal(history[0].totals.expectedCents, expected);
  const next = await run({ type: "open", requestKey: randomUUID(), openingCents: 0 }) as { session: { number: number } };
  assert.equal(next.session.number, 2);

  // Another business can't charge or void this one's rows.
  const other = await createBusiness(`cash-test-${randomUUID()}`, { name: "Otro local", slug: `${slug}-b`, kind: "rotiseria", whatsapp: "+5493511234568", city: "Córdoba", address: "Datos sintéticos 456", requestKey: randomUUID() });
  await runCashCommand(other, "x", cashCommand.parse({ type: "open", requestKey: randomUUID(), openingCents: 0 }));
  await assert.rejects(runCashCommand(other, "x", cashCommand.parse({ type: "payment", requestKey: randomUUID(), orderId: fourth.id, method: "cash", amountCents: 100 })), /No encontramos el pedido/);
  await assert.rejects(runCashCommand(other, "x", cashCommand.parse({ type: "void", movementId: partial.movementId, reason: "Ajeno" })), /No encontramos/);
  await assert.rejects(runCashCommand(other, "x", cashCommand.parse({ type: "close", requestKey: randomUUID(), sessionId: session.id, declaredCents: 0 })), /No encontramos el turno/);

  console.log("PASS: cash shift: one open shift, split and partial payments with change, no overcharge under concurrency, voids, cash in/out, blind close with frozen expected cash, retries and tenant isolation");
}
main().catch((e) => { console.error("FAIL:", e); process.exitCode = 1; }).finally(() => pool.end());
