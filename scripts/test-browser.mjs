import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = process.env.APP_URL ?? "http://localhost:3000";
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "En marcha en tres pasos." })
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
  console.log("PASS: desktop landing renders; no horizontal overflow");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Cómo funciona" }).click();
  assert.match(page.url(), /#como-funciona$/);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "/tmp/gastronomia-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile layout and in-page navigation; no JavaScript errors",
  );
} finally {
  await browser.close();
}
