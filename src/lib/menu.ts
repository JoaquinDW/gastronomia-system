import { z } from "zod";

const price = z.number().int().min(0).max(99_999_999);
// Photos uploaded from the panel are served by /api/media/<id>.
export const uploadedImagePattern =
  /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Responsive sources for a product photo: uploaded photos have a light 800 px version. */
export function productImage(url: string): {
  src: string;
  srcSet?: string;
  large: string;
} {
  if (!uploadedImagePattern.test(url)) return { src: url, large: url };
  return {
    src: `${url}?size=small`,
    srcSet: `${url}?size=small 800w, ${url} 1600w`,
    large: url,
  };
}
export const variantSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(80),
    priceCents: price,
  })
  .strict();
export const addOnSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(80),
    priceCents: price,
  })
  .strict();
export const productInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1500).default(""),
    category: z.string().trim().min(1).max(80),
    kind: z.enum(["product", "combo"]).default("product"),
    variants: z.array(variantSchema).min(1).max(20),
    addOns: z.array(addOnSchema).max(20).default([]),
    imageUrl: z
      .union([
        z.literal(""),
        z.string().regex(uploadedImagePattern, "La imagen no es válida."),
        z
          .url()
          .refine(
            (url) =>
              URL.canParse(url) && new URL(url).protocol === "https:",
            "La imagen debe usar HTTPS.",
          ),
      ])
      .default(""),
    // Which part of the photo stays visible when cards crop it (CSS object-position, in %).
    imageFocusX: z.number().int().min(0).max(100).default(50),
    imageFocusY: z.number().int().min(0).max(100).default(50),
    isAvailable: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict()
  .superRefine((p, ctx) => {
    for (const [key, list] of [
      ["variants", p.variants],
      ["addOns", p.addOns],
    ] as const) {
      if (new Set(list.map((v) => v.id)).size !== list.length)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Hay opciones repetidas.",
        });
      if (new Set(list.map((v) => normalizeName(v.name))).size !== list.length)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Cada opción debe tener un nombre diferente.",
        });
    }
  });
export type Variant = z.infer<typeof variantSchema>;
export type AddOn = z.infer<typeof addOnSchema>;
export type ProductInput = z.infer<typeof productInput>;
export type Product = ProductInput & { id: string; version: number };

export const hourSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    opens: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    closes: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .strict();
export type Hours = z.infer<typeof hourSchema>[];
export const zoneSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(2).max(100),
    feeCents: price,
    minimumCents: price,
  })
  .strict();
export type DeliveryZone = z.infer<typeof zoneSchema>;
export const settingsInput = z
  .object({
    description: z.string().trim().max(600),
    menuNote: z.string().trim().max(2500),
    hours: z.array(hourSchema).max(21),
    pickupEnabled: z.boolean(),
    pickupInstructions: z.string().trim().max(500),
    deliveryEnabled: z.boolean(),
    deliveryZones: z.array(zoneSchema).max(30),
    paymentMethods: z
      .array(z.enum(["cash", "transfer"]))
      .min(1)
      .max(2),
    transferAlias: z.string().trim().max(100),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.hours.some((h) => h.opens === h.closes))
      ctx.addIssue({
        code: "custom",
        path: ["hours"],
        message: "Apertura y cierre deben ser distintos.",
      });
    if (hoursOverlap(s.hours))
      ctx.addIssue({
        code: "custom",
        path: ["hours"],
        message:
          "Hay turnos que se superponen, incluyendo horarios que cruzan medianoche.",
      });
    if (
      new Set(s.deliveryZones.map((z) => normalizeName(z.name))).size !==
        s.deliveryZones.length ||
      new Set(s.deliveryZones.map((z) => z.id)).size !== s.deliveryZones.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["deliveryZones"],
        message: "Las zonas deben ser diferentes.",
      });
    if (s.paymentMethods.includes("transfer") && !s.transferAlias)
      ctx.addIssue({
        code: "custom",
        path: ["transferAlias"],
        message: "Ingresá el alias para recibir transferencias.",
      });
  });
export type StoreSettingsInput = z.infer<typeof settingsInput>;
export type StoreSettings = StoreSettingsInput & {
  isPublished: boolean;
  version: number;
};
export const emptySettings: StoreSettings = {
  description: "",
  menuNote: "",
  hours: [],
  pickupEnabled: true,
  pickupInstructions: "",
  deliveryEnabled: false,
  deliveryZones: [],
  paymentMethods: ["cash"],
  transferAlias: "",
  isPublished: false,
  version: 0,
};
export const dayNames = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
export function normalizeName(s: string) {
  return s
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}
function minutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function hoursOverlap(hours: Hours): boolean {
  const ranges = hours.flatMap((h) => {
    const start = h.day * 1440 + minutes(h.opens);
    let end = h.day * 1440 + minutes(h.closes);
    if (end <= start) end += 1440;
    return [
      [start, end],
      [start + 10080, end + 10080],
    ];
  });
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges.some((r, i) => i > 0 && r[0] < ranges[i - 1][1]);
}
export function isStoreOpen(
  hours: Hours,
  now = new Date(),
  timezone = "America/Argentina/Cordoba",
): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    get("weekday"),
  );
  const current = Number(get("hour")) * 60 + Number(get("minute"));
  return hours.some((h) => {
    const start = minutes(h.opens),
      end = minutes(h.closes);
    return end > start
      ? h.day === day && current >= start && current < end
      : (h.day === day && current >= start) ||
          ((h.day + 1) % 7 === day && current < end);
  });
}
export function moneyToCents(raw: string): number | null {
  let value = raw.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(value)) return null;
  const separators = [...value.matchAll(/[.,]/g)];
  if (separators.length) {
    const last = separators[separators.length - 1].index!;
    const tail = value.length - last - 1;
    if (tail === 1 || tail === 2) {
      const head = value.slice(0, last);
      if (
        /[.,]/.test(head) &&
        (head.includes(value[last]) || !/^\d{1,3}([.,]\d{3})+$/.test(head))
      )
        return null;
      value = head.replace(/[.,]/g, "") + "." + value.slice(last + 1);
    } else if (
      tail === 3 &&
      /^\d{1,3}([.,]\d{3})+$/.test(value) &&
      new Set(separators.map((s) => s[0])).size === 1
    )
      value = value.replace(/[.,]/g, "");
    else return null;
  }
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 99_999_999
    ? cents
    : null;
}
export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export const priceInputValue = (cents: number) =>
  (cents / 100).toFixed(cents % 100 ? 2 : 0);
