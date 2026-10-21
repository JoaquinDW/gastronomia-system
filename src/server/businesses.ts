import "server-only";
import { createHash } from "node:crypto";
import { getPool } from "./postgres";
import type { BusinessInput } from "@/lib/business-input";

export class BusinessConflict extends Error {
  constructor(public readonly code: "slug_taken" | "request_reused") {
    super(code);
  }
}

export type Business = {
  id: string;
  name: string;
  slug: string;
  kind: BusinessInput["kind"];
  whatsapp: string;
  city: string;
  address: string | null;
  role: string;
  billingExempt: boolean;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
};

const businessFields = `b.id, b.name, b.slug, b.kind, b.whatsapp, m.role,
  b.billing_exempt AS "billingExempt", b.trial_ends_at AS "trialEndsAt", b.paid_until AS "paidUntil",
  (SELECT city FROM locations WHERE business_id = b.id ORDER BY created_at, id LIMIT 1) AS city,
  (SELECT address FROM locations WHERE business_id = b.id ORDER BY created_at, id LIMIT 1) AS address`;

export async function listBusinesses(userId: string): Promise<Business[]> {
  const { rows } = await getPool().query<Business>(
    `SELECT ${businessFields} FROM businesses b
     JOIN memberships m ON m.business_id = b.id
     WHERE m.user_id = $1 ORDER BY b.created_at DESC, b.id LIMIT 100`,
    [userId],
  );
  return rows;
}

export async function findBusiness(
  userId: string,
  businessId: string,
): Promise<Business | null> {
  const { rows } = await getPool().query<Business>(
    `SELECT ${businessFields} FROM businesses b
     JOIN memberships m ON m.business_id = b.id
     WHERE m.user_id = $1 AND b.id = $2`,
    [userId, businessId],
  );
  return rows[0] ?? null;
}

export async function createBusiness(
  userId: string,
  input: BusinessInput,
): Promise<string> {
  const { requestKey, ...details } = input;
  const hash = createHash("sha256")
    .update(JSON.stringify(details))
    .digest("hex");
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO businesses (name, slug, kind, whatsapp, created_by_user_id, onboarding_key, onboarding_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (created_by_user_id, onboarding_key) DO NOTHING RETURNING id`,
      [
        input.name,
        input.slug,
        input.kind,
        input.whatsapp,
        userId,
        requestKey,
        hash,
      ],
    );
    let businessId = inserted.rows[0]?.id;
    if (!businessId) {
      const existing = await client.query<{
        id: string;
        onboarding_hash: string;
      }>(
        "SELECT id, onboarding_hash FROM businesses WHERE created_by_user_id = $1 AND onboarding_key = $2",
        [userId, requestKey],
      );
      if (existing.rows[0]?.onboarding_hash !== hash)
        throw new BusinessConflict("request_reused");
      businessId = existing.rows[0].id;
    } else {
      await client.query(
        "INSERT INTO locations (business_id, city, address) VALUES ($1, $2, $3)",
        [businessId, input.city, input.address || null],
      );
      await client.query(
        "INSERT INTO memberships (business_id, user_id, role) VALUES ($1, $2, 'owner')",
        [businessId, userId],
      );
    }
    await client.query("COMMIT");
    return businessId;
  } catch (error) {
    await client.query("ROLLBACK");
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new BusinessConflict("slug_taken");
    }
    throw error;
  } finally {
    client.release();
  }
}
