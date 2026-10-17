import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { createBusiness } from "../src/server/businesses";
import { publishStore, saveProduct, saveSettings } from "../src/server/menu";
import { getPool } from "../src/server/postgres";
import {
  advanceOrder,
  checkout,
  decideOrder,
  listOrders,
  trackOrder,
} from "../src/server/orders";
import { executeManagement, getManagementData } from "../src/server/management";
import { commandSchema } from "../src/lib/management";
import { checkoutInput } from "../src/lib/checkout";
import { productInput, settingsInput } from "../src/lib/menu";

assert.ok(
  process.env.GASTRONOMIA_ENV_FILE &&
    process.env.TEST_MANAGEMENT === "1" &&
    process.env.MANAGEMENT_TEST_HOST,
  "Use an isolated branch, GASTRONOMIA_ENV_FILE, TEST_MANAGEMENT=1 and MANAGEMENT_TEST_HOST",
);
loadEnvFile(process.env.GASTRONOMIA_ENV_FILE);
assert.equal(
  new URL(process.env.DATABASE_URL!).hostname.replace("-pooler", ""),
  process.env.MANAGEMENT_TEST_HOST,
  "Test connection must match the explicitly selected isolated endpoint",
);
assert.match(
  process.env.NEON_BRANCH ?? "",
  /^(codex-|test|dev|preview)/,
  "Use a named test/development branch",
);
const actor = `options-test-${randomUUID()}`;
const origin = "http://localhost:3000";
const slug = `opciones-${randomUUID().slice(0, 8)}`;
const run = (id: string, command: Record<string, unknown>) =>
  executeManagement(
    id,
    actor,
    commandSchema.parse({ requestKey: randomUUID(), ...command }),
    true,
  );

async function main() {
  const businessId = await createBusiness(actor, {
    name: "Rotisería de prueba · Opciones",
    slug,
    kind: "rotiseria",
    whatsapp: "+5493511234567",
    city: "Córdoba",
    address: "Datos sintéticos",
    requestKey: randomUUID(),
  });
  const item = async (name: string) =>
    String(
      (
        await run(businessId, {
          type: "item",
          name,
          kind: "ingredient",
          unit: "unit",
          minimum: "0",
          initialQuantity: "100",
          initialValueCents: "10000",
        })
      ).id,
    );
  const [carneItem, polloItem, cajaItem] = await Promise.all(
    ["Empanada de carne", "Empanada de pollo", "Caja"].map(item),
  );
  const docena = randomUUID(),
    carne = randomUUID(),
    pollo = randomUUID(),
    picante = randomUUID();
  const product = await saveProduct(
    businessId,
    productInput.parse({
      name: "Empanadas",
      category: "Empanadas",
      variants: [{ id: docena, name: "Media docena", priceCents: 600000 }],
      optionGroups: [
        {
          id: randomUUID(),
          name: "Gustos",
          min: 6,
          max: 6,
          repeat: true,
          options: [
            { id: carne, name: "Carne", priceCents: 10000 },
            { id: pollo, name: "Pollo", priceCents: 0 },
          ],
        },
        {
          id: randomUUID(),
          name: "Salsa picante",
          min: 0,
          max: 1,
          options: [{ id: picante, name: "Sí", priceCents: 0 }],
        },
      ],
    }),
  );
  assert.equal(product.optionGroups.length, 2);
  for (const [optionId, optionKind, lines] of [
    [docena, "variant", [{ itemId: cajaItem, quantity: "1" }]],
    [carne, "addon", [{ itemId: carneItem, quantity: "1" }]],
    [pollo, "addon", [{ itemId: polloItem, quantity: "1" }]],
  ] as const)
    await run(businessId, {
      type: "recipe",
      productId: product.id,
      optionId,
      optionKind,
      version: 0,
      lines,
    });
  await run(businessId, {
    type: "recipe",
    productId: product.id,
    optionId: picante,
    optionKind: "addon",
    version: 0,
    lines: [],
    noConsumption: true,
  });
  await saveSettings(
    businessId,
    settingsInput.parse({
      description: "",
      menuNote: "",
      hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        day,
        opens: "00:00",
        closes: "23:59",
      })),
      pickupEnabled: true,
      pickupInstructions: "",
      deliveryEnabled: false,
      deliveryZones: [],
      paymentMethods: ["cash"],
      transferAlias: "",
    }),
    0,
  );
  await publishStore(businessId, true);

  const order = (choiceIds: string[], quotedUnitCents: number) =>
    checkoutInput.parse({
      requestKey: randomUUID(),
      customerName: "Cliente sintético",
      customerPhone: "+5493511234567",
      fulfillment: "pickup",
      zoneId: null,
      paymentMethod: "cash",
      items: [
        {
          productId: product.id,
          variantId: docena,
          addOnIds: [],
          choiceIds,
          quantity: 2,
          quotedUnitCents,
        },
      ],
    });
  const six = [carne, carne, carne, carne, pollo, pollo];
  await assert.rejects(
    checkout(slug, order(six.slice(1), 640000), origin),
    /Elegí 6 en «Gustos»/,
  );
  await assert.rejects(
    checkout(slug, order([...six, picante, picante], 640000), origin),
    /no se puede repetir/,
  );
  await assert.rejects(
    checkout(slug, order(six, 600000), origin),
    /Cambió un precio/,
  );
  const saved = await checkout(slug, order([...six, picante], 640000), origin);
  assert.equal(saved.totalCents, 1280000);
  const message = decodeURIComponent(saved.whatsappUrl.split("text=")[1]);
  assert.match(message, /2 × Empanadas \(Media docena\): \$\s?12\.800/);
  assert.match(message, /Gustos: 4 Carne, 2 Pollo/);
  assert.match(message, /Salsa picante: Sí/);
  assert.match(
    message,
    new RegExp(`Seguimiento: ${origin}/t/${slug}/pedido/[0-9a-f]{32}`),
  );
  const [stored] = await listOrders(businessId);
  assert.deepEqual(stored.items[0].choices, [
    "Gustos: 4 Carne, 2 Pollo",
    "Salsa picante: Sí",
  ]);
  console.log(
    "PASS: checkout enforces minimum, maximum and repetition, prices choices and lists them for WhatsApp",
  );

  await decideOrder(businessId, stored.id, stored.version, "accepted", actor);
  let data = await getManagementData(businessId);
  const quantity = (id: string) =>
    data.items.find((i) => i.id === id)?.quantity;
  assert.equal(quantity(carneItem), "92.000000");
  assert.equal(quantity(polloItem), "96.000000");
  assert.equal(quantity(cajaItem), "98.000000");
  const storeSale = data.sales.find((s) => s.orderId === stored.id);
  // 8 carne + 4 pollo + 2 cajas, at $ 1 each.
  assert.equal(storeSale?.costCents, "1400");
  console.log(
    "PASS: accepting the order consumes each chosen flavor once per unit, with complete cost",
  );

  const token = saved.trackingUrl.split("/pedido/")[1];
  let [live] = await listOrders(businessId);
  assert.equal(live.stage, "preparing");
  assert.equal((await trackOrder(slug, token))?.stage, "preparing");
  assert.equal(await trackOrder(slug, "0".repeat(32)), null);
  assert.equal(await trackOrder("otra-tienda", token), null);
  await assert.rejects(
    advanceOrder(businessId, live.id, live.version, "on_the_way"),
    /no puede pasar/,
  );
  live = await advanceOrder(businessId, live.id, live.version, "ready");
  await assert.rejects(
    advanceOrder(businessId, live.id, live.version - 1, "delivered"),
    /otra pantalla/,
  );
  // Pickup orders skip "en camino".
  await assert.rejects(
    advanceOrder(businessId, live.id, live.version, "on_the_way"),
    /no puede pasar/,
  );
  live = await advanceOrder(businessId, live.id, live.version, "delivered");
  const tracked = await trackOrder(slug, token);
  assert.equal(tracked?.stage, "delivered");
  assert.equal("customerPhone" in tracked!, false);
  console.log(
    "PASS: accepted orders advance one step at a time and the tracking link shows the stage",
  );

  await assert.rejects(
    run(businessId, {
      type: "sale",
      channel: "counter",
      deliveryCents: "0",
      note: "",
      lines: [
        {
          productId: product.id,
          variantId: docena,
          addOnIds: [],
          quantity: 1,
          unitCents: "600000",
        },
      ],
    }),
    /Elegí 6 en «Gustos»/,
  );
  await run(businessId, {
    type: "sale",
    channel: "counter",
    deliveryCents: "0",
    note: "",
    lines: [
      {
        productId: product.id,
        variantId: docena,
        addOnIds: [],
        choiceIds: [pollo, pollo, pollo, pollo, pollo, pollo],
        quantity: 1,
        unitCents: "600000",
      },
    ],
  });
  data = await getManagementData(businessId);
  assert.equal(quantity(polloItem), "90.000000");
  assert.equal(quantity(carneItem), "92.000000");
  console.log(
    "PASS: counter sales require the same choices and consume their recipes",
  );
  console.log(`Fixture: ${businessId} (isolated synthetic business)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
