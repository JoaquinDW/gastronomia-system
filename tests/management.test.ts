import assert from "node:assert/strict";
import { test } from "node:test";
import {
  averageCost,
  costOf,
  decimal,
  fixed,
  formatManagementDate,
  money,
  multiply,
  operationalDate,
  pesosToCents,
  rounded,
  unitCostOf,
} from "../src/lib/management-math";
import { commandSchema } from "../src/lib/management";
test("decimal quantities, monetary rounding and large values remain exact", () => {
  assert.equal(money("123456789099"), "$ 1.234.567.890,99");
  assert.equal(
    formatManagementDate("2026-10-16T17:00:00Z", "America/Argentina/Cordoba"),
    "16/10/2026 14:00",
  );
  assert.equal(
    decimal(fixed("1234567890123456.123456")),
    "1234567890123456.123456",
  );
  assert.equal(multiply("1.25", "1000"), "1250");
  assert.equal(costOf("0.15", "10"), "2");
  assert.equal(costOf("0.15", null), null);
  assert.equal(rounded(-15n, 10n), -2n);
  assert.equal(pesosToCents("1234567890,99"), "123456789099");
  assert.throws(() => pesosToCents("1.000,50"));
});
test("weighted cost values new receipts without fabricating unknown opening costs", () => {
  assert.equal(averageCost("1000", "10", "1000", "30000"), "20");
  assert.equal(averageCost("500", null, "100", "3000"), null);
  assert.equal(averageCost("-20", "9", "100", "3000"), "30");
  assert.equal(averageCost("0", null, "0.5", "100"), "200");
  assert.equal(unitCostOf("3", "100"), "33.333333");
});
test("operational dates use local wall time and configurable cutoff", () => {
  const timezone = "America/Argentina/Cordoba";
  assert.equal(
    operationalDate(new Date("2026-10-17T04:00:00Z"), timezone, 4),
    "2026-10-16",
  );
  assert.equal(
    operationalDate(new Date("2026-10-17T07:00:00Z"), timezone, 4),
    "2026-10-17",
  );
  assert.equal(
    operationalDate(new Date("2026-01-01T03:30:00Z"), timezone, 4),
    "2025-12-31",
  );
  assert.equal(
    operationalDate(new Date("2026-10-17T04:00:00Z"), timezone, 0),
    "2026-10-17",
  );
  assert.equal(
    operationalDate(new Date("2026-03-08T07:30:00Z"), "America/New_York", 4),
    "2026-03-07",
  );
});
test("commands reject fractional monetary cents and invalid quantities", () => {
  const input = {
    type: "item",
    requestKey: "43b10a12-b1a8-44ad-a082-10a107cd129e",
    name: "Carne",
    kind: "ingredient",
    unit: "g",
    minimum: "0",
    initialQuantity: "1000",
    initialValueCents: "20000",
  };
  assert.equal(commandSchema.safeParse(input).success, true);
  assert.equal(
    commandSchema.safeParse({ ...input, initialValueCents: "1.5" }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({ ...input, initialQuantity: "-1" }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({ ...input, minimum: "1.0000001" }).success,
    false,
  );
});

// The historical quote uses all recipe components once, including extras and packaging.
import { historicalRecipeCost } from "../src/lib/management-recipe-cost";
import type { Recipe, StockItem } from "../src/lib/management";
test("historical recipe quotes respect quantity, extras, rounding and missing costs", () => {
  const item: StockItem = {
    id: "item",
    name: "Ingrediente",
    kind: "ingredient",
    unit: "g",
    minimum: "0",
    quantity: "10",
    unitCost: "3.333333",
    version: 1,
  };
  const base: Recipe = {
    id: "base",
    productId: "p",
    optionId: "v",
    optionKind: "variant",
    version: 1,
    lines: [{ itemId: "item", quantity: "100" }],
    noConsumption: false,
  };
  const addon: Recipe = {
    ...base,
    id: "addon",
    optionKind: "addon",
    optionId: "a",
    lines: [{ itemId: "item", quantity: "50" }],
  };
  const choice = { productId: "p", variantId: "v", addOnIds: ["a"] };
  const quote = historicalRecipeCost(choice, 3, [base, addon], [item]);
  assert.equal(quote?.costCents, "1500");
  assert.deepEqual(quote?.recipeIds, ["base", "addon"]);
  assert.equal(quote?.components[0].quantity, "300");
  assert.equal(historicalRecipeCost(choice, 1, [base], [item]), null);
  assert.equal(
    historicalRecipeCost(
      choice,
      1,
      [base, addon],
      [{ ...item, unitCost: null }],
    ),
    null,
  );
  assert.equal(
    historicalRecipeCost(
      { ...choice, productId: "other" },
      1,
      [base, addon],
      [item],
    ),
    null,
  );
  assert.equal(
    historicalRecipeCost(
      { ...choice, addOnIds: [] },
      1,
      [{ ...base, lines: [], noConsumption: true }],
      [],
    )?.costCents,
    "0",
  );
});
