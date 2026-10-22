import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BusinessConflict, changeBusinessSlug, createBusiness } from "../src/server/businesses";
import { renamedSlug } from "../src/server/business-hosts";
import { getPool } from "../src/server/postgres";
import { slugInput } from "../src/lib/business-input";

assert.ok(process.env.GASTRONOMIA_ENV_FILE && process.env.SLUG_TEST_HOST, "Use an isolated test environment and explicitly selected endpoint");
process.loadEnvFile(process.env.GASTRONOMIA_ENV_FILE);
assert.match(process.env.NEON_BRANCH ?? "", /^(codex-|test|dev|preview)/);
assert.equal(new URL(process.env.DATABASE_URL!).hostname.replace("-pooler", ""), process.env.SLUG_TEST_HOST);
const pool = getPool();
const taken = (promise: Promise<unknown>) =>
  assert.rejects(promise, (e) => e instanceof BusinessConflict && e.code === "slug_taken");

async function main() {
  const tag = randomUUID().slice(0, 8);
  const create = (slug: string) =>
    createBusiness(`slug-test-${randomUUID()}`, { name: "Lomitos Prueba", slug, kind: "lomito_arabe", whatsapp: "+5493794123456", city: "Corrientes", address: "", requestKey: randomUUID() });

  // Guiones opcionales: las dos formas pasan la validación.
  assert.equal(slugInput.parse(` DafLomitos${tag} `), `daflomitos${tag}`);
  assert.ok(slugInput.safeParse(`daf-lomitos-${tag}`).success);
  assert.ok(!slugInput.safeParse(`daf--lomitos`).success);
  assert.ok(!slugInput.safeParse(`daf lomitos`).success);

  const hyphen = `daf-lomitos-${tag}`;
  const compact = `daflomitos${tag}`;
  const id = await create(hyphen);

  // Cambiar deja la dirección vieja como alias de la nueva.
  assert.equal(await changeBusinessSlug(id, compact), hyphen);
  assert.equal((await pool.query("SELECT slug FROM businesses WHERE id=$1", [id])).rows[0].slug, compact);
  assert.equal(await renamedSlug(hyphen), compact);
  assert.equal(await renamedSlug(compact), null);

  // Nadie más puede quedarse con la dirección vieja ni con la nueva.
  await taken(create(hyphen));
  await taken(create(compact));
  const other = await create(`otro-${tag}`);
  await taken(changeBusinessSlug(other, hyphen));
  await taken(changeBusinessSlug(other, compact));

  // Guardar la misma dirección no hace nada; volver a la vieja la recupera.
  assert.equal(await changeBusinessSlug(id, compact), compact);
  assert.equal(await changeBusinessSlug(id, hyphen), compact);
  assert.equal(await renamedSlug(compact), hyphen);
  assert.equal(await renamedSlug(hyphen), null);
  const aliases = await pool.query("SELECT slug FROM business_slug_aliases WHERE business_id=$1", [id]);
  assert.deepEqual(aliases.rows.map((r) => r.slug), [compact]);

  console.log("PASS: optional hyphens, slug change with alias redirect, uniqueness across aliases and going back");
}
main().catch((e) => { console.error("FAIL:", e); process.exitCode = 1; }).finally(() => pool.end());
