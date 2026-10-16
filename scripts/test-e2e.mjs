import assert from "node:assert/strict";

const base = process.env.APP_URL ?? "http://localhost:3000";
const response = await fetch(`${base}/`, {
  signal: AbortSignal.timeout(15_000),
});
assert.equal(response.status, 200);
const html = await response.text();
assert.match(html, /Tu tienda online\./);
assert.match(html, /Crear mi tienda/);
assert.doesNotMatch(html, /Neon|Postgres/);
assert.doesNotMatch(html, /postgres(?:ql)?:\/\//i);
console.log(
  "PASS: GET / returns 200 and the landing page without connection secrets",
);

const health = await fetch(`${base}/api/health/db`, {
  signal: AbortSignal.timeout(15_000),
});
assert.equal(health.status, 200);
assert.match(health.headers.get("cache-control") ?? "", /no-store/);
const body = await health.json();
assert.deepEqual(body, { status: "ok", service: "postgres" });
console.log(
  `PASS: GET /api/health/db returns 200 ${JSON.stringify(body)} with no-store`,
);
console.log(
  "PASS: running app -> route handler -> Neon Postgres -> HTTP response",
);
