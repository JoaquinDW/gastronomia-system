/** Fixed-point arithmetic. Quantities and cents per base unit have six decimals.
 * BigInt never crosses the JSON boundary. Monetary totals are integer cents. */
export const SCALE = 1_000_000n;
export function fixed(value: string): bigint {
  if (!/^-?\d{1,30}(\.\d{1,6})?$/.test(value))
    throw new Error("Número decimal inválido.");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const result = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
  return negative ? -result : result;
}
export function decimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const n = value < 0n ? -value : value;
  const fraction = (n % SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return `${sign}${n / SCALE}${fraction ? `.${fraction}` : ""}`;
}
export function rounded(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new Error("Divisor inválido.");
  return n < 0n ? -rounded(-n, d) : (n + d / 2n) / d;
}
export function costOf(
  quantity: string,
  unitCost: string | null,
): string | null {
  return unitCost === null
    ? null
    : rounded(fixed(quantity) * fixed(unitCost), SCALE * SCALE).toString();
}
export function unitCostOf(quantity: string, cents: string): string {
  const q = fixed(quantity);
  if (q <= 0n) throw new Error("La cantidad debe ser mayor que cero.");
  return decimal(rounded(BigInt(cents) * SCALE * SCALE, q));
}
export function averageCost(
  balance: string,
  current: string | null,
  received: string,
  cents: string,
): string | null {
  const old = fixed(balance),
    incoming = fixed(received);
  if (old <= 0n) return unitCostOf(received, cents);
  if (current === null) return null;
  return decimal(
    rounded(
      old * fixed(current) + BigInt(cents) * SCALE * SCALE,
      old + incoming,
    ),
  );
}
export function multiply(a: string, b: string): string {
  return decimal(rounded(fixed(a) * fixed(b), SCALE));
}
export function money(cents: string | null): string {
  if (cents === null) return "Sin calcular";
  const n = BigInt(cents),
    abs = n < 0n ? -n : n;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0n ? "−" : ""}$ ${whole}${abs % 100n ? `,${(abs % 100n).toString().padStart(2, "0")}` : ""}`;
}
export function formatManagementDate(date: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(date));
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}
export function pesosToCents(value: string): string {
  if (!/^\d{1,10}(,\d{1,2})?$/.test(value.trim()))
    throw new Error("Usá pesos sin separador de miles y coma para centavos.");
  const [whole, fraction = ""] = value.trim().split(",");
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))).toString();
}
export function operationalDate(
  now: Date,
  timezone: string,
  cutoffHour: number,
): string {
  // Subtract in local wall time (not UTC), including DST transitions.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return Number(get("hour")) < cutoffHour ? shiftDate(date, -1) : date;
}
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
