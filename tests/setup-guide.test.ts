import test from "node:test";
import assert from "node:assert/strict";
import { emptySettings } from "../src/lib/menu";
import { setupSteps } from "../src/lib/setup-guide";

const base = "/panel/negocios/x";
const done = (steps: ReturnType<typeof setupSteps>) =>
  steps.filter((s) => s.done).map((s) => s.key);

test("un local recién creado arranca sin pasos hechos", () => {
  const steps = setupSteps({
    base,
    products: [],
    settings: emptySettings,
    hasOrders: false,
    aiAvailable: true,
  });
  assert.deepEqual(done(steps), []);
  assert.equal(steps[0].href, `${base}/carta`);
  assert.match(steps[0].why, /foto o un PDF/);
});

test("retiro por defecto no cuenta hasta guardar la tienda", () => {
  const steps = setupSteps({
    base,
    products: [],
    settings: { ...emptySettings, pickupEnabled: true, version: 0 },
    hasOrders: false,
    aiAvailable: false,
  });
  assert.equal(steps.find((s) => s.key === "delivery")?.done, false);
});

test("fotos alcanzan con la mitad de la carta", () => {
  const products = [
    { imageUrl: "/api/media/a", isAvailable: true },
    { imageUrl: "", isAvailable: true },
    { imageUrl: "", isAvailable: true },
  ];
  const photos = (n: number) =>
    setupSteps({
      base,
      products: products.map((p, i) => ({ ...p, imageUrl: i < n ? "x" : "" })),
      settings: emptySettings,
      hasOrders: false,
      aiAvailable: false,
    }).find((s) => s.key === "photos");
  assert.equal(photos(1)?.done, false);
  assert.equal(photos(1)?.detail, "1 de 3 con foto.");
  assert.equal(photos(2)?.done, true);
});

test("un local publicado con pedidos tiene todo hecho", () => {
  const steps = setupSteps({
    base,
    products: [{ imageUrl: "x", isAvailable: true }],
    settings: {
      ...emptySettings,
      coverImageUrl: "/api/media/c",
      hours: [{ day: 1, opens: "19:00", closes: "23:30" }],
      deliveryEnabled: true,
      deliveryZones: [
        {
          id: "00000000-0000-4000-8000-000000000000",
          name: "Centro",
          feeCents: 100000,
          minimumCents: 0,
        },
      ],
      isPublished: true,
      version: 3,
    },
    hasOrders: true,
    aiAvailable: false,
  });
  assert.equal(steps.every((s) => s.done), true);
  assert.equal(steps.find((s) => s.key === "delivery")?.detail, "Retiro y delivery.");
});
