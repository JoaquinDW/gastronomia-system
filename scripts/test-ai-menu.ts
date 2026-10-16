import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import assert from "node:assert/strict";
import { extractMenu } from "../src/server/menu-ai";
import { moneyToCents, normalizeName } from "../src/lib/menu";
if (existsSync(".env.local")) loadEnvFile(".env.local");

async function main() {
  assert.ok(
    process.env.OPENAI_API_KEY,
    "Configure OPENAI_API_KEY in .env.local to run real model evaluation",
  );
  const imagePath = process.env.MENU_TEST_IMAGE;
  assert.ok(
    imagePath && existsSync(imagePath),
    "Set MENU_TEST_IMAGE to the supplied burger menu image",
  );
  const file = new File([readFileSync(imagePath)], "burger-menu.png", {
    type: "image/png",
  });
  const result = await extractMenu([file], "");
  const products = result.draft.products;
  assert.equal(
    products.length,
    8,
    "Must detect six sandwiches, a fries portion and one two-burger promotion",
  );
  const expected: [[string, number], ...Array<[string, number]>] = [
    ["comun", 650000],
    ["especial", 850000],
    ["cheddar", 900000],
    ["doble", 1100000],
    ["lomito", 1400000],
    ["bondiola", 900000],
    ["papas", 450000],
    ["promo", 1500000],
  ];
  for (const [name, amount] of expected) {
    const match = products.find((p) => normalizeName(p.name).includes(name));
    assert.ok(match, `Missing ${name}`);
    assert.equal(
      moneyToCents(match.variants[0].price ?? ""),
      amount,
      `Wrong ${name} price`,
    );
  }
  assert.equal(
    products.find((p) => normalizeName(p.name).includes("promo"))?.kind,
    "combo",
  );
  assert.match(result.draft.globalNotes.join(" ").toLowerCase(), /papas/);
  assert.equal(result.draft.hours.length, 6);
  assert.ok(
    result.draft.hours.every(
      (h) => h.day !== 1 && h.opens === "20:00" && h.closes === "00:00",
    ),
  );
  writeFileSync(
    "/tmp/gastronomia-burger-extraction.json",
    JSON.stringify(result.draft, null, 2),
  );
  console.log(
    `PASS: supplied image -> ${result.model}; eight correct products/prices, combo, included fries and overnight hours`,
  );
  console.log(
    `Usage: ${result.inputTokens} input tokens, ${result.outputTokens} output tokens`,
  );

  const text = await extractMenu(
    [],
    "LA CASA DE PASTAS\nRavioles de ricota y nuez: bandeja 500 g $4.250,50; bandeja 1 kg $8.000.\nSorrentinos de jamón y queso: docena $6.000; media docena $3.500.\nSalsa fileto opcional para cualquier pasta + $1.200.\nLos precios son por bandeja o cantidad indicada. Sin horario publicado.",
  );
  const ravioles = text.draft.products.find((p) =>
    normalizeName(p.name).includes("raviol"),
  );
  assert.ok(ravioles);
  assert.deepEqual(
    ravioles.variants
      .map((v) => moneyToCents(v.price ?? ""))
      .sort((a, b) => (a ?? 0) - (b ?? 0)),
    [425050, 800000],
  );
  const sorrentinos = text.draft.products.find((p) =>
    normalizeName(p.name).includes("sorrentin"),
  );
  assert.ok(sorrentinos);
  assert.deepEqual(
    sorrentinos.variants
      .map((v) => moneyToCents(v.price ?? ""))
      .sort((a, b) => (a ?? 0) - (b ?? 0)),
    [350000, 600000],
  );
  assert.equal(text.draft.hours.length, 0);
  assert.ok(
    ravioles.addOns.some((a) => moneyToCents(a.price ?? "") === 120000),
  );
  console.log(
    "PASS: pasta text -> weight/count variants, exact decimal price, optional sauce and no invented hours",
  );
  const missing = await extractMenu(
    [],
    "Rotisería Las Ollas. Pollo al horno con papas: $12.500. Milanesa napolitana: consultar precio. Empanadas de carne: docena $10.000, media docena $5.500. Promo pollo + gaseosa $14.000. Delivery disponible. No se informa costo de envío.",
  );
  assert.ok(
    missing.draft.products
      .find((p) => normalizeName(p.name).includes("milanesa"))
      ?.variants.every((v) => v.price === null),
  );
  assert.ok(missing.draft.deliveryMentioned);
  assert.ok(
    missing.draft.products.find(
      (p) =>
        p.kind === "combo" &&
        p.variants.some((v) => moneyToCents(v.price ?? "") === 1400000),
    ),
  );
  console.log(
    "PASS: rotisserie text -> combination, dozen variants and unknown price left unset",
  );
  if (process.env.MENU_TEST_PDF) {
    const pdf = await extractMenu(
      [
        new File([readFileSync(process.env.MENU_TEST_PDF)], "carta.pdf", {
          type: "application/pdf",
        }),
      ],
      "",
    );
    assert.ok(pdf.draft.products.length >= 2);
    console.log("PASS: PDF -> structured menu extraction");
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Menu AI evaluation failed");
  process.exitCode = 1;
});
