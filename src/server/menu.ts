import "server-only";
import { getPool } from "./postgres";
import {
  emptySettings,
  normalizeName,
  type Product,
  type ProductInput,
  type StoreSettings,
  type StoreSettingsInput,
} from "@/lib/menu";
import { HttpError } from "./errors";
import type { PoolClient } from "pg";

const productFields = `id, name, description, category, kind, variants, add_ons AS "addOns", COALESCE(image_url,'') AS "imageUrl", is_available AS "isAvailable", sort_order AS "sortOrder", version`;
const settingsFields = `description, menu_note AS "menuNote", hours, pickup_enabled AS "pickupEnabled", pickup_instructions AS "pickupInstructions", delivery_enabled AS "deliveryEnabled", delivery_zones AS "deliveryZones", payment_methods AS "paymentMethods", transfer_alias AS "transferAlias", is_published AS "isPublished", version`;

function requireStoreConfiguration(s: StoreSettingsInput) {
  if (!s.hours.length)
    throw new HttpError(422, "Configurá al menos un horario de atención.");
  if (!s.pickupEnabled && !s.deliveryEnabled)
    throw new HttpError(422, "Habilitá retiro o delivery.");
  if (s.deliveryEnabled && !s.deliveryZones.length)
    throw new HttpError(
      422,
      "Agregá al menos una zona de delivery con su tarifa.",
    );
}

export async function getProducts(businessId: string): Promise<Product[]> {
  const { rows } = await getPool().query<Product>(
    `SELECT ${productFields} FROM menu_products WHERE business_id=$1 AND archived_at IS NULL ORDER BY sort_order, created_at, id`,
    [businessId],
  );
  return rows;
}
export async function getSettings(businessId: string): Promise<StoreSettings> {
  const { rows } = await getPool().query<StoreSettings>(
    `SELECT ${settingsFields} FROM store_settings WHERE business_id=$1`,
    [businessId],
  );
  return rows[0] ?? { ...emptySettings };
}
export async function lockBusiness(client: PoolClient, businessId: string) {
  await client.query("SELECT id FROM businesses WHERE id=$1 FOR UPDATE", [
    businessId,
  ]);
}
export async function insertProduct(
  client: PoolClient,
  businessId: string,
  p: ProductInput,
): Promise<Product> {
  const { rows } = await client.query<Product>(
    `INSERT INTO menu_products(business_id,name,description,category,kind,variants,add_ons,image_url,is_available,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${productFields}`,
    [
      businessId,
      p.name,
      p.description,
      p.category,
      p.kind,
      JSON.stringify(p.variants),
      JSON.stringify(p.addOns),
      p.imageUrl || null,
      p.isAvailable,
      p.sortOrder,
    ],
  );
  return rows[0];
}
export async function saveProduct(
  businessId: string,
  p: ProductInput,
  id?: string,
  version?: number,
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await lockBusiness(client, businessId);
    const names = await client.query<{ id: string; name: string }>(
      "SELECT id,name FROM menu_products WHERE business_id=$1 AND archived_at IS NULL",
      [businessId],
    );
    if (
      names.rows.some(
        (r) => r.id !== id && normalizeName(r.name) === normalizeName(p.name),
      )
    )
      throw new HttpError(
        409,
        "Ya hay un producto con ese nombre. Editá el existente o usá otro nombre.",
      );
    let product: Product;
    if (id) {
      const { rows } = await client.query<Product>(
        `UPDATE menu_products SET name=$3,description=$4,category=$5,kind=$6,variants=$7,add_ons=$8,image_url=$9,is_available=$10,sort_order=$11,version=version+1,updated_at=now() WHERE business_id=$1 AND id=$2 AND version=$12 AND archived_at IS NULL RETURNING ${productFields}`,
        [
          businessId,
          id,
          p.name,
          p.description,
          p.category,
          p.kind,
          JSON.stringify(p.variants),
          JSON.stringify(p.addOns),
          p.imageUrl || null,
          p.isAvailable,
          p.sortOrder,
          version,
        ],
      );
      if (!rows[0])
        throw new HttpError(
          409,
          "El producto cambió en otra pantalla. Recargá la carta antes de editarlo.",
        );
      product = rows[0];
    } else product = await insertProduct(client, businessId, p);
    await client.query("COMMIT");
    return product;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function archiveProduct(
  businessId: string,
  id: string,
  version: number,
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await lockBusiness(client, businessId);
    const result = await client.query(
      "UPDATE menu_products SET archived_at=now(),version=version+1 WHERE business_id=$1 AND id=$2 AND version=$3 AND archived_at IS NULL",
      [businessId, id, version],
    );
    if (!result.rowCount)
      throw new HttpError(409, "El producto cambió. Recargá la carta.");
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function saveSettings(
  businessId: string,
  s: StoreSettingsInput,
  version: number,
) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await lockBusiness(client, businessId);
    const inserted = await client.query(
      "INSERT INTO store_settings(business_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING business_id",
      [businessId],
    );
    const existing = await client.query<{
      version: number;
      isPublished: boolean;
    }>(
      'SELECT version,is_published AS "isPublished" FROM store_settings WHERE business_id=$1 FOR UPDATE',
      [businessId],
    );
    if (
      (version === 0 && !inserted.rowCount) ||
      (version > 0 && existing.rows[0].version !== version)
    )
      throw new HttpError(
        409,
        "La configuración cambió en otra pantalla. Recargá antes de guardar.",
      );
    if (existing.rows[0].isPublished) requireStoreConfiguration(s);
    await client.query(
      `UPDATE store_settings SET description=$2,menu_note=$3,hours=$4,pickup_enabled=$5,pickup_instructions=$6,delivery_enabled=$7,delivery_zones=$8,payment_methods=$9,transfer_alias=$10,version=version+1,updated_at=now() WHERE business_id=$1`,
      [
        businessId,
        s.description,
        s.menuNote,
        JSON.stringify(s.hours),
        s.pickupEnabled,
        s.pickupInstructions,
        s.deliveryEnabled,
        JSON.stringify(s.deliveryZones),
        JSON.stringify(s.paymentMethods),
        s.transferAlias,
      ],
    );
    await client.query("COMMIT");
    return getSettings(businessId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function publishStore(businessId: string, publish: boolean) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await lockBusiness(client, businessId);
    const { rows } = await client.query<StoreSettings>(
      `SELECT ${settingsFields} FROM store_settings WHERE business_id=$1 FOR UPDATE`,
      [businessId],
    );
    const s = rows[0];
    if (!s)
      throw new HttpError(422, "Guardá primero los horarios y las entregas.");
    if (publish) {
      const count = await client.query(
        "SELECT id FROM menu_products WHERE business_id=$1 AND archived_at IS NULL AND is_available LIMIT 1",
        [businessId],
      );
      if (!count.rowCount)
        throw new HttpError(
          422,
          "Agregá al menos un producto disponible a tu carta.",
        );
      requireStoreConfiguration(s);
    }
    await client.query(
      "UPDATE store_settings SET is_published=$2,version=version+1,updated_at=now() WHERE business_id=$1",
      [businessId, publish],
    );
    await client.query("COMMIT");
    return getSettings(businessId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function publicStore(slug: string, previewUserId?: string) {
  const { rows } = await getPool().query<{
    id: string;
    name: string;
    slug: string;
    whatsapp: string;
    city: string;
    address: string | null;
    timezone: string;
  }>(
    `SELECT b.id,b.name,b.slug,b.whatsapp,b.timezone,(SELECT city FROM locations WHERE business_id=b.id ORDER BY created_at,id LIMIT 1) AS city,(SELECT address FROM locations WHERE business_id=b.id ORDER BY created_at,id LIMIT 1) AS address FROM businesses b LEFT JOIN store_settings s ON s.business_id=b.id WHERE b.slug=$1 AND (s.is_published OR EXISTS(SELECT 1 FROM memberships m WHERE m.business_id=b.id AND m.user_id=$2 AND m.role IN ('owner','manager')))`,
    [slug, previewUserId ?? null],
  );
  if (!rows[0]) return null;
  const [products, settings] = await Promise.all([
    getProducts(rows[0].id),
    getSettings(rows[0].id),
  ]);
  return {
    business: {
      ...rows[0],
      address: settings.pickupEnabled ? rows[0].address : null,
    },
    products: products.filter((p) => p.isAvailable),
    settings,
  };
}
