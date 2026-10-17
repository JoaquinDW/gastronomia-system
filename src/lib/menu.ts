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
// A group the customer chooses from, like "Elegí la salsa" or "Elegí 12 gustos".
// With repeat, the same option counts once per unit chosen (3 de carne, 3 de pollo…).
export const optionGroupSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(80),
    min: z.number().int().min(0).max(50),
    max: z.number().int().min(1).max(50),
    repeat: z.boolean().default(false),
    options: z.array(addOnSchema).min(1).max(30),
  })
  .strict();
// An uploaded photo, an external HTTPS link, or empty for no photo.
const imageUrlSchema = z.union([
  z.literal(""),
  z.string().regex(uploadedImagePattern, "La imagen no es válida."),
  z
    .url()
    .refine(
      (url) => URL.canParse(url) && new URL(url).protocol === "https:",
      "La imagen debe usar HTTPS.",
    ),
]);
const focusSchema = z.number().int().min(0).max(100).default(50);
export const productInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1500).default(""),
    category: z.string().trim().min(1).max(80),
    kind: z.enum(["product", "combo"]).default("product"),
    variants: z.array(variantSchema).min(1).max(20),
    addOns: z.array(addOnSchema).max(20).default([]),
    optionGroups: z.array(optionGroupSchema).max(10).default([]),
    imageUrl: imageUrlSchema.default(""),
    // Which part of the photo stays visible when cards crop it (CSS object-position, in %).
    imageFocusX: focusSchema,
    imageFocusY: focusSchema,
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
    // Choices share recipes with add-ons, so their ids must not collide.
    const ids = [
      ...p.variants,
      ...p.addOns,
      ...p.optionGroups.flatMap((g) => [g, ...g.options]),
    ].map((o) => o.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["optionGroups"],
        message: "Hay opciones repetidas.",
      });
    if (
      new Set(p.optionGroups.map((g) => normalizeName(g.name))).size !==
      p.optionGroups.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["optionGroups"],
        message: "Cada grupo de opciones debe tener un nombre diferente.",
      });
    p.optionGroups.forEach((g, i) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: "custom", path: ["optionGroups", i], message });
      if (
        new Set(g.options.map((o) => normalizeName(o.name))).size !==
        g.options.length
      )
        issue(`En «${g.name}» cada opción debe tener un nombre diferente.`);
      if (g.min > g.max)
        issue(`En «${g.name}» el mínimo no puede superar al máximo.`);
      else if (!g.repeat && g.max > g.options.length)
        issue(
          `En «${g.name}» se pueden elegir hasta ${g.options.length} opciones distintas. Bajá el máximo o permití repetir.`,
        );
    });
  });
export type OptionGroup = z.infer<typeof optionGroupSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type AddOn = z.infer<typeof addOnSchema>;
export type ProductInput = z.infer<typeof productInput>;
export type Product = ProductInput & { id: string; version: number };

/** "Elegí 1", "Elegí hasta 3", "Elegí 12" or "Elegí entre 2 y 4". */
export function groupRule(g: Pick<OptionGroup, "min" | "max">) {
  if (g.min === g.max) return `Elegí ${g.max}`;
  if (!g.min) return `Elegí hasta ${g.max}`;
  return `Elegí entre ${g.min} y ${g.max}`;
}
export type ChoiceSelection = {
  cents: number;
  /** One line per group with picks, like "Gustos: 3 Carne, 3 Pollo". */
  labels: string[];
};
/**
 * Checks the picks for one unit of a product against its option groups.
 * choiceIds lists one id per unit picked, so repeated options appear repeatedly.
 */
export function resolveChoices(
  product: Pick<Product, "optionGroups">,
  choiceIds: string[],
):
  | { ok: true; value: ChoiceSelection }
  | { ok: false; message: string; stale: boolean } {
  const groups = product.optionGroups ?? [];
  const counts = new Map<string, number>();
  for (const id of choiceIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const known = new Set(groups.flatMap((g) => g.options.map((o) => o.id)));
  if ([...counts.keys()].some((id) => !known.has(id)))
    return {
      ok: false,
      stale: true,
      message: "Las opciones de un producto cambiaron. Actualizá la carta.",
    };
  let cents = 0;
  const labels: string[] = [];
  for (const g of groups) {
    const picked = g.options.filter((o) => counts.has(o.id));
    const total = picked.reduce((n, o) => n + counts.get(o.id)!, 0);
    if (!g.repeat && picked.some((o) => counts.get(o.id)! > 1))
      return {
        ok: false,
        stale: false,
        message: `En «${g.name}» no se puede repetir la misma opción.`,
      };
    if (total < g.min || total > g.max)
      return {
        ok: false,
        stale: false,
        message: `${groupRule(g)} en «${g.name}».`,
      };
    cents += picked.reduce((n, o) => n + o.priceCents * counts.get(o.id)!, 0);
    if (picked.length)
      labels.push(
        `${g.name}: ${picked
          .map((o) =>
            g.repeat && counts.get(o.id)! > 1
              ? `${counts.get(o.id)} ${o.name}`
              : o.name,
          )
          .join(", ")}`,
      );
  }
  return { ok: true, value: { cents, labels } };
}
/** Every option inside the product's groups, for recipes and pickers. */
export function groupOptions(product: Pick<Product, "optionGroups">) {
  return (product.optionGroups ?? []).flatMap((g) =>
    g.options.map((o) => ({ ...o, groupName: g.name })),
  );
}
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
    coverImageUrl: imageUrlSchema.default(""),
    coverFocusX: focusSchema,
    coverFocusY: focusSchema,
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
  coverImageUrl: "",
  coverFocusX: 50,
  coverFocusY: 50,
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
