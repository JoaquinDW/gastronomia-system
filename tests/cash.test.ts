import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  cashCommand,
  cashTotals,
  changeFor,
  countTotal,
  differenceLabel,
  suggestedBills,
} from "../src/lib/cash";
import { formatMoney } from "../src/lib/menu";

const m = (kind: string, method: string, amountCents: number, voidedAt: string | null = null) =>
  ({ kind, method, amountCents, voidedAt }) as Parameters<typeof cashTotals>[1][number];

test("expected cash is the float plus cash in, minus cash out, without voided rows", () => {
  const t = cashTotals(1_000_000, [
    m("payment", "cash", 1_800_000),
    m("payment", "transfer", 950_000),
    m("payment", "card", 500_000),
    m("payment", "cash", 300_000, "2026-10-20T00:00:00Z"),
    m("deposit", "cash", 200_000),
    m("withdrawal", "cash", 450_000),
  ]);
  assert.equal(t.expectedCents, 1_000_000 + 1_800_000 + 200_000 - 450_000);
  assert.deepEqual(t.byMethod, { cash: 1_800_000, transfer: 950_000, qr: 0, card: 500_000 });
  assert.equal(t.payments, 3);
});

test("the difference reads as extra or missing cash", () => {
  assert.equal(differenceLabel(0, formatMoney), "La caja cuadra");
  assert.match(differenceLabel(-150_000, formatMoney), /^Faltan \$\s?1\.500$/);
  assert.match(differenceLabel(20_000, formatMoney), /^Sobran \$\s?200$/);
});

test("change and suggested bills", () => {
  assert.equal(changeFor(1_350_000, 2_000_000), 650_000);
  assert.equal(changeFor(1_350_000, 1_000_000), null);
  assert.equal(changeFor(1_350_000, null), null);
  assert.deepEqual(suggestedBills(1_350_000), [1_400_000, 2_000_000]);
  assert.deepEqual(suggestedBills(1_000_000), [2_000_000]);
  assert.deepEqual(suggestedBills(235_000), [300_000, 400_000, 1_000_000]);
});

test("counting by bill adds coins", () => {
  assert.equal(countTotal({ 2_000_000: 2, 100_000: 3 }, 5_000), 4_305_000);
});

test("commands are validated before reaching the register", () => {
  const payment = { type: "payment", requestKey: randomUUID(), orderId: randomUUID(), method: "cash", amountCents: 1_000 };
  assert.equal(cashCommand.parse(payment).type, "payment");
  assert.equal(cashCommand.safeParse({ ...payment, tenderedCents: 500 }).success, false);
  assert.equal(cashCommand.safeParse({ ...payment, method: "card", tenderedCents: 2_000 }).success, false);
  assert.equal(cashCommand.safeParse({ ...payment, amountCents: 0 }).success, false);
  assert.equal(cashCommand.safeParse({ type: "movement", requestKey: randomUUID(), kind: "withdrawal", amountCents: 100, note: "" }).success, false);
  assert.equal(cashCommand.safeParse({ type: "close", requestKey: randomUUID(), sessionId: randomUUID(), declaredCents: -1 }).success, false);
  assert.equal(cashCommand.safeParse({ type: "open", requestKey: randomUUID(), openingCents: 0 }).success, true);
});
