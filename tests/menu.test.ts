import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  hoursOverlap,
  isStoreOpen,
  moneyToCents,
  settingsInput,
  emptySettings,
  productInput,
  productImage,
  resolveChoices,
  groupRule,
} from "../src/lib/menu";

test("Argentine and decimal prices preserve the exact cent amount", () => {
  for (const [input, cents] of [
    ["$6.500", 650000],
    ["11.000", 1100000],
    ["4.500", 450000],
    ["1.250,50", 125050],
    ["1,250.50", 125050],
    ["6500.50", 650050],
    ["6500", 650000],
    ["0", 0],
  ] as const)
    assert.equal(moneyToCents(input), cents, input);
  for (const bad of [
    "",
    "-2",
    "1e4",
    "$6.500 o 7.000",
    "12,3456",
    "1.000.00.0",
  ])
    assert.equal(moneyToCents(bad), null, bad);
});
test("overnight hours stay open after midnight and wrap from Saturday to Sunday", () => {
  const hours = [{ day: 6, opens: "20:00", closes: "01:00" }];
  assert.equal(isStoreOpen(hours, new Date("2026-10-18T03:30:00Z")), true); // Sunday 00:30 Argentina
  assert.equal(isStoreOpen(hours, new Date("2026-10-18T04:00:00Z")), false);
  assert.equal(isStoreOpen(hours, new Date("2026-10-17T22:59:00Z")), false);
  assert.equal(isStoreOpen(hours, new Date("2026-10-17T23:00:00Z")), true);
});
test("split shifts and overlap across midnight are validated as weekly intervals", () => {
  assert.equal(
    hoursOverlap([
      { day: 2, opens: "12:00", closes: "15:00" },
      { day: 2, opens: "20:00", closes: "00:00" },
    ]),
    false,
  );
  assert.equal(
    hoursOverlap([
      { day: 6, opens: "23:00", closes: "02:00" },
      { day: 0, opens: "01:00", closes: "03:00" },
    ]),
    true,
  );
  assert.equal(
    hoursOverlap([
      { day: 2, opens: "20:00", closes: "22:00" },
      { day: 2, opens: "22:00", closes: "23:00" },
    ]),
    false,
  );
});
test("transfer setup and zone uniqueness are checked before storing configuration", () => {
  const { isPublished, version, ...settings } = emptySettings;
  void isPublished;
  void version;
  assert.equal(
    settingsInput.safeParse({
      ...settings,
      paymentMethods: ["transfer"],
      transferAlias: "",
    }).success,
    false,
  );
  assert.equal(
    settingsInput.safeParse({
      ...settings,
      paymentMethods: ["transfer"],
      transferAlias: "MI.LOCAL.ALIAS",
    }).success,
    true,
  );
  assert.equal(
    settingsInput.safeParse({
      ...settings,
      deliveryZones: [
        { id: randomUUID(), name: "Centro", feeCents: 10000, minimumCents: 0 },
        {
          id: randomUUID(),
          name: " centro ",
          feeCents: 20000,
          minimumCents: 0,
        },
      ],
    }).success,
    false,
  );
});
test("product photos accept uploaded media or HTTPS links only", () => {
  const base = {
    name: "Doble cheddar",
    category: "Hamburguesas",
    variants: [{ id: randomUUID(), name: "Única", priceCents: 650000 }],
  };
  const uploaded = `/api/media/${randomUUID()}`;
  for (const imageUrl of ["", uploaded, "https://example.com/burger.jpg"])
    assert.equal(
      productInput.safeParse({ ...base, imageUrl }).success,
      true,
      imageUrl,
    );
  for (const imageUrl of [
    "http://example.com/burger.jpg",
    "/api/media/not-a-uuid",
    `/api/media/${randomUUID()}/../x`,
    "javascript:alert(1)",
  ])
    assert.equal(
      productInput.safeParse({ ...base, imageUrl }).success,
      false,
      imageUrl,
    );
  assert.deepEqual(productImage(uploaded), {
    src: `${uploaded}?size=small`,
    srcSet: `${uploaded}?size=small 800w, ${uploaded} 1600w`,
    large: uploaded,
  });
  assert.deepEqual(productImage("https://example.com/a.jpg"), {
    src: "https://example.com/a.jpg",
    large: "https://example.com/a.jpg",
  });
});
test("store cover accepts uploaded or HTTPS photos and a focus point", () => {
  const { isPublished, version, coverImageUrl, ...settings } = emptySettings;
  void isPublished;
  void version;
  void coverImageUrl;
  const parsed = settingsInput.parse(settings);
  assert.equal(parsed.coverImageUrl, "");
  assert.equal(parsed.coverFocusX, 50);
  for (const [url, ok] of [
    [`/api/media/${randomUUID()}`, true],
    ["https://example.com/portada.jpg", true],
    ["http://example.com/portada.jpg", false],
    ["javascript:alert(1)", false],
  ] as const)
    assert.equal(
      settingsInput.safeParse({ ...settings, coverImageUrl: url }).success,
      ok,
      url,
    );
  assert.equal(
    settingsInput.safeParse({ ...settings, coverFocusY: 101 }).success,
    false,
  );
});

test("option groups validate their rules before saving the product", () => {
  const option = (name: string, priceCents = 0) => ({
    id: randomUUID(),
    name,
    priceCents,
  });
  const base = {
    name: "Ravioles",
    category: "Pastas",
    variants: [{ id: randomUUID(), name: "Única", priceCents: 900000 }],
  };
  const group = {
    id: randomUUID(),
    name: "Elegí la salsa",
    min: 1,
    max: 1,
    options: [option("Fileto"), option("Bolognesa", 150000)],
  };
  const parsed = productInput.parse({ ...base, optionGroups: [group] });
  assert.equal(parsed.optionGroups[0].repeat, false);
  assert.deepEqual(productInput.parse(base).optionGroups, []);
  for (const bad of [
    { ...group, min: 2, max: 1 },
    { ...group, max: 3 },
    { ...group, options: [] },
    {
      ...group,
      options: [group.options[0], { ...group.options[1], name: "fileto" }],
    },
  ])
    assert.equal(
      productInput.safeParse({ ...base, optionGroups: [bad] }).success,
      false,
    );
  assert.equal(
    productInput.safeParse({
      ...base,
      optionGroups: [{ ...group, max: 3, repeat: true }],
    }).success,
    true,
  );
  // Choice ids share recipes with add-ons, so they cannot collide.
  assert.equal(
    productInput.safeParse({
      ...base,
      addOns: [group.options[0]],
      optionGroups: [group],
    }).success,
    false,
  );
  assert.equal(groupRule({ min: 1, max: 1 }), "Elegí 1");
  assert.equal(groupRule({ min: 0, max: 3 }), "Elegí hasta 3");
  assert.equal(groupRule({ min: 2, max: 4 }), "Elegí entre 2 y 4");
});

test("choices respect minimum, maximum and repetition and add their price", () => {
  const [carne, pollo, verdura] = ["Carne", "Pollo", "Verdura"].map((name) => ({
    id: randomUUID(),
    name,
    priceCents: name === "Carne" ? 10000 : 0,
  }));
  const [fileto, crema] = ["Fileto", "Crema"].map((name) => ({
    id: randomUUID(),
    name,
    priceCents: 0,
  }));
  const product = {
    optionGroups: [
      {
        id: randomUUID(),
        name: "Gustos",
        min: 6,
        max: 6,
        repeat: true,
        options: [carne, pollo, verdura],
      },
      {
        id: randomUUID(),
        name: "Salsa",
        min: 0,
        max: 1,
        repeat: false,
        options: [fileto, crema],
      },
    ],
  };
  const picks = [carne.id, carne.id, carne.id, pollo.id, pollo.id, verdura.id];
  const ok = resolveChoices(product, picks);
  assert.deepEqual(ok, {
    ok: true,
    value: { cents: 30000, labels: ["Gustos: 3 Carne, 2 Pollo, Verdura"] },
  });
  const withSauce = resolveChoices(product, [...picks, fileto.id]);
  assert.equal(withSauce.ok && withSauce.value.labels[1], "Salsa: Fileto");
  const missing = resolveChoices(product, picks.slice(1));
  assert.equal(missing.ok, false);
  assert.equal(!missing.ok && missing.message, "Elegí 6 en «Gustos».");
  assert.equal(resolveChoices(product, [...picks, carne.id]).ok, false);
  assert.equal(
    resolveChoices(product, [...picks, fileto.id, crema.id]).ok,
    false,
  );
  const stale = resolveChoices(product, [...picks.slice(1), randomUUID()]);
  assert.equal(!stale.ok && stale.stale, true);
  // Without repeat the same option cannot be picked twice.
  const twice = resolveChoices(
    { optionGroups: [{ ...product.optionGroups[1], max: 2 }] },
    [fileto.id, fileto.id],
  );
  assert.equal(twice.ok, false);
  // Products without groups accept no choices at all.
  assert.deepEqual(resolveChoices({ optionGroups: [] }, []), {
    ok: true,
    value: { cents: 0, labels: [] },
  });
});
