import { z } from "zod";
import type { Order } from "./checkout";

// Delay traffic light for the order inbox and kitchen mode. Saved for the
// whole business, so the kitchen tablet and the counter see the same colors.
export const kitchenConfigInput = z
  .object({
    /** Promise used when the order was accepted without an estimate. */
    defaultMinutes: z.number().int().min(5).max(180),
    /** Turns yellow when this many minutes are left. */
    warnMinutes: z.number().int().min(1).max(60),
  })
  .strict();
export type KitchenConfig = z.infer<typeof kitchenConfigInput>;
export const defaultKitchenConfig: KitchenConfig = {
  defaultMinutes: 20,
  warnMinutes: 5,
};

export type Light = "ok" | "soon" | "late";
export type Timing = {
  light: Light;
  /** Whole minutes since the kitchen started the order. */
  elapsed: number;
  /** Whole minutes left before the promise; negative once late. */
  left: number;
  /** True when the promise is the business default, not one set on accepting. */
  assumed: boolean;
};

const MINUTE = 60_000;

/** Only orders being prepared are timed: once ready, the kitchen is done. */
export function orderTiming(
  o: Pick<Order, "status" | "stage" | "acceptedAt" | "estimatedReadyAt">,
  config: KitchenConfig,
  now: number,
): Timing | null {
  if (o.status !== "accepted" || o.stage !== "preparing" || !o.acceptedAt)
    return null;
  const start = Date.parse(o.acceptedAt);
  const due = o.estimatedReadyAt
    ? Date.parse(o.estimatedReadyAt)
    : start + config.defaultMinutes * MINUTE;
  // Ceil so "1 min left" stays yellow until the promise actually passes.
  const left = Math.ceil((due - now) / MINUTE);
  return {
    light: now >= due ? "late" : left <= config.warnMinutes ? "soon" : "ok",
    elapsed: Math.max(0, Math.floor((now - start) / MINUTE)),
    left: now >= due ? Math.min(-1, -Math.floor((now - due) / MINUTE)) : left,
    assumed: !o.estimatedReadyAt,
  };
}

export function timingLabel(t: Timing) {
  if (t.left < 0) return `${-t.left} min tarde`;
  return `Faltan ${t.left} min`;
}

export const lightLabels: Record<Light, string> = {
  ok: "A tiempo",
  soon: "Por vencer",
  late: "Atrasado",
};

/** Whole minutes since a timestamp, for orders that aren't timed. */
export function minutesSince(value: string | null | undefined, now: number) {
  return value ? Math.max(0, Math.floor((now - Date.parse(value)) / MINUTE)) : 0;
}

/** Most urgent first: least time left, then the oldest. */
export function byUrgency<
  T extends Pick<Order, "status" | "stage" | "acceptedAt" | "estimatedReadyAt" | "createdAt">,
>(orders: T[], config: KitchenConfig, now: number): T[] {
  const left = (o: T) => orderTiming(o, config, now)?.left ?? Infinity;
  return [...orders].sort(
    (a, b) => left(a) - left(b) || Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
}
