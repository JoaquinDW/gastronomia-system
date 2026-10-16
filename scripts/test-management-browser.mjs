import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";
import { Pool } from "pg";
assert.ok(
  process.env.APP_URL &&
    process.env.GASTRONOMIA_ENV_FILE &&
    process.env.TEST_MANAGEMENT === "1" &&
    process.env.MANAGEMENT_TEST_HOST,
  "Use an explicitly selected isolated branch",
);
process.loadEnvFile(process.env.GASTRONOMIA_ENV_FILE);
assert.equal(
  new URL(process.env.DATABASE_URL).hostname.replace("-pooler", ""),
  process.env.MANAGEMENT_TEST_HOST,
);
assert.notEqual(process.env.NEON_BRANCH, "production");
assert.match(process.env.NEON_BRANCH ?? "", /^(codex-|test|dev|preview)/);
const connection = new URL(process.env.DATABASE_URL);
connection.searchParams.set("sslmode", "verify-full");
const db = new Pool({
  connectionString: connection.toString(),
  max: 2,
  connectionTimeoutMillis: 10000,
});
const base = new URL(process.env.APP_URL).origin,
  suffix = randomUUID().slice(0, 8);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const owner = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  }),
  other = await browser.newContext(),
  guest = await browser.newContext();
const errors = [];
const page = await owner.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", (e) => errors.push(e.message));
const screenshots =
  process.env.MANAGEMENT_SCREENSHOTS ?? "/tmp/gastronomia-management-review";
mkdirSync(screenshots, { recursive: true });
async function register(context, name) {
  const p = context === owner ? page : await context.newPage();
  await p.goto(`${base}/registro`);
  await p.locator("[name=name]").fill(name);
  await p
    .locator("[name=email]")
    .fill(`gestion-${name.toLowerCase()}-${suffix}@example.com`);
  const password = `${randomUUID()}!Aa3`;
  await p.locator("[name=password]").fill(password);
  await p.locator("[name=confirmPassword]").fill(password);
  await p.getByRole("button", { name: "Crear cuenta y continuar" }).click();
  await p.waitForURL(`${base}/alta`, { timeout: 45000 });
  return p;
}
async function api(context, path, body) {
  const r = await context.request.fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Origin: base },
    ...(body ? { data: body } : {}),
  });
  const d = await r.json();
  return { r, d };
}
try {
  await register(owner, "Owner");
  const created = await api(owner, "/api/businesses", {
    name: "La Esquina · prueba",
    slug: `esquina-gestion-${suffix}`,
    kind: "hamburgueseria",
    whatsapp: "+5493511234567",
    city: "Córdoba",
    address: "Datos sintéticos",
    requestKey: randomUUID(),
  });
  assert.equal(created.r.status(), 201);
  const id = created.d.id,
    management = `/api/businesses/${id}/management`,
    root = `/panel/negocios/${id}/gestion`;
  const command = async (body) => {
    const result = await api(owner, management, {
      ...body,
      requestKey: randomUUID(),
    });
    assert.equal(result.r.status(), 201, JSON.stringify(result.d));
    return result.d;
  };
  await page.goto(`${base}${root}`);
  await page.getByRole("heading", { name: "¿Cómo va tu negocio?" }).waitFor();
  await page.screenshot({
    path: `${screenshots}/empty-desktop.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Inventario", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar insumo", exact: true })
    .click();
  const form = page.locator(".mg-editor");
  await form.getByLabel("Nombre", { exact: true }).fill("Carne picada");
  await form
    .getByLabel("Cantidad que tenés ahora", { exact: true })
    .fill("10000");
  await form.getByLabel("Stock mínimo", { exact: true }).fill("1000");
  await form
    .getByLabel("Cuánto te costó todo ese stock ($)", { exact: true })
    .fill("80000");
  await page.route(`**${management}`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Fallo de prueba. Volvé a intentar." }),
      });
    } else await route.continue();
  });
  await form.getByRole("button", { name: "Guardar y confirmar" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Fallo de prueba" })
    .waitFor();
  assert.equal(
    await form.getByLabel("Nombre", { exact: true }).inputValue(),
    "Carne picada",
  );
  await page.unroute(`**${management}`);
  await form.getByRole("button", { name: "Guardar y confirmar" }).click();
  await page.getByRole("status").filter({ hasText: "Listo" }).waitFor();
  let d = (await api(owner, management)).d;
  const meat = d.items.find((i) => i.name === "Carne picada").id;
  const bread = (
    await command({
      type: "item",
      name: "Pan de papa",
      kind: "ingredient",
      unit: "unit",
      minimum: "20",
      initialQuantity: "150",
      initialValueCents: "9000000",
    })
  ).id;
  const cheddar = (
    await command({
      type: "item",
      name: "Cheddar",
      kind: "ingredient",
      unit: "g",
      minimum: "1000",
      initialQuantity: "2000",
      initialValueCents: "4000000",
    })
  ).id;
  const variant = randomUUID(),
    addon = randomUUID();
  await page.goto(`${base}${root}/inventario`);
  const rowFor = (name) =>
    page
      .getByRole("row")
      .filter({ has: page.getByRole("rowheader", { name: new RegExp(name) }) });
  await rowFor("Carne picada")
    .getByRole("button", { name: /^Editar/ })
    .click();
  await form
    .getByLabel("Nombre", { exact: true })
    .fill("Borrador que no se debe trasladar");
  await rowFor("Pan de papa")
    .getByRole("button", { name: /^Editar/ })
    .click();
  assert.equal(
    await form.getByLabel("Nombre", { exact: true }).inputValue(),
    "Pan de papa",
  );
  await page
    .getByRole("button", { name: "Agregar insumo", exact: true })
    .click();
  assert.equal(
    await form.getByLabel("Nombre", { exact: true }).inputValue(),
    "",
  );
  assert.equal(await page.locator("button.primary-button:visible").count(), 1);
  await page.getByRole("button", { name: "Cerrar formulario" }).click();
  const productResponse = await api(owner, `/api/businesses/${id}/menu`, {
    name: "Burger clásica",
    description: "Datos sintéticos",
    category: "Hamburguesas",
    kind: "product",
    variants: [{ id: variant, name: "Simple", priceCents: 850000 }],
    addOns: [{ id: addon, name: "Extra cheddar", priceCents: 100000 }],
    imageUrl: "",
    isAvailable: true,
    sortOrder: 0,
  });
  assert.equal(
    productResponse.r.status(),
    201,
    JSON.stringify(productResponse.d),
  );
  const product = productResponse.d.product;
  await command({
    type: "recipe",
    productId: product.id,
    optionId: variant,
    optionKind: "variant",
    version: 0,
    lines: [
      { itemId: meat, quantity: "120" },
      { itemId: bread, quantity: "1" },
    ],
  });
  await command({
    type: "recipe",
    productId: product.id,
    optionId: addon,
    optionKind: "addon",
    version: 0,
    lines: [{ itemId: cheddar, quantity: "20" }],
  });
  await page.goto(`${base}${root}/proveedores`);
  await page.getByRole("button", { name: "Agregar proveedor" }).click();
  await form
    .getByLabel("Nombre", { exact: true })
    .fill("Distribuidora del barrio");
  await form.getByLabel("Contacto", { exact: true }).fill("351 555 0101");
  await form.getByRole("button", { name: "Guardar y confirmar" }).click();
  await page.getByRole("status").filter({ hasText: "Listo" }).waitFor();
  d = (await api(owner, management)).d;
  await command({
    type: "purchase",
    supplierId: d.suppliers[0].id,
    lines: [{ itemId: meat, quantity: "5", unit: "kg", totalCents: "4000000" }],
    note: "Reposición de prueba",
  });
  await page.goto(`${base}${root}/ventas`);
  await page
    .getByRole("button", { name: "Registrar venta", exact: true })
    .click();
  await form.getByLabel("Unidades", { exact: true }).fill("12");
  await form.getByRole("button", { name: "Guardar y confirmar" }).click();
  await page.getByRole("status").filter({ hasText: "Listo" }).waitFor();
  const sale = async (channel, count) =>
    command({
      type: "sale",
      channel,
      lines: [
        {
          productId: product.id,
          variantId: variant,
          addOnIds: [addon],
          quantity: count,
          unitCents: "950000",
        },
      ],
    });
  await sale("whatsapp", 8);
  await sale("counter", 14);
  await sale("other", 4);
  d = (await api(owner, management)).d;
  await command({
    type: "expense",
    date: d.today,
    category: "Servicios",
    amountCents: "1800000",
    concept: "Luz y gas · prueba",
    supplierId: null,
  });
  await command({
    type: "expense",
    date: d.today,
    category: "Envíos",
    amountCents: "900000",
    concept: "Reparto · prueba",
    supplierId: null,
  });
  const report = await api(owner, `${management}?view=report`);
  assert.equal(report.r.status(), 200);
  assert.notEqual(report.d.totals.result, null);
  await page.goto(`${base}${root}`);
  await page.getByRole("heading", { name: "Lo que quedó" }).waitFor();
  const download = await owner.request.get(
    `${base}${management}?view=export-results`,
  );
  assert.equal(download.status(), 200);
  assert.match(download.headers()["content-type"], /text\/csv/);
  await page.screenshot({
    path: `${screenshots}/desktop.png`,
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => innerWidth === 390);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${screenshots}/mobile.png`,
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  for (const section of [
    "inventario",
    "recetas",
    "compras",
    "ventas",
    "gastos",
    "proveedores",
  ]) {
    await page.goto(`${base}${root}/${section}`);
    await page.locator(".mg-toolbar").waitFor();
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter(
          (e) =>
            e.getBoundingClientRect().right > innerWidth + 1 &&
            getComputedStyle(e).position !== "absolute",
        )
        .slice(0, 20)
        .map((e) => ({
          tag: e.tagName,
          cls: e.className,
          width: e.getBoundingClientRect().width,
          right: e.getBoundingClientRect().right,
        })),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${section}: mobile overflow: ${JSON.stringify(overflow)}`,
    );
  }
  await page.goto(`${base}${root}/inventario`);
  await page
    .getByRole("button", { name: "Agregar insumo", exact: true })
    .click();
  await page.screenshot({
    path: `${screenshots}/inventory-mobile.png`,
    fullPage: true,
    animations: "disabled",
  });
  const names = await page
    .locator(".mg-editor input:not([type=hidden]),.mg-editor select")
    .evaluateAll((elements) =>
      elements.map((e) => ({ tag: e.tagName, labels: e.labels?.length })),
    );
  assert.ok(names.every((n) => n.labels > 0));
  // Configure a promo as 2 × an existing product, leaving ingredient rows empty.
  const promoVariant = randomUUID();
  const promoResponse = await api(owner, `/api/businesses/${id}/menu`, {
    name: "Promo 2 burgers",
    description: "",
    category: "Promos",
    kind: "combo",
    variants: [{ id: promoVariant, name: "Para dos", priceCents: 1500000 }],
    addOns: [],
    imageUrl: "",
    isAvailable: true,
    sortOrder: 1,
  });
  assert.equal(promoResponse.r.status(), 201);
  const promo = promoResponse.d.product;
  await page.goto(`${base}${root}/recetas`);
  await page
    .getByRole("button", { name: "Configurar receta", exact: true })
    .click();
  await form
    .getByLabel("Producto y opción de la carta")
    .selectOption(`${promo.id}:variant:${promoVariant}`);
  await form
    .getByRole("button", { name: "Agregar producto de la carta" })
    .click();
  await form
    .getByLabel("Producto incluido 1", { exact: true })
    .selectOption(`${product.id}:${variant}`);
  await form.getByLabel("Unidades del producto 1", { exact: true }).fill("2");
  await page.screenshot({
    path: `${screenshots}/promo-recipe-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await form.getByRole("button", { name: "Guardar y confirmar" }).click();
  await page.getByRole("status").filter({ hasText: "Listo" }).waitFor();
  const savedPromo = (await api(owner, management)).d.recipes.find(
    (r) => r.productId === promo.id,
  );
  assert.deepEqual(savedPromo.lines, [
    { productId: product.id, variantId: variant, quantity: "2" },
  ]);
  await page
    .getByRole("cell", { name: "2 × Burger clásica · Simple" })
    .waitFor();
  const stockBeforePromo = (await api(owner, management)).d.items;
  const promoSale = await command({
    type: "sale",
    channel: "counter",
    lines: [
      {
        productId: promo.id,
        variantId: promoVariant,
        addOnIds: [],
        quantity: 2,
        unitCents: "1500000",
      },
    ],
  });
  const afterPromo = (await api(owner, management)).d;
  assert.equal(
    Number(stockBeforePromo.find((i) => i.id === meat).quantity) -
      Number(afterPromo.items.find((i) => i.id === meat).quantity),
    480,
  );
  assert.equal(
    Number(stockBeforePromo.find((i) => i.id === bread).quantity) -
      Number(afterPromo.items.find((i) => i.id === bread).quantity),
    4,
  );
  assert.equal(
    afterPromo.sales.find((s) => s.id === promoSale.id).costCents,
    "624000",
  );
  // An accepted order from before Gestión needs explicit mapping, not new stock.
  const legacyItems = [
    {
      name: "Nombre anterior",
      variant: "Anterior",
      addOns: [],
      quantity: 2,
      unitCents: 850000,
      lineCents: 1700000,
    },
    {
      name: "Otro nombre anterior",
      variant: "Anterior",
      addOns: ["Extra anterior"],
      quantity: 1,
      unitCents: 950000,
      lineCents: 950000,
    },
  ];
  await db.query(
    `INSERT INTO orders(business_id,number,request_key,payload_hash,status,customer_name,customer_phone,fulfillment,payment_method,items,subtotal_cents,delivery_cents,total_cents) VALUES($1,1,$2,'historical-browser','accepted','Sintético','+5493511234567','pickup','cash',$3,2650000,0,2650000)`,
    [id, randomUUID(), JSON.stringify(legacyItems)],
  );
  const beforeHistoricalStock = (await api(owner, management)).d.items;
  const historicalReport = (await api(owner, `${management}?view=report`)).d;
  assert.equal(historicalReport.legacyPendingCount, 1);
  await page.goto(`${base}${root}`);
  await page
    .locator(".mg-result-amount")
    .filter({ hasText: "Pedidos sin costo" })
    .waitFor();
  await page
    .getByRole("link", { name: "Completar costos de pedidos anteriores" })
    .click();
  await page
    .getByText("Completar costo del pedido #1", { exact: true })
    .click();
  const historicalForm = page.locator(".mg-historical-order form");
  assert.equal(
    await historicalForm
      .getByRole("button", { name: "Confirmar costo estimado" })
      .isDisabled(),
    true,
  );
  for (const name of [
    "Nombre anterior (línea 1)",
    "Otro nombre anterior (línea 2)",
  ]) {
    await historicalForm
      .getByLabel(`Receta para ${name}`)
      .selectOption(`${product.id}:${variant}`);
  }
  await historicalForm.getByLabel("Extra cheddar · línea 2").check();
  await historicalForm
    .getByText("Costo estimado del pedido: $ 5.080", { exact: true })
    .waitFor();
  await page.screenshot({
    path: `${screenshots}/historical-cost-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.waitForFunction(() => innerWidth === 1440);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    return document.fonts.ready;
  });
  await page.screenshot({
    path: `${screenshots}/historical-cost-desktop.png`,
    fullPage: true,
  });
  await page.route(`**${management}`, async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Fallo de prueba histórica" }),
      });
    else await route.continue();
  });
  await historicalForm
    .getByRole("button", { name: "Confirmar costo estimado" })
    .click();
  await historicalForm
    .getByRole("alert")
    .filter({ hasText: "Fallo de prueba histórica" })
    .waitFor();
  assert.equal(
    await historicalForm
      .getByLabel("Receta para Nombre anterior (línea 1)")
      .inputValue(),
    `${product.id}:${variant}`,
  );
  await page.unroute(`**${management}`);
  await historicalForm
    .getByRole("button", { name: "Confirmar costo estimado" })
    .click();
  await page.locator(".mg-historical-order").waitFor({ state: "detached" });
  const completedHistoricalReport = (
    await api(owner, `${management}?view=report`)
  ).d;
  assert.notEqual(completedHistoricalReport.totals.result, null);
  assert.equal(completedHistoricalReport.legacyEstimatedCount, 1);
  assert.equal(
    BigInt(completedHistoricalReport.totals.cost) -
      BigInt(historicalReport.totals.cost),
    508000n,
  );
  assert.deepEqual(
    (await api(owner, management)).d.items,
    beforeHistoricalStock,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  // Missing-cost actions must lead to a usable form and preserve stock/history.
  const unpriced = await command({
    type: "item",
    name: "Envases sin costo",
    kind: "ingredient",
    unit: "unit",
    minimum: "0",
    initialQuantity: "10",
    initialValueCents: null,
  });
  const missingVariant = randomUUID();
  const missingProduct = await api(owner, `/api/businesses/${id}/menu`, {
    name: "Producto sin ingredientes",
    description: "Datos sintéticos",
    category: "Hamburguesas",
    kind: "product",
    variants: [{ id: missingVariant, name: "Única", priceCents: 100000 }],
    addOns: [],
    imageUrl: "",
    isAvailable: true,
    sortOrder: 1,
  });
  assert.equal(missingProduct.r.status(), 201);
  await command({
    type: "sale",
    channel: "counter",
    lines: [
      {
        productId: missingProduct.d.product.id,
        variantId: missingVariant,
        addOnIds: [],
        quantity: 1,
        unitCents: "100000",
      },
    ],
  });
  await page.goto(`${base}${root}`);
  await page
    .locator(".mg-result-amount")
    .filter({ hasText: "Faltan costos" })
    .waitFor();
  assert.equal(
    await page.getByText(/mermas|margen bruto|resultado operativo/i).count(),
    0,
  );
  await page.screenshot({
    path: `${screenshots}/missing-costs-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page
    .locator(".mg-cost-actions")
    .getByRole("link", { name: "Cargar costos de insumos", exact: true })
    .click();
  await form
    .getByRole("heading", { name: "Cargar costo de Envases sin costo" })
    .waitFor();
  assert.equal(
    await form.getByLabel("Cantidad (un.)", { exact: true }).inputValue(),
    "10",
  );
  await form
    .getByLabel("Cuánto te costó todo este stock ($)", { exact: true })
    .fill("1000");
  await form.getByRole("button", { name: "Guardar y confirmar" }).click();
  await page.getByRole("status").filter({ hasText: "Listo" }).waitFor();
  const priced = (await api(owner, management)).d.items.find(
    (i) => i.id === unpriced.id,
  );
  assert.equal(Number(priced.quantity), 10);
  assert.equal(Number(priced.unitCost), 10000);
  await page.goto(`${base}${root}`);
  await page
    .getByRole("link", {
      name: "Indicar ingredientes por producto",
      exact: true,
    })
    .click();
  assert.equal(
    await form.getByLabel("Producto y opción de la carta").inputValue(),
    `${missingProduct.d.product.id}:variant:${missingVariant}`,
  );
  await form.getByLabel("Esta opción no usa insumos ni agrega costos").check();
  await form.getByRole("button", { name: "Guardar y confirmar" }).click();
  await page.getByRole("status").filter({ hasText: "Listo" }).waitFor();
  assert.equal(
    (await api(owner, `${management}?view=report`)).d.totals.result,
    null,
  );
  assert.equal((await api(guest, management)).r.status(), 401);
  await register(other, "Other");
  assert.equal((await api(other, management)).r.status(), 404);
  const user = await other.request.get(`${base}/api/auth/get-session`);
  const session = await user.json();
  assert.ok(session.user.id);
  await db.query(
    "INSERT INTO memberships(business_id,user_id,role) VALUES($1,$2,$3)",
    [id, session.user.id, "manager"],
  );
  assert.equal((await api(other, management)).r.status(), 200);
  assert.equal((await api(other, `${management}?view=report`)).r.status(), 403);
  assert.equal(
    (await api(other, `${management}?view=export-results`)).r.status(),
    403,
  );
  assert.equal(
    (
      await api(other, management, {
        type: "expense",
        date: d.today,
        category: "Otros",
        amountCents: "1",
        concept: "Permiso",
        supplierId: null,
        requestKey: randomUUID(),
      })
    ).r.status(),
    403,
  );
  assert.equal(
    (
      await api(other, management, {
        type: "historical_cost",
        requestKey: randomUUID(),
        orderId: historicalReport.historicalOrders[0].id,
        lines: [
          {
            lineIndex: 0,
            productId: product.id,
            variantId: variant,
            addOnIds: [],
            expectedCostCents: "0",
          },
        ],
      })
    ).r.status(),
    403,
  );
  assert.equal((await api(other, management)).d.expenses.length, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real Auth, tenant and role permissions, item + supplier + sale UI, failed save retains input, complete report, missing-cost shortcuts, immutable past costs, explicit historical order costing, promo recipe references without double consumption, CSV, mobile sections and labeled forms",
  );
  console.log(`Screenshots: ${screenshots}`);
  console.log(`Synthetic business: ${id}`);
} catch (e) {
  await page
    .screenshot({ path: `${screenshots}/failure.png`, fullPage: true })
    .catch(() => {});
  throw e;
} finally {
  await browser.close();
  await db.end();
}
