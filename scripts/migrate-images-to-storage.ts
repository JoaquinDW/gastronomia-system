// Copies product and cover photos still stored in Postgres to Neon Object Storage.
// Safe to run more than once and while the site is live: each photo keeps its
// /api/media/<id> URL, which starts redirecting to the bucket as soon as its row is copied.
//
//   npm run images:to-storage               copies photos and keeps the bytes as backup
//   npm run images:to-storage -- --liberar  also clears the bytes of photos already copied
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { getPool } from "../src/server/postgres";
import {
  storageEnabled,
  uploadMenuImageFiles,
} from "../src/server/menu-images";

const envFile = process.env.GASTRONOMIA_ENV_FILE ?? ".env.local";
if (existsSync(envFile)) loadEnvFile(envFile);

async function main() {
  if (!storageEnabled())
    throw new Error(
      "Faltan AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3 y AWS_REGION (neon env pull).",
    );
  const pool = getPool();
  let copied = 0;
  for (;;) {
    const { rows } = await pool.query<{
      id: string;
      businessId: string;
      large: Buffer;
      small: Buffer;
    }>(
      `SELECT id, business_id AS "businessId", large, small FROM menu_images
       WHERE storage_key IS NULL AND large IS NOT NULL AND small IS NOT NULL
       ORDER BY created_at LIMIT 10`,
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      const key = await uploadMenuImageFiles(row.businessId, row.id, row);
      await pool.query(
        `UPDATE menu_images SET storage_key=$2 WHERE id=$1 AND storage_key IS NULL`,
        [row.id, key],
      );
      copied++;
    }
    console.log(`Copiadas ${copied} fotos…`);
  }
  const { rows } = await pool.query<{ pending: number }>(
    `SELECT count(*)::int AS pending FROM menu_images WHERE storage_key IS NULL`,
  );
  console.log(`Listo: ${copied} copiadas, ${rows[0].pending} sin copiar.`);
  if (process.argv.includes("--liberar")) {
    const { rowCount } = await pool.query(
      `UPDATE menu_images SET large=NULL, small=NULL
       WHERE storage_key IS NOT NULL AND large IS NOT NULL`,
    );
    console.log(`Liberados los bytes de ${rowCount ?? 0} fotos en Postgres.`);
  }
  await pool.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
