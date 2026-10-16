import "server-only";
import { getPool } from "./postgres";

// El proxy traduce slug <-> id en cada request de la gestión; el slug no
// cambia, así que un caché corto en memoria evita consultar la base cada vez.
const ttl = 5 * 60_000;
const cache = new Map<string, { value: string | null; at: number }>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function lookup(key: string, sql: string, param: string) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const { rows } = await getPool().query<{ value: string }>(sql, [param]);
  const value = rows[0]?.value ?? null;
  if (cache.size > 1000) cache.clear();
  if (value) cache.set(key, { value, at: Date.now() });
  return value;
}

export function businessIdForSlug(slug: string) {
  return lookup(
    `slug:${slug}`,
    "SELECT id::text AS value FROM businesses WHERE slug = $1",
    slug,
  );
}

export async function businessSlugForId(id: string) {
  if (!uuid.test(id)) return null;
  return lookup(
    `id:${id}`,
    "SELECT slug AS value FROM businesses WHERE id = $1",
    id,
  );
}
