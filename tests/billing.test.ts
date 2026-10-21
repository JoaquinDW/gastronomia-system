import { test } from "node:test";
import assert from "node:assert/strict";
import { billingState, extendPaidUntil } from "../src/lib/billing";

const now = Date.parse("2026-10-21T15:00:00Z");
const at = (days: number) => new Date(now + days * 24 * 60 * 60 * 1000);

test("existing businesses stay exempt whatever their dates say", () => {
  assert.deepEqual(
    billingState(
      { billingExempt: true, trialEndsAt: at(-30), paidUntil: null },
      now,
    ),
    { kind: "exempt" },
  );
});

test("a new business is on trial until the trial ends", () => {
  const state = billingState(
    { billingExempt: false, trialEndsAt: at(13.5), paidUntil: null },
    now,
  );
  assert.equal(state.kind, "trial");
  assert.equal(state.kind === "trial" && state.daysLeft, 14);
});

test("an expired trial counts days since it ended", () => {
  const state = billingState(
    { billingExempt: false, trialEndsAt: at(-3.2), paidUntil: null },
    now,
  );
  assert.deepEqual(state, { kind: "expired", since: at(-3.2), daysAgo: 3 });
});

test("payment wins over trial and expires on its own date", () => {
  assert.equal(
    billingState(
      { billingExempt: false, trialEndsAt: at(5), paidUntil: at(30) },
      now,
    ).kind,
    "paid",
  );
  const lapsed = billingState(
    { billingExempt: false, trialEndsAt: at(-40), paidUntil: at(-2) },
    now,
  );
  assert.equal(lapsed.kind, "expired");
  assert.equal(lapsed.kind === "expired" && lapsed.daysAgo, 2);
});

test("no dates at all is treated as exempt", () => {
  assert.equal(
    billingState(
      { billingExempt: false, trialEndsAt: null, paidUntil: null },
      now,
    ).kind,
    "exempt",
  );
});

test("extending payment stacks on top of time already paid", () => {
  assert.equal(
    extendPaidUntil(null, 1, now).toISOString(),
    "2026-11-21T15:00:00.000Z",
  );
  assert.equal(
    extendPaidUntil(at(10), 1, now).toISOString(),
    "2026-11-30T15:00:00.000Z",
  );
  assert.equal(
    extendPaidUntil(at(-10), 1, now).toISOString(),
    "2026-11-21T15:00:00.000Z",
  );
  const jan31 = Date.parse("2027-01-31T12:00:00Z");
  assert.equal(
    extendPaidUntil(null, 1, jan31).toISOString(),
    "2027-02-28T12:00:00.000Z",
  );
});
