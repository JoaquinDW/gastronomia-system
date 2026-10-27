import "server-only";
import { getPool } from "./postgres";

export type AdminBusiness = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  whatsapp: string;
  city: string | null;
  createdAt: Date;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLastSignInAt: Date | null;
  published: boolean;
  products: number;
  lastOrderAt: Date | null;
  orders7: number;
  orders30: number;
  sales7: number;
  sales30: number;
  pending: number;
  billingExempt: boolean;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
};

export type AdminOverview = {
  businesses: AdminBusiness[];
  totals: {
    businesses: number;
    published: number;
    newBusinesses30: number;
    orders7: number;
    orders30: number;
    sales7: number;
    sales30: number;
    ordersToday: number;
  };
};

// Ventas: pedidos aceptados. Pedidos: todo lo que entró, salvo rechazados.
const businessQuery = (withUsers: boolean, withSessions: boolean) => `
  WITH owners AS (
    SELECT DISTINCT ON (business_id) business_id, user_id
    FROM memberships WHERE role = 'owner'
    ORDER BY business_id, created_at
  ),
  order_stats AS (
    SELECT business_id,
      max(created_at) AS last_order_at,
      count(*) FILTER (WHERE status <> 'rejected' AND created_at >= now() - interval '7 days')::int AS orders7,
      count(*) FILTER (WHERE status <> 'rejected' AND created_at >= now() - interval '30 days')::int AS orders30,
      coalesce(sum(total_cents) FILTER (WHERE status = 'accepted' AND created_at >= now() - interval '7 days'), 0)::bigint AS sales7,
      coalesce(sum(total_cents) FILTER (WHERE status = 'accepted' AND created_at >= now() - interval '30 days'), 0)::bigint AS sales30,
      count(*) FILTER (WHERE status = 'pending_confirmation')::int AS pending
    FROM orders GROUP BY business_id
  ),
  product_stats AS (
    SELECT business_id, count(*)::int AS products
    FROM menu_products WHERE archived_at IS NULL GROUP BY business_id
  )
  SELECT b.id, b.name, b.slug, b.kind, b.whatsapp, b.created_at AS "createdAt",
    b.billing_exempt AS "billingExempt", b.trial_ends_at AS "trialEndsAt", b.paid_until AS "paidUntil",
    (SELECT city FROM locations WHERE business_id = b.id ORDER BY created_at, id LIMIT 1) AS city,
    coalesce(o.user_id, b.created_by_user_id) AS "ownerId",
    ${withUsers ? 'u.name AS "ownerName", u.email AS "ownerEmail"' : 'NULL AS "ownerName", NULL AS "ownerEmail"'},
    ${withUsers && withSessions ? `(SELECT max(session."createdAt") FROM neon_auth.session session
      WHERE session."userId" = u.id AND session."impersonatedBy" IS NULL)` : "NULL"} AS "ownerLastSignInAt",
    coalesce(s.is_published, false) AS published,
    coalesce(p.products, 0) AS products,
    os.last_order_at AS "lastOrderAt",
    coalesce(os.orders7, 0) AS orders7,
    coalesce(os.orders30, 0) AS orders30,
    coalesce(os.sales7, 0) AS sales7,
    coalesce(os.sales30, 0) AS sales30,
    coalesce(os.pending, 0) AS pending
  FROM businesses b
  LEFT JOIN owners o ON o.business_id = b.id
  LEFT JOIN store_settings s ON s.business_id = b.id
  LEFT JOIN order_stats os ON os.business_id = b.id
  LEFT JOIN product_stats p ON p.business_id = b.id
  ${withUsers ? 'LEFT JOIN neon_auth."user" u ON u.id::text = coalesce(o.user_id, b.created_by_user_id)' : ""}
  ORDER BY os.last_order_at DESC NULLS LAST, b.created_at DESC
  LIMIT 1000`;

export async function adminOverview(): Promise<AdminOverview> {
  const pool = getPool();
  // Neon Auth guarda las cuentas en neon_auth."user"; si no está, sin email.
  const { rows: auth } = await pool.query<{ ok: boolean; sessions: boolean }>(
    `SELECT to_regclass('neon_auth."user"') IS NOT NULL AS ok,
      to_regclass('neon_auth.session') IS NOT NULL AS sessions`,
  );
  // Auth es opcional para el resumen. Si no podemos leer sesiones,
  // conservamos los datos del dueño; si tampoco podemos leer usuarios,
  // los números y contactos de los negocios siguen disponibles.
  async function loadBusinesses(
    withUsers: boolean,
    withSessions: boolean,
  ): Promise<AdminBusiness[]> {
    try {
      return (
        await pool.query<AdminBusiness>(businessQuery(withUsers, withSessions))
      ).rows;
    } catch (error) {
      if (withSessions) return loadBusinesses(withUsers, false);
      if (withUsers) return loadBusinesses(false, false);
      throw error;
    }
  }
  const rows = await loadBusinesses(
    Boolean(auth[0]?.ok),
    Boolean(auth[0]?.ok && auth[0]?.sessions),
  );
  const businesses = rows.map((row) => ({
    ...row,
    sales7: Number(row.sales7),
    sales30: Number(row.sales30),
  }));
  const { rows: today } = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM orders
     WHERE status <> 'rejected' AND created_at >= now() - interval '24 hours'`,
  );
  const sum = (key: "orders7" | "orders30" | "sales7" | "sales30") =>
    businesses.reduce((total, business) => total + business[key], 0);
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return {
    businesses,
    totals: {
      businesses: businesses.length,
      published: businesses.filter((business) => business.published).length,
      newBusinesses30: businesses.filter(
        (business) => new Date(business.createdAt).getTime() >= monthAgo,
      ).length,
      orders7: sum("orders7"),
      orders30: sum("orders30"),
      sales7: sum("sales7"),
      sales30: sum("sales30"),
      ordersToday: today[0]?.count ?? 0,
    },
  };
}
