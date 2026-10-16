import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

const envFile = process.env.GASTRONOMIA_ENV_FILE ?? ".env.local";
if (existsSync(envFile)) loadEnvFile(envFile);
const connectionUrl = process.env.DATABASE_URL_UNPOOLED;
const url = connectionUrl ? new URL(connectionUrl) : null;
url?.searchParams.set("sslmode", "verify-full");

export default defineConfig({
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: url?.toString() ?? "" },
});
