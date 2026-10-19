import "server-only";
import { getPool } from "./postgres";
import {
  defaultTicketConfig,
  type ProductCategory,
  type TicketConfig,
} from "@/lib/ticket";

export async function getTicketConfig(
  businessId: string,
): Promise<TicketConfig> {
  const { rows } = await getPool().query<{ ticketConfig: TicketConfig }>(
    'SELECT ticket_config AS "ticketConfig" FROM store_settings WHERE business_id=$1',
    [businessId],
  );
  return { ...defaultTicketConfig, ...rows[0]?.ticketConfig };
}

// Printing preferences don't bump the store version, so saving them never
// conflicts with someone editing the store at the same time.
export async function saveTicketConfig(
  businessId: string,
  config: TicketConfig,
): Promise<TicketConfig> {
  await getPool().query(
    "INSERT INTO store_settings(business_id,ticket_config) VALUES($1,$2) ON CONFLICT(business_id) DO UPDATE SET ticket_config=EXCLUDED.ticket_config,updated_at=now()",
    [businessId, JSON.stringify(config)],
  );
  return getTicketConfig(businessId);
}

// Archived products too, so old orders still print under their category.
export async function productCategories(
  businessId: string,
): Promise<ProductCategory[]> {
  const { rows } = await getPool().query<ProductCategory>(
    "SELECT id,category FROM menu_products WHERE business_id=$1 ORDER BY archived_at NULLS FIRST,sort_order,created_at,id",
    [businessId],
  );
  return rows;
}
