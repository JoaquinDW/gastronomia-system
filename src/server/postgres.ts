import "server-only";
import { parseEnv } from "@neon/env";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import config from "../../neon";

const connectionState = globalThis as typeof globalThis & {
  gastronomiaPool?: Pool;
};

export function secureConnectionString(value: string): string {
  const url = new URL(value);
  // Verify the server certificate and hostname, including with older pg defaults.
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

export function getPool(): Pool {
  if (!connectionState.gastronomiaPool) {
    const { postgres } = parseEnv(config, ["DATABASE_URL"]);
    const pool = new Pool({
      connectionString: secureConnectionString(postgres.databaseUrl),
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
      statement_timeout: 5_000,
      query_timeout: 8_000,
      application_name: "gastronomia-system",
    });

    // Never print driver errors: they may contain connection or query details.
    pool.on("error", () =>
      console.error("[postgres] Idle connection unavailable"),
    );
    if (process.env.VERCEL) attachDatabasePool(pool);
    connectionState.gastronomiaPool = pool;
  }
  return connectionState.gastronomiaPool;
}
