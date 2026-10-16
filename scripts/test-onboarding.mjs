import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

// Creates synthetic accounts/businesses. Explicit URL and opt-in prevent accidental runs.
assert.ok(
  process.env.APP_URL && process.env.TEST_ONBOARDING === "1",
  "Set APP_URL for an isolated branch and TEST_ONBOARDING=1",
);
const base = new URL(process.env.APP_URL).origin;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const owner = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const other = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const suffix = randomUUID().slice(0, 8);
const email = `owner-${suffix}@example.com`;
const password = `${randomUUID()}!aA1`;
const name = `La Esquina ${suffix}`;

async function register(context, accountEmail, accountName) {
  const page = await context.newPage();
  await page.goto(`${base}/registro`);
  await page.locator('[name="name"]').fill(accountName);
  await page.locator('[name="email"]').fill(accountEmail);
  await page.locator('[name="password"]').fill(password);
  await page.locator('[name="confirmPassword"]').fill(password);
  await page.getByRole("button", { name: "Crear cuenta y continuar" }).click();
  try {
    await page.waitForURL(`${base}/alta`, { timeout: 45_000 });
  } catch (error) {
    await page.screenshot({
      path: "/tmp/gastronomia-auth-failure.png",
      fullPage: true,
      animations: "disabled",
    });
    console.error(
      "Signup page feedback:",
      await page.getByRole("alert").allTextContents(),
    );
    throw error;
  }
  return page;
}

try {
  const anonymous = await owner.request.get(`${base}/api/businesses`);
  assert.equal(anonymous.status(), 401);
  const anonymousWrite = await owner.request.post(`${base}/api/businesses`, {
    headers: { Origin: base },
    data: {},
  });
  assert.equal(anonymousWrite.status(), 401);
  const protectedPage = await owner.request.get(`${base}/panel`, {
    maxRedirects: 0,
  });
  assert.equal(protectedPage.status(), 307);
  assert.match(protectedPage.headers().location, /\/ingresar/);
  console.log(
    "PASS: unauthenticated API reads/writes denied; protected panel redirects to login",
  );

  const page = await register(owner, email, "Dueño de prueba");
  await page.reload();
  await page
    .getByRole("heading", { name: "Dale lugar a tu negocio." })
    .waitFor();
  assert.ok((await page.locator("main").innerText()).includes(email));
  console.log(
    "PASS: real Neon Auth signup and session restoration after reload",
  );

  await page.locator('[name="name"]').fill(name);
  assert.equal(
    await page.locator('[name="slug"]').inputValue(),
    `la-esquina-${suffix}`,
  );
  await page.locator('[name="kind"]').selectOption("hamburgueseria");
  await page.locator('[name="city"]').fill("Córdoba");
  await page.locator('[name="address"]').fill("Calle de prueba 123");
  await page.locator('[name="whatsapp"]').fill("no-es-un-telefono");
  await page
    .getByRole("button", { name: "Crear mi negocio", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Revisá los campos marcados." })
    .waitFor();
  await page.locator('[name="whatsapp"]').fill("+54 9 351 123 4567");
  await page.screenshot({
    path: "/tmp/gastronomia-alta-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  const submitted = page.waitForRequest(
    (request) =>
      request.url() === `${base}/api/businesses` && request.method() === "POST",
  );
  const created = page.waitForResponse(
    (response) =>
      response.url() === `${base}/api/businesses` &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Crear mi negocio", exact: true })
    .click();
  const payload = (await submitted).postDataJSON();
  const createdResponse = await created;
  assert.equal(createdResponse.status(), 201);
  const { id } = await createdResponse.json();
  await page.waitForURL(`${base}/panel/negocios/${id}`);
  await page.getByRole("heading", { name, exact: true }).waitFor();
  await page.reload();
  const stored = await owner.request.get(`${base}/api/businesses/${id}`);
  const { business } = await stored.json();
  assert.equal(stored.status(), 200);
  assert.equal(business.role, "owner");
  assert.equal(business.whatsapp, "+5493511234567");
  assert.equal(business.city, "Córdoba");
  assert.equal(business.address, "Calle de prueba 123");
  await page.screenshot({
    path: "/tmp/gastronomia-panel-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    "PASS: business, initial location and owner persist; normalized WhatsApp and automatic slug",
  );

  const replay = await owner.request.post(`${base}/api/businesses`, {
    headers: { Origin: base },
    data: payload,
  });
  assert.equal(replay.status(), 201);
  assert.equal((await replay.json()).id, id);
  const changed = await owner.request.post(`${base}/api/businesses`, {
    headers: { Origin: base },
    data: { ...payload, name: "Otro nombre" },
  });
  assert.equal(changed.status(), 409);
  const duplicateSlug = await owner.request.post(`${base}/api/businesses`, {
    headers: { Origin: base },
    data: { ...payload, requestKey: randomUUID() },
  });
  assert.equal(duplicateSlug.status(), 409);
  const spoofed = await owner.request.post(`${base}/api/businesses`, {
    headers: { Origin: base },
    data: { ...payload, userId: "someone-else", requestKey: randomUUID() },
  });
  assert.equal(spoofed.status(), 422);
  const crossOrigin = await owner.request.post(`${base}/api/businesses`, {
    headers: { Origin: "https://untrusted.example" },
    data: payload,
  });
  assert.equal(crossOrigin.status(), 403);
  const listing = await (
    await owner.request.get(`${base}/api/businesses`)
  ).json();
  assert.equal(listing.businesses.length, 1);
  console.log(
    "PASS: idempotent retries, duplicate slug, payload validation and cross-origin protection",
  );

  const otherPage = await register(
    other,
    `other-${suffix}@example.com`,
    "Otra persona de prueba",
  );
  assert.equal(
    await otherPage.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await otherPage.screenshot({
    path: "/tmp/gastronomia-alta-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  const otherCreate = await other.request.post(`${base}/api/businesses`, {
    headers: { Origin: base },
    data: {
      ...payload,
      name: `Pastas ${suffix}`,
      slug: `pastas-${suffix}`,
      kind: "pastas",
      requestKey: randomUUID(),
    },
  });
  assert.equal(otherCreate.status(), 201);
  const otherId = (await otherCreate.json()).id;
  assert.equal(
    (await other.request.get(`${base}/api/businesses/${id}`)).status(),
    404,
  );
  assert.equal(
    (await owner.request.get(`${base}/api/businesses/${otherId}`)).status(),
    404,
  );
  const otherListing = await (
    await other.request.get(`${base}/api/businesses`)
  ).json();
  assert.deepEqual(
    otherListing.businesses.map((item) => item.id),
    [otherId],
  );
  const forbiddenPage = await otherPage.goto(`${base}/panel/negocios/${id}`);
  assert.equal(forbiddenPage.status(), 404);
  assert.ok(!(await otherPage.locator("main").innerText()).includes(name));
  console.log(
    "PASS: two real accounts cannot list or open each other's business; mobile form has no overflow",
  );

  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await page.waitForURL(`${base}/ingresar`);
  assert.equal(
    (await owner.request.get(`${base}/api/businesses`)).status(),
    401,
  );
  await page.locator('[name="email"]').fill(email);
  await page.locator('[name="password"]').fill("Password-incorrecta123");
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  try {
    await page
      .getByRole("alert")
      .filter({ hasText: "Revisá el email y la contraseña." })
      .waitFor();
  } catch (error) {
    await page.screenshot({
      path: "/tmp/gastronomia-login-failure.png",
      fullPage: true,
      animations: "disabled",
    });
    console.error(
      "Login page feedback:",
      page.url(),
      await page.getByRole("alert").allTextContents(),
    );
    throw error;
  }
  await page.locator('[name="password"]').fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL(`${base}/panel`);
  await page.getByRole("heading", { name, exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name, exact: true }).waitFor();
  console.log(
    "PASS: sign out revokes browser access; invalid login rejected; real sign in restores the owner's panel",
  );
} finally {
  await owner.close();
  await other.close();
  await browser.close();
}
