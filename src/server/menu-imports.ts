import "server-only";
import { getPool } from "./postgres";
import { HttpError } from "./http";
import { insertProduct, lockBusiness } from "./menu";
import { normalizeName, type ProductInput } from "@/lib/menu";
import type { MenuExtraction } from "@/lib/menu-extraction";

export async function claimImport(
  businessId: string,
  userId: string,
  requestKey: string,
  model: string,
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await lockBusiness(client, businessId);
    const existing = await client.query<{
      id: string;
      status: string;
      draft: MenuExtraction | null;
    }>(
      "SELECT id,status,draft FROM menu_imports WHERE business_id=$1 AND request_key=$2",
      [businessId, requestKey],
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return { ...existing.rows[0], fresh: false };
    }
    const counts = await client.query<{ daily: number; active: number }>(
      "SELECT count(*) FILTER(WHERE created_at>now()-interval '24 hours')::int AS daily,count(*) FILTER(WHERE status='processing' AND created_at>now()-interval '3 minutes')::int AS active FROM menu_imports WHERE business_id=$1",
      [businessId],
    );
    const userCount = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM menu_imports WHERE user_id=$1 AND created_at>now()-interval '24 hours'",
      [userId],
    );
    if (counts.rows[0].daily >= 20 || userCount.rows[0].n >= 50)
      throw new HttpError(
        429,
        "Llegaste al límite diario de importaciones. Podés seguir cargando productos manualmente.",
      );
    if (counts.rows[0].active)
      throw new HttpError(
        409,
        "Ya hay una carta en análisis. Esperá a que termine antes de iniciar otra.",
      );
    const { rows } = await client.query<{
      id: string;
      status: string;
      draft: MenuExtraction | null;
    }>(
      "INSERT INTO menu_imports(business_id,user_id,request_key,model) VALUES($1,$2,$3,$4) RETURNING id,status,draft",
      [businessId, userId, requestKey, model],
    );
    await client.query("COMMIT");
    return { ...rows[0], fresh: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function recentImports(businessId: string) {
  const { rows } = await getPool().query(
    "SELECT id,status,draft,created_at AS \"createdAt\" FROM menu_imports WHERE business_id=$1 AND status IN ('ready','committed') ORDER BY created_at DESC LIMIT 5",
    [businessId],
  );
  return rows;
}
export async function commitImport(
  businessId: string,
  importId: string,
  products: ProductInput[],
  note: string | null,
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await lockBusiness(client, businessId);
    const { rows } = await client.query<{
      status: string;
      draft: MenuExtraction & { result?: { saved: number; skipped: number } };
    }>(
      "SELECT status,draft FROM menu_imports WHERE id=$1 AND business_id=$2 FOR UPDATE",
      [importId, businessId],
    );
    const record = rows[0];
    if (!record) throw new HttpError(404, "No encontramos esta importación.");
    if (record.status === "committed") {
      await client.query("COMMIT");
      return record.draft.result;
    }
    if (record.status !== "ready")
      throw new HttpError(
        409,
        "Esta carta todavía no está lista para guardar.",
      );
    const current = await client.query<{ name: string }>(
      "SELECT name FROM menu_products WHERE business_id=$1 AND archived_at IS NULL",
      [businessId],
    );
    const names = new Set(current.rows.map((p) => normalizeName(p.name)));
    let saved = 0,
      skipped = 0;
    for (const p of products) {
      const name = normalizeName(p.name);
      if (names.has(name)) {
        skipped++;
        continue;
      }
      await insertProduct(client, businessId, p);
      names.add(name);
      saved++;
    }
    if (note !== null) {
      await client.query(
        "INSERT INTO store_settings(business_id,menu_note) VALUES($1,$2) ON CONFLICT(business_id) DO UPDATE SET menu_note=EXCLUDED.menu_note,version=store_settings.version+1,updated_at=now()",
        [businessId, note],
      );
    }
    const result = { saved, skipped };
    await client.query(
      "UPDATE menu_imports SET status='committed',committed_at=now(),draft=$3 WHERE business_id=$1 AND id=$2",
      [businessId, importId, JSON.stringify({ ...record.draft, result })],
    );
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
