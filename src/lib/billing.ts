// Cobro manual: sin suscripción. Cada negocio nuevo arranca con una prueba
// gratis y el superadmin anota a mano hasta cuándo está pago. Los negocios que
// ya existían cuando se sumó esto quedan exentos.

export const trialDays = 14;
export const launchPriceCents = 990_000;
export const launchMonths = 3;
export const regularPriceCents = 1_590_000;

export type BillingFields = {
  billingExempt: boolean;
  trialEndsAt: Date | string | null;
  paidUntil: Date | string | null;
};

export type BillingState =
  | { kind: "exempt" }
  | { kind: "paid"; until: Date; daysLeft: number }
  | { kind: "trial"; until: Date; daysLeft: number }
  | { kind: "expired"; since: Date; daysAgo: number };

const day = 24 * 60 * 60 * 1000;
const toDate = (value: Date | string | null) =>
  value ? new Date(value) : null;

export function billingState(
  fields: BillingFields,
  now = Date.now(),
): BillingState {
  if (fields.billingExempt) return { kind: "exempt" };
  const paid = toDate(fields.paidUntil);
  if (paid && paid.getTime() > now)
    return {
      kind: "paid",
      until: paid,
      daysLeft: Math.ceil((paid.getTime() - now) / day),
    };
  const trial = toDate(fields.trialEndsAt);
  if (trial && trial.getTime() > now)
    return {
      kind: "trial",
      until: trial,
      daysLeft: Math.ceil((trial.getTime() - now) / day),
    };
  // Sin fechas no hay nada que cobrar todavía: se trata como exento.
  const since = [paid, trial]
    .filter((date): date is Date => !!date)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (!since) return { kind: "exempt" };
  return {
    kind: "expired",
    since,
    daysAgo: Math.floor((now - since.getTime()) / day),
  };
}

// Suma meses pagos desde el vencimiento actual o desde hoy, lo que sea más
// tarde, así un pago adelantado no pisa los días que ya tenía.
export function extendPaidUntil(
  paidUntil: Date | string | null,
  months: number,
  now = Date.now(),
): Date {
  const current = toDate(paidUntil);
  const base = new Date(
    current && current.getTime() > now ? current.getTime() : now,
  );
  const target = new Date(base);
  target.setUTCMonth(target.getUTCMonth() + months);
  // 31 de enero + 1 mes no salta a marzo: queda en el último día de febrero.
  if (target.getUTCDate() !== base.getUTCDate()) target.setUTCDate(0);
  return target;
}

export const daysLabel = (days: number) =>
  days === 1 ? "1 día" : `${days} días`;
