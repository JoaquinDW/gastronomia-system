import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Comprobar conexión" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Conexión verificada con Postgres." })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "/tmp/gastronomia-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    "PASS: desktop interaction verifies the real Neon connection; no horizontal overflow",
  );

  await page.route("**/api/health/db", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ status: "unavailable", service: "postgres" }),
    }),
  );
  await page.getByRole("button", { name: "Comprobar conexión" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "No pudimos conectar." })
    .waitFor();
  await page.unroute("**/api/health/db");
  await page.getByRole("button", { name: "Comprobar conexión" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Conexión verificada con Postgres." })
    .waitFor();
  console.log(
    "PASS: simulated unavailable response displays an error; retry recovers with a real query",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Conocé el alcance de la V1" }).click();
  assert.match(page.url(), /#alcance$/);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Comprobar conexión" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Conexión verificada con Postgres." })
    .waitFor();
  await page.screenshot({
    path: "/tmp/gastronomia-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile layout, scope navigation and database interaction; no JavaScript errors",
  );
} finally {
  await browser.close();
}
