import { z } from "zod";

// Cash register shift: open with a float, take payments against orders,
// close with a blind count. The expected cash is only revealed after the
// count, so whoever counts can't just type the number the system wants.

export const paymentMethods = ["cash", "transfer", "qr", "card"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  qr: "QR",
  card: "Tarjeta",
};

/** payment: a charge against an order; deposit/withdrawal: cash in or out of the drawer. */
export const movementKinds = ["payment", "deposit", "withdrawal"] as const;
export type MovementKind = (typeof movementKinds)[number];
export const movementLabels: Record<MovementKind, string> = {
  payment: "Cobro",
  deposit: "Ingreso",
  withdrawal: "Retiro",
};

const MAX_CENTS = 1_999_999_999;
const cents = z.number().int().min(0).max(MAX_CENTS);
const positive = z.number().int().min(1).max(MAX_CENTS);
const reason = z.string().trim().min(3, "Contá el motivo en pocas palabras.").max(200);

export const cashCommand = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("open"), requestKey: z.uuid(), openingCents: cents })
    .strict(),
  z
    .object({
      type: z.literal("payment"),
      requestKey: z.uuid(),
      orderId: z.uuid(),
      method: z.enum(paymentMethods),
      amountCents: positive,
      /** Cash only: the bill the customer handed over, to work out the change. */
      tenderedCents: positive.nullable().default(null),
    })
    .strict()
    .refine((p) => p.tenderedCents === null || p.method === "cash", {
      path: ["tenderedCents"],
      message: "El vuelto es solo para efectivo.",
    })
    .refine((p) => p.tenderedCents === null || p.tenderedCents >= p.amountCents, {
      path: ["tenderedCents"],
      message: "Con lo que paga no alcanza para cubrir el cobro.",
    }),
  z
    .object({
      type: z.literal("movement"),
      requestKey: z.uuid(),
      kind: z.enum(["deposit", "withdrawal"]),
      amountCents: positive,
      note: reason,
    })
    .strict(),
  z
    .object({
      type: z.literal("void"),
      movementId: z.uuid(),
      reason,
    })
    .strict(),
  z
    .object({
      type: z.literal("close"),
      requestKey: z.uuid(),
      sessionId: z.uuid(),
      /** The cash counted in the drawer, typed without seeing the expected amount. */
      declaredCents: cents,
      note: z.string().trim().max(300).default(""),
    })
    .strict(),
]);
export type CashCommand = z.infer<typeof cashCommand>;

export type CashMovement = {
  id: string;
  kind: MovementKind;
  method: PaymentMethod;
  amountCents: number;
  tenderedCents: number | null;
  orderId: string | null;
  orderNumber: number | null;
  orderStatus: string | null;
  note: string;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
};

/** What the drawer should hold and what was taken by each method. */
export type CashTotals = {
  openingCents: number;
  cashPaymentsCents: number;
  depositsCents: number;
  withdrawalsCents: number;
  expectedCents: number;
  byMethod: Record<PaymentMethod, number>;
  payments: number;
};

export function cashTotals(
  openingCents: number,
  movements: Pick<CashMovement, "kind" | "method" | "amountCents" | "voidedAt">[],
): CashTotals {
  const byMethod: Record<PaymentMethod, number> = { cash: 0, transfer: 0, qr: 0, card: 0 };
  let deposits = 0,
    withdrawals = 0,
    payments = 0;
  for (const m of movements) {
    if (m.voidedAt) continue;
    if (m.kind === "payment") {
      byMethod[m.method] += m.amountCents;
      payments++;
    } else if (m.kind === "deposit") deposits += m.amountCents;
    else withdrawals += m.amountCents;
  }
  return {
    openingCents,
    cashPaymentsCents: byMethod.cash,
    depositsCents: deposits,
    withdrawalsCents: withdrawals,
    expectedCents: openingCents + byMethod.cash + deposits - withdrawals,
    byMethod,
    payments,
  };
}

/** Counted minus expected: positive is extra cash, negative is missing cash. */
export function differenceLabel(differenceCents: number, format: (c: number) => string) {
  if (differenceCents === 0) return "La caja cuadra";
  return differenceCents > 0
    ? `Sobran ${format(differenceCents)}`
    : `Faltan ${format(-differenceCents)}`;
}

/** Change to hand back; null when there's no bill or it doesn't cover the charge. */
export function changeFor(amountCents: number, tenderedCents: number | null) {
  if (tenderedCents === null || tenderedCents < amountCents) return null;
  return tenderedCents - amountCents;
}

/** Bills that cover the amount, for one-tap "con cuánto paga". */
export function suggestedBills(amountCents: number): number[] {
  const bills = [1_000_00, 2_000_00, 10_000_00, 20_000_00];
  const out = new Set<number>();
  for (const bill of bills) {
    const rounded = Math.ceil(amountCents / bill) * bill;
    if (rounded > amountCents) out.add(rounded);
  }
  return [...out].sort((a, b) => a - b).slice(0, 3);
}

// Argentine bills and a coins line, for counting the drawer by denomination.
export const denominations = [20_000_00, 10_000_00, 2_000_00, 1_000_00, 500_00, 200_00, 100_00];

export function countTotal(counts: Record<number, number>, coinsCents: number) {
  return (
    denominations.reduce((n, d) => n + d * (counts[d] ?? 0), 0) + coinsCents
  );
}

export type CashSession = {
  id: string;
  number: number;
  openedAt: string;
  openingCents: number;
  closedAt: string | null;
  declaredCents: number | null;
  expectedCents: number | null;
  note: string;
};

export type ClosedSession = CashSession & {
  closedAt: string;
  declaredCents: number;
  expectedCents: number;
  totals: CashTotals;
  /** Orders accepted during the shift still not fully charged when it closed. */
  unpaid?: { count: number; cents: number };
};

export type UnpaidOrder = {
  id: string;
  number: number;
  customerName: string;
  paymentMethod: string;
  totalCents: number;
  paidCents: number;
  createdAt: string;
};

/** The open shift as the cashier sees it: movements, but no expected cash. */
export type CashState = {
  session: (CashSession & { movements: CashMovement[] }) | null;
  unpaid: UnpaidOrder[];
  history: ClosedSession[] | null;
};
