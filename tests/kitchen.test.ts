import { test } from "node:test";
import assert from "node:assert/strict";
import {
  byUrgency,
  kitchenConfigInput,
  orderTiming,
  timingLabel,
  type KitchenConfig,
} from "../src/lib/kitchen";

const config: KitchenConfig = { defaultMinutes: 20, warnMinutes: 5 };
const t0 = Date.parse("2026-10-19T20:00:00Z");
const at = (min: number) => new Date(t0 + min * 60_000).toISOString();
const order = (over: Record<string, unknown> = {}) => ({
  status: "accepted",
  stage: "preparing" as const,
  acceptedAt: at(0),
  estimatedReadyAt: at(15) as string | null,
  createdAt: at(-2),
  ...over,
});

test("colors an order against the time promised on accepting it", () => {
  const now = (min: number) => t0 + min * 60_000;
  assert.equal(orderTiming(order(), config, now(5))?.light, "ok");
  assert.equal(orderTiming(order(), config, now(10))?.light, "soon");
  assert.equal(orderTiming(order(), config, now(14.9))?.light, "soon");
  assert.equal(orderTiming(order(), config, now(15))?.light, "late");
  const late = orderTiming(order(), config, now(22.5))!;
  assert.deepEqual([late.elapsed, late.left, timingLabel(late)], [22, -7, "7 min tarde"]);
  const ok = orderTiming(order(), config, now(3.2))!;
  assert.deepEqual([ok.left, timingLabel(ok), ok.assumed], [12, "Faltan 12 min", false]);
  // Just past the promise already reads as one minute late.
  assert.equal(timingLabel(orderTiming(order(), config, now(15.1))!), "1 min tarde");
});

test("falls back to the business default when there was no estimate", () => {
  const t = orderTiming(order({ estimatedReadyAt: null }), config, t0 + 16 * 60_000)!;
  assert.deepEqual([t.light, t.left, t.assumed], ["soon", 4, true]);
  const longer = orderTiming(order({ estimatedReadyAt: null }), { ...config, defaultMinutes: 40 }, t0 + 16 * 60_000)!;
  assert.equal(longer.light, "ok");
});

test("only times orders the kitchen is still preparing", () => {
  assert.equal(orderTiming(order({ stage: "ready" }), config, t0), null);
  assert.equal(orderTiming(order({ status: "pending_confirmation", stage: null }), config, t0), null);
  assert.equal(orderTiming(order({ acceptedAt: null }), config, t0), null);
});

test("sorts the most urgent first, then untimed orders by arrival", () => {
  const list = [
    { id: "ready", ...order({ stage: "ready", createdAt: at(-30) }) },
    { id: "relaxed", ...order({ estimatedReadyAt: at(40) }) },
    { id: "late", ...order({ estimatedReadyAt: at(5) }) },
    { id: "pending", ...order({ status: "pending_confirmation", stage: null, createdAt: at(-1) }) },
  ];
  assert.deepEqual(
    byUrgency(list, config, t0 + 10 * 60_000).map((o) => o.id),
    ["late", "relaxed", "ready", "pending"],
  );
});

test("kitchen settings stay within sensible minutes", () => {
  assert.equal(kitchenConfigInput.safeParse({ defaultMinutes: 25, warnMinutes: 5 }).success, true);
  assert.equal(kitchenConfigInput.safeParse({ defaultMinutes: 2, warnMinutes: 5 }).success, false);
  assert.equal(kitchenConfigInput.safeParse({ defaultMinutes: 20, warnMinutes: 0 }).success, false);
  assert.equal(kitchenConfigInput.safeParse({ defaultMinutes: 20, warnMinutes: 5, extra: 1 }).success, false);
});
