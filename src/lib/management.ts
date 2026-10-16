import { z } from "zod";

const quantity = z
  .string()
  .regex(
    /^\d{1,10}(\.\d{1,6})?$/,
    "Usá una cantidad positiva con hasta seis decimales.",
  );
const positiveQuantity = quantity.refine(
  (v) => /[1-9]/.test(v),
  "La cantidad debe ser mayor que cero.",
);
const cents = z.string().regex(/^\d{1,14}$/, "Importe en centavos inválido.");
const name = z.string().trim().min(2).max(120);
const note = z.string().trim().max(500).default("");
const key = { requestKey: z.uuid() };
export const channels = {
  store: "Tienda",
  counter: "Mostrador",
  whatsapp: "WhatsApp",
  other: "Otros",
} as const;
export const expenseCategories = [
  "Alquiler",
  "Sueldos",
  "Servicios",
  "Envíos",
  "Comisiones",
  "Impuestos",
  "Mantenimiento",
  "Otros",
] as const;
export const consumption = z
  .object({ itemId: z.uuid(), quantity: positiveQuantity })
  .strict();
const ingredients = z
  .array(consumption)
  .min(1)
  .max(80)
  .refine(
    (lines) => new Set(lines.map((l) => l.itemId)).size === lines.length,
    "No repitas un insumo; sumá sus cantidades.",
  );
export const commandSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...key,
      type: z.literal("item"),
      id: z.uuid().optional(),
      version: z.number().int().positive().optional(),
      name,
      kind: z.enum(["ingredient", "finished"]),
      unit: z.enum(["g", "ml", "unit"]),
      minimum: quantity,
      initialQuantity: quantity.default("0"),
      initialValueCents: cents.nullable().default(null),
    })
    .strict(),
  z
    .object({
      ...key,
      type: z.literal("supplier"),
      id: z.uuid().optional(),
      version: z.number().int().positive().optional(),
      name,
      contact: z.string().trim().max(200).default(""),
      note,
    })
    .strict(),
  z
    .object({
      ...key,
      type: z.literal("recipe"),
      productId: z.uuid(),
      optionId: z.uuid(),
      optionKind: z.enum(["variant", "addon"]),
      version: z.number().int().nonnegative(),
      lines: z.array(consumption).max(80),
      noConsumption: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      ...key,
      type: z.literal("purchase"),
      supplierId: z.uuid().nullable(),
      note,
      lines: z
        .array(
          z
            .object({
              itemId: z.uuid(),
              quantity: positiveQuantity,
              unit: z.enum(["g", "kg", "ml", "l", "unit", "pack"]),
              factor: positiveQuantity.default("1"),
              totalCents: cents,
            })
            .strict(),
        )
        .min(1)
        .max(80),
    })
    .strict(),
  z
    .object({
      ...key,
      type: z.literal("production"),
      outputItemId: z.uuid(),
      outputQuantity: positiveQuantity,
      lines: ingredients,
      note,
    })
    .strict(),
  z
    .object({
      ...key,
      type: z.literal("adjustment"),
      itemId: z.uuid(),
      version: z.number().int().positive(),
      mode: z.enum(["count", "waste"]),
      quantity,
      totalValueCents: cents.nullable().default(null),
      reason: z.string().trim().min(3).max(500),
      referenceId: z.uuid().nullable().default(null),
    })
    .strict(),
  z
    .object({
      ...key,
      type: z.literal("sale"),
      channel: z.enum(["counter", "whatsapp", "other"]),
      deliveryCents: cents.default("0"),
      note,
      lines: z
        .array(
          z
            .object({
              productId: z.uuid(),
              variantId: z.uuid(),
              addOnIds: z.array(z.uuid()).max(20),
              quantity: z.number().int().min(1).max(1000),
              unitCents: cents,
            })
            .strict(),
        )
        .min(1)
        .max(80),
    })
    .strict(),
  z
    .object({
      ...key,
      type: z.literal("cancel_sale"),
      saleId: z.uuid(),
      reason: z.string().trim().min(3).max(500),
      recoveries: z
        .array(z.object({ movementId: z.uuid(), quantity }).strict())
        .max(200),
    })
    .strict(),
  z
    .object({
      ...key,
      type: z.literal("expense"),
      date: z.iso.date(),
      category: z.enum(expenseCategories),
      amountCents: cents.refine((v) => BigInt(v) > 0n),
      concept: name,
      supplierId: z.uuid().nullable(),
      note,
    })
    .strict(),
  z
    .object({
      ...key,
      type: z.literal("reverse_expense"),
      expenseId: z.uuid(),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
  z
    .object({
      ...key,
      type: z.literal("settings"),
      cutoffHour: z.number().int().min(0).max(23),
      version: z.number().int().nonnegative(),
    })
    .strict(),
]);
export type ManagementCommand = z.infer<typeof commandSchema>;
export type StockItem = {
  id: string;
  name: string;
  kind: "ingredient" | "finished";
  unit: "g" | "ml" | "unit";
  minimum: string;
  quantity: string;
  unitCost: string | null;
  version: number;
};
export type Supplier = {
  id: string;
  name: string;
  contact: string;
  note: string;
  version: number;
};
export type Recipe = {
  id: string;
  productId: string;
  optionId: string;
  optionKind: "variant" | "addon";
  version: number;
  lines: { itemId: string; quantity: string }[];
  noConsumption: boolean;
};
export type Movement = {
  id: string;
  itemId: string;
  itemName: string;
  quantity: string;
  costCents: string | null;
  kind: string;
  operationId: string;
  createdAt: string;
  reason: string;
};
export type SaleLine = {
  productId?: string;
  variantId?: string;
  addOnIds?: string[];
  name: string;
  variant: string;
  addOns: string[];
  quantity: number;
  unitCents: string;
  lineCents: string;
  costCents: string | null;
  knownCostCents: string;
};
export type Sale = {
  id: string;
  channel: keyof typeof channels;
  orderId: string | null;
  note: string;
  totalCents: string;
  deliveryCents: string;
  costCents: string | null;
  knownCostCents: string;
  lines: SaleLine[];
  createdAt: string;
  cancelledAt: string | null;
  costComplete: boolean;
  operationalDate: string;
};
export type Operation = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  actorId: string;
};
export type Expense = {
  id: string;
  date: string;
  category: string;
  concept: string;
  amountCents: string;
  supplierId: string | null;
  note: string;
  reversedAt: string | null;
};
export type ManagementData = {
  items: StockItem[];
  suppliers: Supplier[];
  recipes: Recipe[];
  movements: Movement[];
  operations: Operation[];
  sales: Sale[];
  expenses: Expense[];
  settings: { cutoffHour: number; version: number; timezone: string };
  today: string;
  salesHasMore: boolean;
  movementsHasMore: boolean;
  operationsHasMore: boolean;
};
export type Totals = {
  revenue: string;
  delivery: string;
  cost: string;
  expenses: string;
  waste: string;
  saleCount: number;
  cancelledCount: number;
  completeCount: number;
  incompleteCount: number;
  costsIncomplete: boolean;
  wasteIncomplete: boolean;
  grossMargin: string | null;
  result: string | null;
  ticket: string | null;
};
export type Report = {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  totals: Totals;
  previous: Totals;
  days: {
    date: string;
    revenue: string;
    expenses: string;
    cost: string;
    waste: string;
    complete: boolean;
  }[];
  products: { name: string; quantity: string; revenue: string }[];
  byChannel: { channel: string; revenue: string; count: number }[];
  legacyCount: number;
};
