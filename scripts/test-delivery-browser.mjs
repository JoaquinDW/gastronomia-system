import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

assert.ok(process.env.APP_URL && process.env.GASTRONOMIA_ENV_FILE && process.env.DELIVERY_FIXTURE_FILE && process.env.TEST_DELIVERY === "1");
process.loadEnvFile(process.env.GASTRONOMIA_ENV_FILE);
assert.match(process.env.NEON_BRANCH ?? "", /^(codex-|test|dev|preview)/);
const base = new URL(process.env.APP_URL).origin;
assert.equal(new URL(base).hostname, "localhost", "Use a local server pointed at the isolated branch");
const fixture = JSON.parse(readFileSync(process.env.DELIVERY_FIXTURE_FILE, "utf8"));
const screenshots = "/tmp/pedipue-delivery-review";
mkdirSync(screenshots, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const owner = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errors = [];
const mockedGoogle = `(() => {
class Point { constructor(point) { this.point = point; } toJSON() { return this.point; } }
class Map { constructor(element, options) { this.center = options.center; element.textContent = 'Mapa simulado para prueba'; } addListener() { return { remove() {} }; } panTo(point) { this.center = point; } getCenter() { return new Point(this.center); } }
class Marker { constructor(options) { Object.assign(this, options); } addListener() { return { remove() {} }; } }
class Circle { setMap() {} }
class Geocoder { async geocode({ address }) {
  if (address.includes('Error')) throw new Error('Simulated provider failure');
  const point = address.includes('Fuera') ? {lat:-32,lng:-64} : address.includes('Lejos') ? {lat:-31.45,lng:-64.1888} : {lat:-31.4201,lng:-64.1888};
  return { results: [{ place_id: 'test', formatted_address: address, geometry: { location: new Point(point) } }] };
} }
window.google = { maps: { Map, Circle, Geocoder, marker: { AdvancedMarkerElement: Marker } } };
window.pedipueMapsReady(); })();`;
for (const context of [owner, guest]) {
  await context.route("https://maps.googleapis.com/maps/api/js?**", route => route.fulfill({ contentType: "text/javascript", body: mockedGoogle }));
}
const page = await owner.newPage();
page.setDefaultTimeout(25_000);
page.on("pageerror", e => errors.push({ url: page.url(), message: e.message }));
async function api(path, method = "GET", data) {
  const response = await owner.request.fetch(`${base}${path}`, { method, headers: { Origin: base }, ...(data ? { data } : {}) });
  const body = await response.json();
  assert.ok(response.ok(), JSON.stringify(body));
  return body;
}
async function pick(p, address) {
  await p.getByRole("button", { name: "Buscar dirección", exact: true }).click();
  await p.getByRole("button", { name: address, exact: true }).click();
}
try {
  const suffix = randomUUID().slice(0, 8);
  await page.goto(`${base}/registro`);
  await page.locator("[name=name]").fill("Delivery QA");
  await page.locator("[name=email]").fill(`delivery-${suffix}@example.com`);
  const password = `${randomUUID()}!Aa2`;
  await page.locator("[name=password]").fill(password);
  await page.locator("[name=confirmPassword]").fill(password);
  await page.getByRole("button", { name: "Crear cuenta y continuar" }).click();
  await page.waitForURL(`${base}/alta`, { timeout: 45_000 });
  const slug = `reparto-${suffix}`;
  const created = await api("/api/businesses", "POST", { name: "Delivery de prueba", slug, kind: "hamburgueseria", whatsapp: "+5493511234567", city: "Córdoba", address: "Local sintético 123", requestKey: randomUUID() });
  const root = `/api/businesses/${created.id}`;
  await api(`${root}/menu`, "POST", { name: "Burger de prueba", category: "Hamburguesas", variants: [{ id: randomUUID(), name: "Única", priceCents: 650000 }] });
  await api(`${root}/store`, "PUT", { version: 0, settings: { ...fixture.settings, deliveryConfig: { mode: "manual" } } });
  await page.goto(`${base}/panel/negocios/${created.id}/tienda`);
  await page.getByLabel("¿Cómo calculás el envío?").selectOption("radius");
  await page.getByLabel("Dirección del local para calcular envíos").fill("Local sintético 123, Córdoba");
  await page.getByRole("button", { name: "Ubicar dirección en el mapa" }).click();
  await pick(page, "Local sintético 123, Córdoba");
  const section = page.locator(".config-section").filter({ has: page.getByRole("heading", { name: /Retiro y delivery/ }) });
  if (process.env.DELIVERY_CAPTURE === "1") await section.screenshot({ path: `${screenshots}/config-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  if (process.env.DELIVERY_CAPTURE === "1") await section.screenshot({ path: `${screenshots}/config-mobile.png` });
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("body *")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).map(e => ({ tag: e.tagName, class: e.className, right: e.getBoundingClientRect().right })).slice(0, 8)), []);
  await page.getByRole("button", { name: "Guardar configuración", exact: true }).click();
  await page.getByText("La configuración de tu tienda quedó guardada.", { exact: true }).waitFor();
  const saved = (await api(`${root}/store`)).settings;
  assert.equal(saved.deliveryConfig.mode, "radius");
  assert.deepEqual(saved.deliveryConfig.origin, fixture.origin);
  await api(`${root}/store`, "POST", { publish: true });

  const shop = await guest.newPage();
  shop.setDefaultTimeout(25_000);
  shop.on("pageerror", e => errors.push({ url: shop.url(), message: e.message }));
  await shop.goto(`${base}/t/${slug}`);
  await shop.getByRole("button", { name: /Agregar.*Burger|Agregar al pedido/ }).click();
  await shop.getByRole("button", { name: /Continuar con mi pedido/ }).click();
  await shop.getByLabel("Tu nombre").fill("Cliente sintético");
  await shop.getByLabel("Tu WhatsApp").fill("+5493511234567");
  await shop.getByLabel("¿Cómo lo recibís?").selectOption("delivery");
  await shop.getByLabel("Dirección y referencias").fill("Cerca sintética 456");
  const confirm = shop.getByRole("button", { name: "Confirmar pedido", exact: true });
  assert.equal(await confirm.isDisabled(), true);
  await shop.getByText("A calcular", { exact: true }).waitFor();
  await shop.getByRole("button", { name: "Ubicar dirección en el mapa" }).click();
  await pick(shop, "Cerca sintética 456, Córdoba");
  await shop.getByText(/Envío:.*Cerca/).waitFor();
  assert.equal(await confirm.isEnabled(), true);
  if (process.env.DELIVERY_CAPTURE === "1") await shop.locator("#pedido").screenshot({ path: `${screenshots}/checkout-mobile.png` });
  assert.ok(await shop.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await shop.setViewportSize({ width: 1440, height: 1000 });
  if (process.env.DELIVERY_CAPTURE === "1") await shop.locator("#pedido").screenshot({ path: `${screenshots}/checkout-desktop.png` });
  await shop.getByLabel("Dirección y referencias").fill("Fuera sintética 789");
  assert.equal(await confirm.isDisabled(), true);
  await pick(shop, "Fuera sintética 789, Córdoba");
  await shop.getByText(/Esta dirección está fuera de la cobertura/).waitFor();
  assert.equal(await confirm.isDisabled(), true);
  await shop.getByLabel("Dirección y referencias").fill("Error sintético 789");
  await shop.getByRole("button", { name: "Buscar dirección", exact: true }).click();
  await shop.getByText(/No pudimos encontrar la dirección/).waitFor();
  assert.equal(await confirm.isDisabled(), true);
  await shop.getByLabel("Dirección y referencias").fill("Lejos sintética 456");
  await pick(shop, "Lejos sintética 456, Córdoba");
  await shop.getByText(/Envío:.*Lejos/).waitFor();
  const responsePromise = shop.waitForResponse(r => r.url().endsWith(`/api/storefront/${slug}/orders`) && r.request().method() === "POST");
  await confirm.click();
  const response = await responsePromise;
  assert.equal(response.status(), 201);
  const order = await response.json();
  assert.equal(order.totalCents, 850000);
  assert.match(new URL(order.whatsappUrl).searchParams.get("text"), /Ubicación: https:\/\/www.google.com\/maps\/search/);
  const inbox = await api(`${root}/orders`);
  assert.deepEqual(inbox.orders[0].deliveryLocation, { lat: -31.45, lng: -64.1888 });
  await page.goto(`${base}/panel/negocios/${created.id}/pedidos`);
  assert.match(await page.getByRole("link", { name: "Abrir ubicación de entrega en Maps" }).getAttribute("href"), /-31.45,-64.1888/);
  assert.deepEqual(errors, []);
  console.log("PASS: desktop/mobile setup and checkout, provider error, pin invalidation, outside coverage, automatic tariff, real order persistence and Maps link (Google service simulated)");
} catch (error) {
  console.error({ browserErrors: errors, visibleErrors: await page.locator('[role="alert"]').allTextContents().catch(() => []) });
  throw error;
} finally { await browser.close(); }
