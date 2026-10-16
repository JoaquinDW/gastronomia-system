import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createBusiness } from "../src/server/businesses";
import { saveProduct } from "../src/server/menu";
import { getPool } from "../src/server/postgres";
import {
  executeManagement,
  getManagementData,
  saleConsumptions,
} from "../src/server/management";
import {
  csv,
  getManagementReport,
  reportRange,
} from "../src/server/management-reports";
import { commandSchema } from "../src/lib/management";
import { decideOrder } from "../src/server/orders";

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
assert.notEqual(
  process.env.NEON_BRANCH,
  "production",
  "Never run business fixtures in production",
);
assert.match(
  process.env.NEON_BRANCH ?? "",
  /^(codex-|test|dev|preview)/,
  "Use a named test/development branch",
);
const actor = `management-test-${randomUUID()}`;
const pool = getPool();
const slug = `gestion-${randomUUID().slice(0, 8)}`;
const run = (id: string, command: Record<string, unknown>, owner = true) =>
  executeManagement(
    id,
    actor,
    commandSchema.parse({ requestKey: randomUUID(), ...command }),
    owner,
  );
async function main() {
  const businessId = await createBusiness(actor, {
    name: "Local de prueba · Gestión",
    slug,
    kind: "hamburgueseria",
    whatsapp: "+5493511234567",
    city: "Córdoba",
    address: "Datos sintéticos",
    requestKey: randomUUID(),
  });
  const otherId = await createBusiness(actor, {
    name: "Otro local de prueba",
    slug: `${slug}-otro`,
    kind: "otro",
    whatsapp: "+5493511234568",
    city: "Córdoba",
    address: "",
    requestKey: randomUUID(),
  });
  const meat = String(
    (
      await run(businessId, {
        type: "item",
        name: "Carne picada",
        kind: "ingredient",
        unit: "g",
        minimum: "500",
        initialQuantity: "1000",
        initialValueCents: "10000",
      })
    ).id,
  );
  const bread = String(
    (
      await run(businessId, {
        type: "item",
        name: "Pan de papa",
        kind: "ingredient",
        unit: "unit",
        minimum: "5",
        initialQuantity: "10",
        initialValueCents: "1000",
      })
    ).id,
  );
  const cheese = String(
    (
      await run(businessId, {
        type: "item",
        name: "Cheddar",
        kind: "ingredient",
        unit: "g",
        minimum: "100",
        initialQuantity: "500",
        initialValueCents: "5000",
      })
    ).id,
  );
  const finished = String(
    (
      await run(businessId, {
        type: "item",
        name: "Medallones preparados",
        kind: "finished",
        unit: "unit",
        minimum: "2",
      })
    ).id,
  );
  const supplier = String(
    (
      await run(businessId, {
        type: "supplier",
        name: "Proveedor de prueba",
        contact: "351 555 0000",
        note: "Datos sintéticos",
      })
    ).id,
  );
  const variant = randomUUID(),
    addon = randomUUID();
  const product = await saveProduct(businessId, {
    name: "Burger de prueba",
    description: "",
    category: "Hamburguesas",
    kind: "product",
    variants: [{ id: variant, name: "Simple", priceCents: 500000 }],
    addOns: [{ id: addon, name: "Extra cheddar", priceCents: 50000 }],
    imageUrl: "",
    isAvailable: true,
    sortOrder: 0,
  });
  await run(businessId, {
    type: "recipe",
    productId: product.id,
    optionId: variant,
    optionKind: "variant",
    version: 0,
    lines: [
      { itemId: meat, quantity: "100" },
      { itemId: bread, quantity: "1" },
    ],
  });
  await run(businessId, {
    type: "recipe",
    productId: product.id,
    optionId: addon,
    optionKind: "addon",
    version: 0,
    lines: [{ itemId: cheese, quantity: "10" }],
  });
  const purchase = commandSchema.parse({
    type: "purchase",
    requestKey: randomUUID(),
    supplierId: supplier,
    note: "Compra por kg",
    lines: [{ itemId: meat, quantity: "1", unit: "kg", totalCents: "30000" }],
  });
  const bought = await executeManagement(businessId, actor, purchase, true);
  assert.deepEqual(
    await executeManagement(businessId, actor, purchase, true),
    bought,
  );
  await assert.rejects(
    executeManagement(
      businessId,
      actor,
      commandSchema.parse({ ...purchase, note: "Otro payload" }),
      true,
    ),
    /otros datos/,
  );
  let data = await getManagementData(businessId);
  assert.equal(data.items.find((i) => i.id === meat)?.quantity, "2000.000000");
  assert.equal(data.items.find((i) => i.id === meat)?.unitCost, "20.000000");
  console.log("PASS: kg conversion, weighted average and purchase replay");
  const saleCommand = {
    type: "sale",
    channel: "counter",
    deliveryCents: "0",
    note: "",
    lines: [
      {
        productId: product.id,
        variantId: variant,
        addOnIds: [addon],
        quantity: 2,
        unitCents: "500000",
      },
    ],
  };
  const sale = await run(businessId, saleCommand),
    saleId = String(sale.id);
  data = await getManagementData(businessId);
  assert.equal(data.sales.find((s) => s.id === saleId)?.costCents, "4400");
  assert.equal(data.items.find((i) => i.id === meat)?.quantity, "1800.000000");
  const consumed = await saleConsumptions(businessId, saleId);
  await run(businessId, {
    type: "purchase",
    supplierId: null,
    note: "",
    lines: [{ itemId: meat, quantity: "1", unit: "kg", totalCents: "50000" }],
  });
  assert.equal(
    (await getManagementData(businessId)).sales.find((s) => s.id === saleId)
      ?.costCents,
    "4400",
  );
  const recoveries = consumed.map((m) => ({
    movementId: m.id,
    quantity: m.itemId === meat ? "100" : m.itemId === bread ? "1" : "0",
  }));
  await run(businessId, {
    type: "cancel_sale",
    saleId,
    reason: "Recuperación parcial de prueba",
    recoveries,
  });
  await assert.rejects(
    run(businessId, {
      type: "cancel_sale",
      saleId,
      reason: "Segundo intento",
      recoveries,
    }),
    /ya está anulada/,
  );
  let report = await getManagementReport(businessId);
  assert.equal(report.totals.revenue, "0");
  assert.equal(report.totals.cost, "0");
  assert.equal(report.totals.waste, "2300");
  assert.equal(report.totals.result, "-2300");
  console.log(
    "PASS: recipe + add-on consumption, historical costs and partial cancellation without double waste",
  );
  data = await getManagementData(businessId);
  const beforeBatch = data.items.find((i) => i.id === meat)!.quantity;
  await run(businessId, {
    type: "production",
    outputItemId: finished,
    outputQuantity: "3",
    lines: [{ itemId: meat, quantity: "300" }],
    note: "Tanda de prueba",
  });
  data = await getManagementData(businessId);
  const afterBatch = data.items.find((i) => i.id === meat)!.quantity;
  assert.equal(Number(beforeBatch) - Number(afterBatch), 300);
  const preparedVariant = randomUUID();
  const prepared = await saveProduct(businessId, {
    ...product,
    name: "Medallón de prueba",
    variants: [{ id: preparedVariant, name: "Unidad", priceCents: 300000 }],
    addOns: [],
  });
  await run(businessId, {
    type: "recipe",
    productId: prepared.id,
    optionId: preparedVariant,
    optionKind: "variant",
    version: 0,
    lines: [{ itemId: finished, quantity: "1" }],
  });
  await run(businessId, {
    type: "sale",
    channel: "whatsapp",
    lines: [
      {
        productId: prepared.id,
        variantId: preparedVariant,
        addOnIds: [],
        quantity: 5,
        unitCents: "300000",
      },
    ],
  });
  data = await getManagementData(businessId);
  assert.equal(data.items.find((i) => i.id === meat)!.quantity, afterBatch);
  assert.equal(
    data.items.find((i) => i.id === finished)!.quantity,
    "-2.000000",
  );
  console.log(
    "PASS: production consumes once, finished sale does not repeat ingredients, negative stock allowed",
  );
  const count = (
    await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM management_operations WHERE business_id=$1",
      [businessId],
    )
  ).rows[0].count;
  await assert.rejects(
    run(businessId, {
      type: "production",
      outputItemId: finished,
      outputQuantity: "2",
      lines: [
        { itemId: meat, quantity: "10" },
        { itemId: randomUUID(), quantity: "1" },
      ],
    }),
    /no pertenece/,
  );
  assert.equal(
    (
      await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM management_operations WHERE business_id=$1",
        [businessId],
      )
    ).rows[0].count,
    count,
  );
  assert.equal(
    (await getManagementData(businessId)).items.find((i) => i.id === meat)!
      .quantity,
    afterBatch,
  );
  await assert.rejects(
    run(otherId, {
      type: "purchase",
      supplierId: null,
      lines: [{ itemId: meat, quantity: "1", unit: "g", totalCents: "20" }],
    }),
    /no pertenece/,
  );
  await assert.rejects(
    run(
      businessId,
      {
        type: "expense",
        date: data.today,
        category: "Otros",
        amountCents: "100",
        concept: "Prueba de permiso",
        supplierId: null,
      },
      false,
    ),
    /Solo el propietario/,
  );
  assert.equal(
    (await getManagementData(businessId, { owner: false })).expenses.length,
    0,
  );
  console.log(
    "PASS: rollback, cross-business resources and manager expense restrictions",
  );
  const requestKey = randomUUID(),
    concurrent = commandSchema.parse({ ...saleCommand, requestKey });
  const results = await Promise.all([
    executeManagement(businessId, actor, concurrent, true),
    executeManagement(businessId, actor, concurrent, true),
  ]);
  assert.equal(results[0].id, results[1].id);
  const unknownVariant = randomUUID();
  const unknownProduct = await saveProduct(businessId, {
    ...product,
    name: "Sin receta de prueba",
    variants: [{ id: unknownVariant, name: "Unidad", priceCents: 100000 }],
    addOns: [],
  });
  await run(businessId, {
    type: "sale",
    channel: "other",
    lines: [
      {
        productId: unknownProduct.id,
        variantId: unknownVariant,
        addOnIds: [],
        quantity: 1,
        unitCents: "100000",
      },
    ],
  });
  report = await getManagementReport(businessId);
  assert.equal(report.totals.result, null);
  const expense = await run(businessId, {
    type: "expense",
    date: data.today,
    category: "Servicios",
    amountCents: "10000",
    concept: "Servicio de prueba",
    supplierId: supplier,
  });
  assert.equal(
    (await getManagementReport(businessId)).totals.expenses,
    "10000",
  );
  await run(businessId, {
    type: "reverse_expense",
    expenseId: expense.id,
    reason: "Gasto duplicado de prueba",
  });
  assert.equal((await getManagementReport(businessId)).totals.expenses, "0");
  console.log(
    "PASS: concurrent retries, unknown costs suppress profit, expense compensations",
  );
  const orderId = randomUUID();
  await pool.query(
    `INSERT INTO orders(id,business_id,number,request_key,payload_hash,customer_name,customer_phone,fulfillment,payment_method,items,subtotal_cents,delivery_cents,total_cents) VALUES($1,$2,1,$3,\u0027test\u0027,\u0027Cliente sintético\u0027,\u0027+5493511234567\u0027,\u0027pickup\u0027,\u0027cash\u0027,$4,500000,0,500000)`,
    [
      orderId,
      businessId,
      randomUUID(),
      JSON.stringify([
        {
          productId: product.id,
          variantId: variant,
          addOnIds: [],
          name: product.name,
          variant: "Simple",
          addOns: [],
          quantity: 1,
          unitCents: 500000,
          lineCents: 500000,
        },
      ]),
    ],
  );
  await decideOrder(businessId, orderId, 1, "accepted", actor);
  await assert.rejects(
    decideOrder(businessId, orderId, 1, "accepted", actor),
    /ya fue atendido/,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM management_sales WHERE business_id=$1 AND order_id=$2",
        [businessId, orderId],
      )
    ).rowCount,
    1,
  );
  console.log(
    "PASS: order acceptance persists exactly one sale and rejects stale version",
  );
  const original = (await getManagementReport(businessId)).totals.revenue;
  await pool.query(
    `WITH ops AS (INSERT INTO management_operations(business_id,request_key,payload_hash,type,operational_date,actor_id,payload) SELECT $1,gen_random_uuid(),\u0027test\u0027,\u0027sale\u0027,$2,$3,\u0027{}\u0027::jsonb FROM generate_series(1,120) RETURNING id,business_id) INSERT INTO management_sales(business_id,location_id,operation_id,channel,total_cents,delivery_cents,cost_cents,known_cost_cents,cost_complete,lines,operational_date) SELECT business_id,(SELECT id FROM locations WHERE business_id=$1 LIMIT 1),id,\u0027counter\u0027,100,0,0,0,true,\u0027[]\u0027::jsonb,$2 FROM ops`,
    [businessId, data.today, actor],
  );
  report = await getManagementReport(businessId);
  assert.equal(BigInt(report.totals.revenue) - BigInt(original), 12000n);
  assert.equal((await getManagementData(businessId)).sales.length, 50);
  assert.equal((await getManagementData(businessId)).salesHasMore, true);
  assert.match(
    csv([["=2+2", "Texto; con separador", "a\u0022b"]]),
    /\u0027=2\+2/,
  );
  assert.throws(
    () => reportRange("2026-10-20", "2026-10-01", data.today),
    /fechas/,
  );
  assert.throws(() => reportRange("2020-01-01", data.today, data.today), /366/);
  const unvalued = String(
    (
      await run(businessId, {
        type: "item",
        name: "Insumo sin valor de prueba",
        kind: "ingredient",
        unit: "g",
        minimum: "0",
        initialQuantity: "100",
      })
    ).id,
  );
  await run(businessId, {
    type: "purchase",
    supplierId: null,
    lines: [
      { itemId: unvalued, quantity: "100", unit: "g", totalCents: "1000" },
    ],
  });
  let unvaluedItem = (await getManagementData(businessId)).items.find(
    (i) => i.id === unvalued,
  )!;
  assert.equal(unvaluedItem.unitCost, null);
  await run(businessId, {
    type: "adjustment",
    itemId: unvalued,
    version: unvaluedItem.version,
    mode: "count",
    quantity: "200",
    totalValueCents: "2000",
    reason: "Conteo valorizado de prueba",
  });
  await assert.rejects(
    run(businessId, {
      type: "adjustment",
      itemId: unvalued,
      version: unvaluedItem.version,
      mode: "count",
      quantity: "100",
      reason: "Conteo desactualizado",
    }),
    /otra pantalla/,
  );
  unvaluedItem = (await getManagementData(businessId)).items.find(
    (i) => i.id === unvalued,
  )!;
  assert.equal(unvaluedItem.unitCost, "10.000000");
  const beforeWaste = BigInt(
    (await getManagementReport(businessId)).totals.waste,
  );
  await run(businessId, {
    type: "adjustment",
    itemId: unvalued,
    version: unvaluedItem.version,
    mode: "waste",
    quantity: "10",
    reason: "Pérdida de prueba",
  });
  assert.equal(
    BigInt((await getManagementReport(businessId)).totals.waste) - beforeWaste,
    100n,
  );
  await run(businessId, {
    type: "recipe",
    productId: product.id,
    optionId: variant,
    optionKind: "variant",
    version: 1,
    lines: [{ itemId: meat, quantity: "200" }],
  });
  assert.equal(
    (
      await pool.query<{ cost: string }>(
        "SELECT cost_cents AS cost FROM management_sales WHERE business_id=$1 AND id=$2",
        [businessId, saleId],
      )
    ).rows[0].cost,
    "4400",
  );
  console.log(
    "PASS: unknown opening value stays unknown, counted valuation, stale counts, explicit waste and recipe revision preserve history",
  );
  const beforeLegacy = await getManagementReport(otherId);
  const beforeLegacyStock = (await getManagementData(otherId)).items;
  await pool.query(
    `INSERT INTO orders(business_id,number,request_key,payload_hash,status,customer_name,customer_phone,fulfillment,payment_method,items,subtotal_cents,delivery_cents,total_cents) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,$9,10000,0,10000)`,
    [
      otherId,
      randomUUID(),
      "legacy-test",
      "accepted",
      "Cliente histórico sintético",
      "+5493511234567",
      "pickup",
      "cash",
      JSON.stringify([
        {
          name: "Producto histórico",
          variant: "Unidad",
          addOns: [],
          quantity: 1,
          unitCents: 10000,
          lineCents: 10000,
        },
      ]),
    ],
  );
  const legacy = await getManagementReport(otherId);
  assert.equal(
    BigInt(legacy.totals.revenue) - BigInt(beforeLegacy.totals.revenue),
    10000n,
  );
  assert.equal(legacy.legacyCount, 1);
  assert.equal(legacy.totals.result, null);
  assert.deepEqual((await getManagementData(otherId)).items, beforeLegacyStock);
  console.log(
    "PASS: legacy accepted orders remain visible without guessed costs or retroactive inventory",
  );
  assert.equal(legacy.legacyPendingCount, 1);
  assert.equal(legacy.historicalOrders.length, 1);
  const historicalOrderId = legacy.historicalOrders[0].id;
  const historicalIngredient = String(
    (
      await run(otherId, {
        type: "item",
        name: "Insumo histórico",
        kind: "ingredient",
        unit: "g",
        minimum: "0",
        initialQuantity: "1000",
        initialValueCents: "10000",
      })
    ).id,
  );
  const historicalVariant = randomUUID();
  const historicalAddon = randomUUID();
  const historicalProduct = await saveProduct(otherId, {
    name: "Nombre actual distinto",
    description: "",
    category: "Prueba",
    kind: "product",
    variants: [{ id: historicalVariant, name: "Actual", priceCents: 10000 }],
    addOns: [{ id: historicalAddon, name: "Extra", priceCents: 1000 }],
    imageUrl: "",
    isAvailable: true,
    sortOrder: 0,
  });
  const selection = {
    lineIndex: 0,
    productId: historicalProduct.id,
    variantId: historicalVariant,
    addOnIds: [historicalAddon],
    expectedCostCents: "1500",
  };
  const historicalCommand = {
    type: "historical_cost",
    orderId: historicalOrderId,
    lines: [selection],
  };
  await assert.rejects(
    () => run(otherId, historicalCommand, false),
    /propietario/,
  );
  await assert.rejects(
    () => run(businessId, historicalCommand),
    /pedido anterior/,
  );
  await assert.rejects(
    () =>
      run(otherId, {
        ...historicalCommand,
        lines: [
          {
            ...selection,
            productId: product.id,
            variantId: variant,
            addOnIds: [],
          },
        ],
      }),
    /carta de este negocio/,
  );
  await assert.rejects(
    () => run(otherId, historicalCommand),
    /faltan ingredientes/,
  );
  await run(otherId, {
    type: "recipe",
    productId: historicalProduct.id,
    optionId: historicalVariant,
    optionKind: "variant",
    version: 0,
    lines: [{ itemId: historicalIngredient, quantity: "100" }],
  });
  await run(otherId, {
    type: "recipe",
    productId: historicalProduct.id,
    optionId: historicalAddon,
    optionKind: "addon",
    version: 0,
    lines: [{ itemId: historicalIngredient, quantity: "50" }],
  });
  await assert.rejects(
    () => run(otherId, { ...historicalCommand, lines: [selection, selection] }),
    /sin repetir/,
  );
  await assert.rejects(
    () =>
      run(otherId, {
        ...historicalCommand,
        lines: [{ ...selection, expectedCostCents: "1" }],
      }),
    /costos cambiaron/,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM management_operations WHERE business_id=$1 AND type='historical_cost'",
        [otherId],
      )
    ).rows[0].n,
    0,
  );
  const stockBeforeHistoricalCost = (await getManagementData(otherId)).items;
  const movementsBeforeHistoricalCost = (await getManagementData(otherId))
    .movements;
  const request = commandSchema.parse({
    ...historicalCommand,
    requestKey: randomUUID(),
  });
  const concurrentCosts = await Promise.all([
    executeManagement(otherId, actor, request, true),
    executeManagement(otherId, actor, request, true),
  ]);
  assert.deepEqual(concurrentCosts[0], concurrentCosts[1]);
  await assert.rejects(
    () => run(otherId, historicalCommand),
    /ya está guardado/,
  );
  const completed = await getManagementReport(otherId);
  assert.equal(completed.legacyPendingCount, 0);
  assert.equal(completed.legacyEstimatedCount, 1);
  assert.equal(completed.historicalOrders.length, 0);
  assert.equal(completed.totals.result, "8500");
  assert.equal(completed.totals.cost, "1500");
  assert.equal(completed.totals.completeCount, 1);
  assert.deepEqual(
    (await getManagementData(otherId)).items,
    stockBeforeHistoricalCost,
  );
  assert.deepEqual(
    (await getManagementData(otherId)).movements,
    movementsBeforeHistoricalCost,
  );
  const historicalOriginal = (
    await pool.query(
      "SELECT items FROM orders WHERE business_id=$1 AND id=$2",
      [otherId, historicalOrderId],
    )
  ).rows[0].items;
  assert.equal(historicalOriginal[0].name, "Producto histórico");
  assert.equal(historicalOriginal[0].productId, undefined);
  await run(otherId, {
    type: "recipe",
    productId: historicalProduct.id,
    optionId: historicalVariant,
    optionKind: "variant",
    version: 1,
    lines: [{ itemId: historicalIngredient, quantity: "200" }],
  });
  await run(otherId, {
    type: "purchase",
    supplierId: null,
    lines: [
      {
        itemId: historicalIngredient,
        quantity: "1000",
        unit: "g",
        totalCents: "50000",
      },
    ],
  });
  assert.equal((await getManagementReport(otherId)).totals.cost, "1500");
  assert.equal((await getManagementReport(businessId)).legacyCount, 0);
  console.log(
    "PASS: explicit historical mapping, exact recipe + addon quote, owner-only access, isolation, stale quotes, rollback, concurrent retries, no stock changes, frozen historical estimates",
  );
  const promoBusiness = await createBusiness(actor, {
    name: "Local de promos",
    slug: `${slug}-promos`,
    kind: "hamburgueseria",
    whatsapp: "+5493511234567",
    city: "Córdoba",
    address: "",
    requestKey: randomUUID(),
  });
  const promoMeat = String(
    (
      await run(promoBusiness, {
        type: "item",
        name: "Carne",
        kind: "ingredient",
        unit: "g",
        minimum: "0",
        initialQuantity: "1000",
        initialValueCents: "10000",
      })
    ).id,
  );
  const promoBread = String(
    (
      await run(promoBusiness, {
        type: "item",
        name: "Pan",
        kind: "ingredient",
        unit: "unit",
        minimum: "0",
        initialQuantity: "10",
        initialValueCents: "1000",
      })
    ).id,
  );
  const promoBox = String(
    (
      await run(promoBusiness, {
        type: "item",
        name: "Envase",
        kind: "ingredient",
        unit: "unit",
        minimum: "0",
        initialQuantity: "10",
        initialValueCents: "200",
      })
    ).id,
  );
  const promoBaseVariant = randomUUID(),
    promoVariant = randomUUID(),
    promoAddon = randomUUID();
  const promoBaseProduct = await saveProduct(promoBusiness, {
    name: "Especial",
    description: "",
    category: "Prueba",
    kind: "product",
    variants: [{ id: promoBaseVariant, name: "Única", priceCents: 100000 }],
    addOns: [],
    imageUrl: "",
    isAvailable: true,
    sortOrder: 0,
  });
  const promoProduct = await saveProduct(promoBusiness, {
    name: "Promo 2 especiales",
    description: "",
    category: "Prueba",
    kind: "combo",
    variants: [{ id: promoVariant, name: "Única", priceCents: 200000 }],
    addOns: [{ id: promoAddon, name: "Extra", priceCents: 1000 }],
    imageUrl: "",
    isAvailable: true,
    sortOrder: 1,
  });
  const promoRecipe = {
    type: "recipe",
    productId: promoProduct.id,
    optionId: promoVariant,
    optionKind: "variant",
    version: 0,
    lines: [
      {
        productId: promoBaseProduct.id,
        variantId: promoBaseVariant,
        quantity: "2",
      },
      { itemId: promoBox, quantity: "1" },
    ],
  };
  await assert.rejects(
    () => run(promoBusiness, promoRecipe),
    /Primero cargá la receta/,
  );
  await run(promoBusiness, {
    type: "recipe",
    productId: promoBaseProduct.id,
    optionId: promoBaseVariant,
    optionKind: "variant",
    version: 0,
    lines: [
      { itemId: promoMeat, quantity: "100" },
      { itemId: promoBread, quantity: "1" },
    ],
  });
  await assert.rejects(
    () =>
      run(promoBusiness, {
        ...promoRecipe,
        lines: [{ productId: product.id, variantId: variant, quantity: "2" }],
      }),
    /carta de este negocio/,
  );
  await assert.rejects(
    () =>
      run(promoBusiness, {
        ...promoRecipe,
        lines: [
          {
            productId: promoProduct.id,
            variantId: promoVariant,
            quantity: "2",
          },
        ],
      }),
    /sí misma/,
  );
  await assert.rejects(
    () =>
      run(promoBusiness, {
        ...promoRecipe,
        lines: [promoRecipe.lines[0], promoRecipe.lines[0]],
      }),
    /cantidades repetidas/,
  );
  await run(promoBusiness, promoRecipe);
  await assert.rejects(
    () =>
      run(promoBusiness, {
        type: "recipe",
        productId: promoBaseProduct.id,
        optionId: promoBaseVariant,
        optionKind: "variant",
        version: 1,
        lines: [
          {
            productId: promoProduct.id,
            variantId: promoVariant,
            quantity: "1",
          },
        ],
      }),
    /se usa dentro de una promo/,
  );
  await run(promoBusiness, {
    type: "recipe",
    productId: promoProduct.id,
    optionId: promoAddon,
    optionKind: "addon",
    version: 0,
    lines: [{ itemId: promoMeat, quantity: "5" }],
  });
  await assert.rejects(
    () =>
      run(promoBusiness, {
        type: "recipe",
        productId: promoProduct.id,
        optionId: promoAddon,
        optionKind: "addon",
        version: 1,
        lines: [
          {
            productId: promoProduct.id,
            variantId: promoVariant,
            quantity: "1",
          },
        ],
      }),
    /no otras promos/,
  );
  const promoSale = await run(promoBusiness, {
    type: "sale",
    channel: "counter",
    lines: [
      {
        productId: promoProduct.id,
        variantId: promoVariant,
        addOnIds: [promoAddon],
        quantity: 2,
        unitCents: "200000",
      },
    ],
  });
  const promoData = await getManagementData(promoBusiness);
  assert.equal(
    promoData.items.find((i) => i.id === promoMeat)?.quantity,
    "590.000000",
  );
  assert.equal(
    promoData.items.find((i) => i.id === promoBread)?.quantity,
    "6.000000",
  );
  assert.equal(
    promoData.items.find((i) => i.id === promoBox)?.quantity,
    "8.000000",
  );
  assert.equal(promoData.sales[0].costCents, "4540");
  const promoMovements = await saleConsumptions(
    promoBusiness,
    String(promoSale.id),
  );
  assert.equal(promoMovements.length, 3);
  await run(promoBusiness, {
    type: "cancel_sale",
    saleId: promoSale.id,
    reason: "Recuperamos todos los insumos",
    recoveries: promoMovements.map((m) => ({
      movementId: m.id,
      quantity: String(-Number(m.quantity)),
    })),
  });
  assert.equal(
    (await getManagementData(promoBusiness)).items.find(
      (i) => i.id === promoMeat,
    )?.quantity,
    "1000.000000",
  );
  await run(promoBusiness, {
    type: "recipe",
    productId: promoBaseProduct.id,
    optionId: promoBaseVariant,
    optionKind: "variant",
    version: 1,
    lines: [
      { itemId: promoMeat, quantity: "150" },
      { itemId: promoBread, quantity: "1" },
    ],
  });
  const updatedPromoSale = await run(promoBusiness, {
    type: "sale",
    channel: "counter",
    lines: [
      {
        productId: promoProduct.id,
        variantId: promoVariant,
        addOnIds: [],
        quantity: 1,
        unitCents: "200000",
      },
    ],
  });
  const updatedPromoData = await getManagementData(promoBusiness);
  assert.equal(
    updatedPromoData.sales.find((s) => s.id === updatedPromoSale.id)?.costCents,
    "3220",
  );
  assert.equal(
    updatedPromoData.sales.find((s) => s.id === promoSale.id)?.costCents,
    "4540",
  );
  console.log(
    "PASS: promo product references, own extras, addons and quantities consume once, cancellations restore once, current base recipes update future costs, historical costs freeze, tenant isolation and nested/cyclic promos rejected",
  );
  writeFileSync(
    "/tmp/gastronomia-management-fixture.json",
    JSON.stringify({
      businessId,
      otherId,
      actor,
      slug,
      meat,
      bread,
      cheese,
      finished,
      productId: product.id,
      variantId: variant,
      addonId: addon,
    }),
  );
  console.log(
    "PASS: reports cover more than 100 sales, pagination, CSV formula protection and date validation",
  );
  console.log(`Fixture: ${businessId} (isolated synthetic business)`);
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
