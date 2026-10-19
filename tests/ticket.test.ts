import { test } from "node:test";
import assert from "node:assert/strict";
import { autoPrintDocs, groupByCategory, ticketConfigInput } from "../src/lib/ticket";
import type { OrderItem } from "../src/lib/checkout";

const item = (name: string, productId?: string): OrderItem => ({
  productId, name, variant: "Única", addOns: [], quantity: 1, unitCents: 100, lineCents: 100,
});

test("groups order lines by category in menu order", () => {
  const groups = groupByCategory(
    [item("Batido", "b"), item("Viejo", "gone"), item("Combo", "c"), item("Otro batido", "b2")],
    [{ id: "c", category: "Combos" }, { id: "b", category: "Batidos" }, { id: "b2", category: "Batidos" }],
  );
  assert.deepEqual(
    groups.map(g => [g.category, g.items.map(i => i.name)]),
    [["Combos", ["Combo"]], ["Batidos", ["Batido", "Otro batido"]], ["Otros", ["Viejo"]]],
  );
});

test("auto-print only adds the ticket when the business turned it on", () => {
  assert.deepEqual(autoPrintDocs("both", true), ["comanda", "ticket"]);
  assert.deepEqual(autoPrintDocs("both", false), ["comanda"]);
  assert.deepEqual(autoPrintDocs("ticket", false), []);
  assert.deepEqual(autoPrintDocs("off", true), []);
});

test("ticket settings reject unknown paper and long footers", () => {
  assert.equal(ticketConfigInput.safeParse({ enabled: true, paper: "80", footer: " Gracias " }).data?.footer, "Gracias");
  assert.equal(ticketConfigInput.safeParse({ enabled: true, paper: "110", footer: "" }).success, false);
  assert.equal(ticketConfigInput.safeParse({ enabled: true, paper: "58", footer: "x".repeat(201) }).success, false);
});
