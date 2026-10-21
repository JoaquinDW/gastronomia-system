import "server-only";
import { extendPaidUntil, trialDays } from "@/lib/billing";
import { HttpError } from "./errors";
import { getPool } from "./postgres";

export type BillingAction =
  | { action: "add_month" }
  | { action: "extend_trial" }
  | { action: "set_exempt"; exempt: boolean };

// Solo lo usa el superadmin: anota a mano un pago, estira la prueba o marca
// el negocio como exento (por ejemplo, un local invitado antes de la campaña).
export async function updateBilling(businessId: string, change: BillingAction) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      paidUntil: Date | null;
      trialEndsAt: Date | null;
    }>(
      `SELECT paid_until AS "paidUntil", trial_ends_at AS "trialEndsAt"
       FROM businesses WHERE id = $1 FOR UPDATE`,
      [businessId],
    );
    const current = rows[0];
    if (!current) throw new HttpError(404, "No encontramos el negocio.");
    if (change.action === "add_month") {
      await client.query(
        "UPDATE businesses SET paid_until = $2, billing_exempt = false WHERE id = $1",
        [businessId, extendPaidUntil(current.paidUntil, 1)],
      );
    } else if (change.action === "extend_trial") {
      const base = Math.max(
        Date.now(),
        current.trialEndsAt ? new Date(current.trialEndsAt).getTime() : 0,
      );
      await client.query(
        "UPDATE businesses SET trial_ends_at = $2 WHERE id = $1",
        [businessId, new Date(base + 7 * 24 * 60 * 60 * 1000)],
      );
    } else {
      // Al quitar la exención sin fechas, arranca una prueba nueva desde hoy.
      await client.query(
        `UPDATE businesses SET billing_exempt = $2,
           trial_ends_at = CASE WHEN NOT $2 AND trial_ends_at IS NULL AND paid_until IS NULL
             THEN now() + make_interval(days => $3) ELSE trial_ends_at END
         WHERE id = $1`,
        [businessId, change.exempt, trialDays],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
