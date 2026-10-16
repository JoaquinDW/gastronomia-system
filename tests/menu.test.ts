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
