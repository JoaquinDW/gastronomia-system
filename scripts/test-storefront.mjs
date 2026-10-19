import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
assert.ok(
  process.env.APP_URL && process.env.TEST_STOREFRONT === "1",
  "Use an isolated Neon branch, APP_URL and TEST_STOREFRONT=1",
);
const base = new URL(process.env.APP_URL).origin;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const owner = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  guest = await browser.newContext({ viewport: { width: 390, height: 844 } }),
  other = await browser.newContext();
const suffix = randomUUID().slice(0, 8);
let businessId;
let page;
async function register(context, name) {
  const p = await context.newPage();
  await p.goto(`${base}/registro`);
  await p.locator("[name=name]").fill(name);
  await p
    .locator("[name=email]")
    .fill(`${name.toLowerCase().replace(/ /g, "-")}-${suffix}@example.com`);
  const password = `${randomUUID()}!Aa2`;
  await p.locator("[name=password]").fill(password);
  await p.locator("[name=confirmPassword]").fill(password);
  await p.getByRole("button", { name: "Crear cuenta y continuar" }).click();
  await p.waitForURL(`${base}/alta`, { timeout: 45000 });
  return p;
}
async function api(context, path, method = "GET", body) {
  const response = await context.request.fetch(`${base}${path}`, {
    method,
    headers: { Origin: base },
    ...(body === undefined ? {} : { data: body }),
  });
  const data = await response.json();
  return { response, data };
}
try {
  page = await register(owner, "Owner Menu");
  const created = await api(owner, "/api/businesses", "POST", {
    name: `Burgers de prueba ${suffix}`,
    slug: `burgers-${suffix}`,
    kind: "hamburgueseria",
    whatsapp: "+5493511234567",
    city: "Córdoba",
    address: "Calle de prueba 123",
    requestKey: randomUUID(),
  });
  assert.equal(created.response.status(), 201);
  businessId = created.data.id;
  const root = `/api/businesses/${businessId}`;
  const storePath = `/t/burgers-${suffix}`;
  assert.equal((await guest.request.get(`${base}${storePath}`)).status(), 404);
  assert.equal(
    (await guest.request.get(`${base}${storePath}?preview=1`)).status(),
    404,
  );
  const notReady = await api(owner, `${root}/store`, "POST", { publish: true });
  assert.equal(notReady.response.status(), 422);
  await page.goto(`${base}/panel/negocios/${businessId}/carta`);
  await page.getByRole("button", { name: /Agregar producto/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("[name=name]").fill("Burger de prueba");
  await dialog.locator("[name=category]").fill("Hamburguesas");
  await dialog
    .locator("[name=description]")
    .fill("Pan de papa, carne, queso y tomate.");
  await dialog
    .locator(".option-editor")
    .nth(0)
    .locator("input")
    .nth(0)
    .fill("Simple");
  await dialog
    .locator(".option-editor")
    .nth(0)
    .locator("input")
    .nth(1)
    .fill("$6.500");
  await dialog.getByRole("button", { name: "+ Agregar variante" }).click();
  await dialog
    .locator(".option-editor")
    .nth(1)
    .locator("input")
    .nth(0)
    .fill("Doble");
  await dialog
    .locator(".option-editor")
    .nth(1)
    .locator("input")
    .nth(1)
    .fill("9.000");
  await dialog.locator("summary").click();
  await dialog.getByRole("button", { name: "+ Agregar adicional" }).click();
  await dialog
    .locator(".option-editor")
    .nth(2)
    .locator("input")
    .nth(0)
    .fill("Cheddar extra");
  await dialog
    .locator(".option-editor")
    .nth(2)
    .locator("input")
    .nth(1)
    .fill("1000");
  await dialog
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await page
    .getByRole("heading", { name: "Burger de prueba", exact: true })
    .waitFor();
  let menu = await api(owner, `${root}/menu`);
  let product = menu.data.products[0];
  assert.equal(product.variants[0].priceCents, 650000);
  assert.equal(product.variants[1].priceCents, 900000);
  assert.equal(product.addOns[0].priceCents, 100000);
  await page
    .getByRole("button", { name: "Pausar Burger de prueba", exact: true })
    .click();
  await page.getByText("Pausado", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Habilitar Burger de prueba", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pausar Burger de prueba", exact: true })
    .waitFor();
  assert.equal(
    (
      await api(owner, `${root}/menu/${product.id}`, "PUT", {
        product: Object.fromEntries(
          Object.entries(product).filter(
            ([k]) => k !== "id" && k !== "version",
          ),
        ),
        version: product.version,
      })
    ).response.status(),
    409,
  );
  await page.screenshot({
    path: "/tmp/gastronomia-carta-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    "PASS: manual menu UI stores variants and extras, parses Argentine prices, pauses/restores products and rejects stale edits",
  );

  if (process.env.AI_E2E === "1") {
    assert.ok(
      process.env.MENU_TEST_IMAGE,
      "Set MENU_TEST_IMAGE for live image import",
    );
    assert.equal(menu.data.aiAvailable, true);
    await page.getByRole("button", { name: /Importar con IA/ }).click();
    await page
      .locator("input[type=file]")
      .setInputFiles(process.env.MENU_TEST_IMAGE);
    const modelResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/menu/import") && r.request().method() === "POST",
      { timeout: 120000 },
    );
    await page.getByRole("button", { name: "Analizar carta con IA" }).click();
    const analyzed = await modelResponse;
    const draft = await analyzed.json();
    assert.equal(analyzed.status(), 200, JSON.stringify(draft));
    assert.equal(draft.draft.products.length, 8);
    await page
      .getByRole("heading", { name: "Revisá 8 productos detectados" })
      .waitFor();
    await page.screenshot({
      path: "/tmp/gastronomia-importacion-ia.png",
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByLabel(
        "Revisé nombres, precios en pesos, promociones y aclaraciones.",
      )
      .check();
    const committedPromise = page.waitForResponse(
      (r) => r.url().endsWith("/menu/import") && r.request().method() === "PUT",
    );
    await page
      .getByRole("button", { name: "Guardar 8 productos seleccionados" })
      .click();
    const committed = await committedPromise;
    assert.equal(committed.status(), 200);
    assert.equal((await committed.json()).result.saved, 8);
    const replay = await api(
      owner,
      `${root}/menu/import`,
      "PUT",
      committed.request().postDataJSON(),
    );
    assert.equal(replay.response.status(), 200);
    assert.equal((await api(owner, `${root}/menu`)).data.products.length, 9);
    console.log(
      "PASS: supplied image uploaded through UI -> real OpenAI extraction -> editable review -> eight products committed once",
    );
  }

  const settings = {
    description: "Hamburguesas hechas en casa, listas para tu próximo pedido.",
    menuNote: "Las hamburguesas incluyen una porción de papas.",
    hours: Array.from({ length: 7 }, (_, day) => ({
      day,
      opens: "00:00",
      closes: "23:59",
    })),
    pickupEnabled: true,
    pickupInstructions: "Retirá por la puerta principal.",
    deliveryEnabled: true,
    deliveryZones: [
      {
        id: randomUUID(),
        name: "Centro",
        feeCents: 120000,
        minimumCents: 1000000,
      },
    ],
    paymentMethods: ["cash"],
    transferAlias: "",
  };
  let current = await api(owner, `${root}/store`);
  const saved = await api(owner, `${root}/store`, "PUT", {
    settings,
    version: current.data.settings.version,
  });
  assert.equal(saved.response.status(), 200, JSON.stringify(saved.data));
  assert.equal(
    (await owner.request.get(`${base}${storePath}?preview=1`)).status(),
    200,
  );
  assert.equal((await guest.request.get(`${base}${storePath}`)).status(), 404);
  await page.goto(`${base}/panel/negocios/${businessId}/tienda`);
  await page.getByRole("button", { name: "Guardar y activar tienda" }).click();
  await page
    .getByRole("button", { name: "Pausar tienda", exact: true })
    .waitFor();
  await page.screenshot({
    path: "/tmp/gastronomia-tienda-config.png",
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    "PASS: unpublished stores/preview protected; configuration persists; explicit activation makes store public",
  );
  const shop = await guest.newPage();
  await shop.goto(`${base}${storePath}`, { waitUntil: "networkidle" });
  assert.equal(
    await shop.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await shop
    .getByRole("heading", { name: "Burger de prueba", exact: true })
    .waitFor();
  await shop.getByText("Personalizar con adicionales", { exact: true }).click();
  await shop.getByLabel("Cheddar extra").check();
  await shop
    .getByRole("button", { name: "Agregar Burger de prueba", exact: true })
    .click();
  await shop
    .getByRole("button", { name: /Sumar una unidad de Burger/ })
    .click();
  await shop.reload();
  await shop
    .getByRole("button", { name: /Sumar una unidad de Burger/ })
    .waitFor();
  await shop.screenshot({
    path: "/tmp/gastronomia-tienda-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await shop.getByRole("button", { name: /Continuar con mi pedido/ }).click();
  await shop.locator("[name=customerName]").fill("Cliente de prueba");
  await shop.locator("[name=customerPhone]").fill("+5493511112222");
  await shop.getByLabel("¿Cómo lo recibís?").selectOption("delivery");
  await shop.locator("[name=address]").fill("Calle de prueba 456");
  const orderPromise = shop.waitForResponse(
    (r) =>
      r.url().includes("/api/storefront/") && r.request().method() === "POST",
  );
  await shop
    .getByRole("button", { name: "Confirmar pedido", exact: true })
    .click();
  const response = await orderPromise;
  assert.equal(response.status(), 201);
  const payload = response.request().postDataJSON(),
    order = await response.json();
  assert.equal(order.totalCents, 1620000);
  await shop.waitForURL(/\/pedido\/[a-f0-9]+\?confirm=1/);
  const link = shop.getByRole("dialog").getByRole("link", { name: /Confirmar por WhatsApp/ });
  await link.waitFor();
  const wa = new URL(await link.getAttribute("href"));
  assert.equal(wa.hostname, "wa.me");
  assert.match(
    wa.searchParams.get("text"),
    /¡Seguí el estado de tu pedido!/,
  );
  assert.match(wa.searchParams.get("text"), /16.200/);
  const repeats = await Promise.all([
    api(guest, `/api/storefront/burgers-${suffix}/orders`, "POST", payload),
    api(guest, `/api/storefront/burgers-${suffix}/orders`, "POST", payload),
  ]);
  assert.ok(
    repeats.every((r) => r.response.status() === 201 && r.data.id === order.id),
  );
  const tampered = {
    ...payload,
    requestKey: randomUUID(),
    items: payload.items.map((i) => ({ ...i, quotedUnitCents: 1 })),
  };
  assert.equal(
    (
      await api(
        guest,
        `/api/storefront/burgers-${suffix}/orders`,
        "POST",
        tampered,
      )
    ).response.status(),
    409,
  );
  const belowMinimum = {
    ...payload,
    requestKey: randomUUID(),
    items: payload.items.map((i) => ({ ...i, quantity: 1 })),
  };
  assert.equal(
    (
      await api(
        guest,
        `/api/storefront/burgers-${suffix}/orders`,
        "POST",
        belowMinimum,
      )
    ).response.status(),
    422,
  );
  let inbox = await api(owner, `${root}/orders`);
  assert.equal(inbox.data.orders.length, 1);
  assert.equal(inbox.data.orders[0].status, "pending_confirmation");
  console.log(
    "PASS: mobile cart survives reload; real checkout calculates extras/delivery, persists pending order, builds WhatsApp draft and rejects tampered prices/duplicate orders",
  );
  await page.goto(`${base}/panel/negocios/${businessId}/pedidos`);
  await page
    .getByRole("button", { name: "Aceptar pedido", exact: true })
    .click();
  await page.getByText("Aceptado", { exact: true }).waitFor();
  assert.equal(
    (
      await api(owner, `${root}/orders`, "POST", {
        orderId: order.id,
        version: 1,
        status: "rejected",
      })
    ).response.status(),
    409,
  );
  await register(other, "Other Menu");
  for (const path of [
    `${root}/menu`,
    `${root}/store`,
    `${root}/orders`,
    `${root}/menu/import`,
  ])
    assert.equal((await api(other, path)).response.status(), 404);
  assert.equal(
    (await api(other, `${root}/menu`, "POST", {})).response.status(),
    404,
  );
  console.log(
    "PASS: order decision is protected against stale changes; other accounts cannot read/change menu, imports, settings or customers",
  );
  current = await api(owner, `${root}/store`);
  assert.equal(
    (
      await api(owner, `${root}/store`, "PUT", {
        settings: { ...settings, hours: [] },
        version: current.data.settings.version,
      })
    ).response.status(),
    422,
    "An active store must keep a usable schedule",
  );
  const today = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Argentina/Cordoba",
      weekday: "short",
    }).format(new Date()),
  );
  const closed = {
    ...settings,
    hours: [{ day: (today + 2) % 7, opens: "12:00", closes: "13:00" }],
  };
  assert.equal(
    (
      await api(owner, `${root}/store`, "PUT", {
        settings: closed,
        version: current.data.settings.version,
      })
    ).response.status(),
    200,
  );
  assert.equal(
    (
      await api(guest, `/api/storefront/burgers-${suffix}/orders`, "POST", {
        ...payload,
        requestKey: randomUUID(),
      })
    ).response.status(),
    409,
  );
  assert.equal(
    (
      await api(owner, `${root}/store`, "POST", { publish: false })
    ).response.status(),
    200,
  );
  assert.equal((await guest.request.get(`${base}${storePath}`)).status(), 404);
  console.log(
    "PASS: closed hours prevent new checkout; pausing the store removes public access",
  );
} catch (e) {
  if (page)
    await page
      .screenshot({
        path: "/tmp/gastronomia-storefront-failure.png",
        fullPage: true,
        animations: "disabled",
      })
      .catch(() => {});
  throw e;
} finally {
  await owner.close();
  await guest.close();
  await other.close();
  await browser.close();
}
