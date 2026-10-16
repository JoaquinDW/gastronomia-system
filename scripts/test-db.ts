import assert from "node:assert/strict";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { getPool, secureConnectionString } from "../src/server/postgres";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}

async function main() {
  const pool = getPool();
  let client: Client | undefined;
  try {
    const { rows } = await pool.query<{ ok: number }>("SELECT 1 AS ok");
    assert.equal(rows[0].ok, 1);
    console.log("PASS: application pooled connection reads from Postgres");

    const directUrl = process.env.DATABASE_URL_UNPOOLED;
    assert.ok(
      directUrl,
      "DATABASE_URL_UNPOOLED is required for the temporary-table test",
    );
    client = new Client({
      connectionString: secureConnectionString(directUrl),
      connectionTimeoutMillis: 10_000,
      query_timeout: 10_000,
      statement_timeout: 5_000,
    });
    await client.connect();
    await client.query("BEGIN");
    await client.query(
      "CREATE TEMP TABLE gastronomia_connection_probe (id uuid PRIMARY KEY, label text NOT NULL) ON COMMIT DROP",
    );
    const id = randomUUID();
    const label = "Prueba de conexión: 'ñ' y $1";
    await client.query(
      "INSERT INTO gastronomia_connection_probe (id, label) VALUES ($1, $2)",
      [id, label],
    );
    const inserted = await client.query<{ label: string }>(
      "SELECT label FROM gastronomia_connection_probe WHERE id = $1",
      [id],
    );
    assert.equal(inserted.rows[0].label, label);
    const updated = await client.query<{ label: string }>(
      "UPDATE gastronomia_connection_probe SET label = $2 WHERE id = $1 RETURNING label",
      [id, "Actualizado"],
    );
    assert.equal(updated.rows[0].label, "Actualizado");
    const deleted = await client.query(
      "DELETE FROM gastronomia_connection_probe WHERE id = $1",
      [id],
    );
    assert.equal(deleted.rowCount, 1);
    console.log(
      "PASS: parameterized INSERT, SELECT, UPDATE and DELETE on a temporary table",
    );
    await client.query("ROLLBACK");
    const remaining = await client.query<{ relation: string | null }>(
      "SELECT to_regclass('pg_temp.gastronomia_connection_probe')::text AS relation",
    );
    assert.equal(remaining.rows[0].relation, null);
    console.log("PASS: rollback verified; no test table or test rows remain");
  } finally {
    // ROLLBACK is harmless after the successful rollback and handles failed assertions.
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* Connection may have failed. */
      }
      await client.end();
    }
    await pool.end();
  }
}

main().catch(() => {
  console.error(
    "FAIL: Postgres integration test failed; check server configuration/connectivity. Secrets omitted.",
  );
  process.exitCode = 1;
});
