import "server-only";
import { cache } from "react";
import snapshot from "@/lib/demo/brasa-snapshot.json";
import type { DemoState } from "@/lib/demo/sandbox";
import type { ManagementData, Report } from "@/lib/management";
import type { Product } from "@/lib/menu";
import { operationalDate, shiftDate } from "@/lib/management-math";
import { publicStore } from "./menu";
import { reportRange, totals, type Day } from "./management-reports";

// Datos de la demo pública del panel. Salen de scripts/demo-snapshot.ts, que
// carga Brasa Club con la lógica real en una base local; acá se corren las
// fechas para que el último pedido sea de recién. No escribe en la base.

type SnapshotSale = {
  channel: string;
  totalCents: string;
  deliveryCents: string;
  knownCostCents: string;
  costComplete: boolean;
  operationalDate: string;
  lines: {
    name: string;
    variant: string;
    quantity: number;
    lineCents: string;
  }[];
};
type Snapshot = Omit<DemoState, never> & {
  takenAt: string;
  management: ManagementData;
  consumptions: Record<string, unknown>;
  sales: SnapshotSale[];
};

const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

/** Corre cada fecha del snapshot: las horas, al instante; los días, en días. */
function shift<T>(value: T, ms: number, days: number): T {
  if (typeof value === "string") {
    if (timestamp.test(value))
      return new Date(Date.parse(value) + ms).toISOString() as T;
    if (dateOnly.test(value)) return shiftDate(value, days) as T;
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => shift(v, ms, days)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, shift(v, ms, days)]),
    ) as T;
  return value;
}

// Las fotos son las de la tienda publicada de Brasa Club, por nombre.
async function photos() {
  try {
    const store = await publicStore(snapshot.business.slug);
    if (!store) return null;
    return {
      products: new Map(store.products.map((p) => [p.name, p])),
      cover: store.settings,
    };
  } catch {
    return null;
  }
}

export const demoData = cache(async () => {
  const raw = snapshot as unknown as Snapshot;
  const { timezone } = raw;
  const { cutoffHour } = raw.management.settings;
  const now = Date.now();
  const ms = now - Date.parse(raw.takenAt);
  const days = Math.round(
    (Date.parse(
      `${operationalDate(new Date(now), timezone, cutoffHour)}T12:00:00Z`,
    ) -
      Date.parse(`${raw.management.today}T12:00:00Z`)) /
      86_400_000,
  );
  const data = shift(raw, ms, days);
  const found = await photos();
  if (found) {
    const image = (name: string) => found.products.get(name);
    data.products = data.products.map((p) => {
      const real = image(p.name);
      return real
        ? {
            ...p,
            imageUrl: real.imageUrl,
            imageFocusX: real.imageFocusX,
            imageFocusY: real.imageFocusY,
          }
        : p;
    });
    const byName = new Map(data.products.map((p) => [p.name, p.imageUrl]));
    data.orders = data.orders.map((o) => ({
      ...o,
      items: o.items.map((i) => ({
        ...i,
        imageUrl: byName.get(i.name) || null,
      })),
    }));
    data.settings = {
      ...data.settings,
      coverImageUrl: found.cover.coverImageUrl,
      coverFocusX: found.cover.coverFocusX,
      coverFocusY: found.cover.coverFocusY,
    };
  }
  const state: DemoState = {
    business: data.business,
    timezone,
    settings: data.settings,
    products: data.products as Product[],
    categories: data.categories,
    ticket: data.ticket,
    kitchen: data.kitchen,
    orders: data.orders,
    cashSessions: data.cashSessions,
    cashMovements: data.cashMovements,
  };
  return {
    state,
    management: data.management,
    consumptions: data.consumptions,
    sales: data.sales,
  };
});

/** Resultados de cualquier período, con las mismas cuentas que el reporte real. */
export async function demoReport(from?: string, to?: string): Promise<Report> {
  const { management, sales } = await demoData();
  const range = reportRange(from, to, management.today);
  const empty = (date: string): Day => ({
    date,
    revenue: "0",
    delivery: "0",
    cost: "0",
    expenses: "0",
    waste: "0",
    saleCount: "0",
    cancelledCount: "0",
    completeCount: "0",
    incompleteCount: "0",
    unknown: "0",
    unknownWaste: "0",
    legacy: "0",
    estimated: "0",
  });
  const byDay = new Map<string, Day>();
  const day = (date: string) => {
    if (!byDay.has(date)) byDay.set(date, empty(date));
    return byDay.get(date)!;
  };
  const add = (d: Day, key: keyof Day, n: bigint | number) =>
    (d[key] = (BigInt(d[key]) + BigInt(n)).toString());
  const inRange = (date: string) => date >= range.from && date <= range.to;
  const products = new Map<string, { quantity: number; revenue: bigint }>();
  const channels = new Map<string, { revenue: bigint; count: number }>();
  for (const s of sales) {
    const d = day(s.operationalDate);
    add(d, "revenue", BigInt(s.totalCents));
    add(d, "delivery", BigInt(s.deliveryCents));
    add(d, "cost", BigInt(s.knownCostCents));
    add(d, "saleCount", 1);
    add(d, s.costComplete ? "completeCount" : "incompleteCount", 1);
    if (!s.costComplete) add(d, "unknown", 1);
    if (!inRange(s.operationalDate)) continue;
    for (const line of s.lines) {
      const key = `${line.name} · ${line.variant}`;
      const p = products.get(key) ?? { quantity: 0, revenue: 0n };
      products.set(key, {
        quantity: p.quantity + line.quantity,
        revenue: p.revenue + BigInt(line.lineCents),
      });
    }
    const c = channels.get(s.channel) ?? { revenue: 0n, count: 0 };
    channels.set(s.channel, {
      revenue: c.revenue + BigInt(s.totalCents),
      count: c.count + 1,
    });
  }
  for (const e of management.expenses)
    if (!e.reversedAt) add(day(e.date), "expenses", BigInt(e.amountCents));
  const rows = [...byDay.values()].filter(
    (d) => d.date >= range.previousFrom && d.date <= range.to,
  );
  const current = rows.filter((d) => d.date >= range.from),
    previous = rows.filter((d) => d.date < range.from);
  const days: Report["days"] = [];
  for (let i = 0; i < range.days; i++) {
    const date = shiftDate(range.from, i),
      d = byDay.get(date);
    days.push({
      date,
      revenue: d?.revenue ?? "0",
      expenses: d?.expenses ?? "0",
      cost: d?.cost ?? "0",
      waste: d?.waste ?? "0",
      complete: !d || d.unknown === "0",
    });
  }
  return {
    ...range,
    totals: totals(current),
    previous: totals(previous),
    days,
    products: [...products]
      .map(([name, p]) => ({
        name,
        quantity: String(p.quantity),
        revenue: p.revenue.toString(),
      }))
      .sort(
        (a, b) =>
          Number(b.quantity) - Number(a.quantity) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 12),
    byChannel: [...channels]
      .map(([channel, c]) => ({
        channel,
        revenue: c.revenue.toString(),
        count: c.count,
      }))
      .sort((a, b) => (BigInt(b.revenue) > BigInt(a.revenue) ? 1 : -1)),
    legacyCount: 0,
    legacyEstimatedCount: 0,
    legacyPendingCount: 0,
    historicalOrders: [],
  };
}
