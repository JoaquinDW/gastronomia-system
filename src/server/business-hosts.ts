import "server-only";
import { getPool } from "./postgres";

// El proxy traduce slug <-> id en cada request de la gestión; el slug casi
// nunca cambia, así que un caché corto en memoria evita consultar la base
// cada vez. Si cambia, la dirección vieja queda como alias y redirige.
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

export function forgetBusinessHost(id: string, slug: string) {
  cache.delete(`id:${id}`);
  cache.delete(`slug:${slug}`);
}

// Dirección actual de un negocio que dejó de usar `slug`; sin caché porque
// solo se consulta cuando la dirección pedida no existe.
export async function renamedSlug(slug: string) {
  const { rows } = await getPool().query<{ slug: string }>(
    `SELECT b.slug FROM business_slug_aliases a
     JOIN businesses b ON b.id = a.business_id WHERE a.slug = $1`,
    [slug],
  );
  return rows[0]?.slug ?? null;
}
