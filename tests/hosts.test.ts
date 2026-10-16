import assert from "node:assert/strict";
import { test } from "node:test";
import {
  businessPanelUrl,
  panelBase,
  routeHost,
  safeNext,
  sessionCookieDomain,
} from "../src/lib/hosts";

test("separa landing, panel y tiendas por host", () => {
  const root = "pedipue.com";
  assert.deepEqual(routeHost("pedipue.com", root), { kind: "site" });
  assert.deepEqual(routeHost("www.pedipue.com", root), { kind: "site" });
  assert.deepEqual(routeHost("APP.pedipue.com", root), { kind: "app" });
  assert.deepEqual(routeHost("la-esquina.pedipue.com", root), {
    kind: "store",
    slug: "la-esquina",
  });
  assert.deepEqual(routeHost("admin.pedipue.com", root), { kind: "unused" });
  assert.deepEqual(routeHost("a.b.pedipue.com", root), { kind: "unused" });
  assert.deepEqual(routeHost("otro.vercel.app", root), { kind: "other" });
  assert.deepEqual(routeHost("pedipue.com", ""), { kind: "other" });
});

test("funciona con puerto en desarrollo", () => {
  const root = "localhost:3000";
  assert.deepEqual(routeHost("app.localhost:3000", root), { kind: "app" });
  assert.deepEqual(routeHost("pastas.localhost:3000", root), {
    kind: "store",
    slug: "pastas",
  });
});

test("la gestión de cada local vive en app./<slug>", () => {
  const id = "209fffa6-5109-4079-b6da-db564010c5a7";
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = "pedipue.com";
  assert.equal(panelBase(id, "la-esquina"), "/la-esquina");
  assert.equal(
    businessPanelUrl(id, "la-esquina"),
    "https://app.pedipue.com/la-esquina",
  );
  assert.equal(sessionCookieDomain(), ".pedipue.com");
  assert.equal(
    safeNext("https://la-esquina.pedipue.com/panel/gestion"),
    "https://la-esquina.pedipue.com/panel/gestion",
  );
  assert.equal(safeNext("https://evil.com/panel"), null);
  assert.equal(safeNext("http://la-esquina.pedipue.com/panel"), null);
  assert.equal(safeNext("https://www.pedipue.com/"), null);

  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  assert.equal(panelBase(id, "la-esquina"), `/panel/negocios/${id}`);
  assert.equal(businessPanelUrl(id, "la-esquina"), `/panel/negocios/${id}`);
  assert.equal(sessionCookieDomain(), undefined);
  assert.equal(safeNext("https://la-esquina.pedipue.com/panel"), null);
});
