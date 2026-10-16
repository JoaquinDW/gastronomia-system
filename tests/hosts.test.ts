import assert from "node:assert/strict";
import { test } from "node:test";
import { routeHost } from "../src/lib/hosts";

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
