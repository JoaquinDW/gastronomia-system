import { z } from "zod";
import { coordinatesSchema, type Coordinates } from "./delivery";
export const checkoutInput = z
  .object({
    requestKey: z.uuid(),
    customerName: z.string().trim().min(2).max(100),
    customerPhone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s().-]+$/)
      .transform((v) => `+${v.replace(/\D/g, "")}`)
      .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/)),
    fulfillment: z.enum(["pickup", "delivery"]),
    address: z.string().trim().max(250).default(""),
    zoneId: z.uuid().nullable(),
    deliveryLocation: coordinatesSchema.nullable().optional(),
    quotedDeliveryCents: z.number().int().min(0).max(99_999_999).optional(),
    paymentMethod: z.enum(["cash", "transfer"]),
    note: z.string().trim().max(500).default(""),
    items: z
      .array(
        z
          .object({
            productId: z.uuid(),
            variantId: z.uuid(),
            addOnIds: z.array(z.uuid()).max(20),
            // One id per unit picked inside the product's option groups.
            choiceIds: z.array(z.uuid()).max(100).default([]),
            quantity: z.number().int().min(1).max(20),
            quotedUnitCents: z.number().int().min(0),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
export type CheckoutInput = z.infer<typeof checkoutInput>;

// Where an order came from. The store's own checkout is "store"; the rest are
// loaded by the business from the orders panel.
export const orderChannels = ["store", "counter", "phone", "whatsapp"] as const;
export type OrderChannel = (typeof orderChannels)[number];
export const channelLabels: Record<OrderChannel, string> = {
  store: "Tienda",
  counter: "Mostrador",
  phone: "Teléfono",
  whatsapp: "WhatsApp",
};
export const manualChannels = ["counter", "phone", "whatsapp"] as const;
const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .regex(/^\+?[\d\s().-]*$/, "Revisá el teléfono: solo números, con característica.")
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v === "" || /^[1-9]\d{7,14}$/.test(v), "Revisá el teléfono: solo números, con característica.")
  .transform((v) => (v ? `+${v}` : ""));
/** An order the business loads itself: already accepted, priced from the carta. */
export const manualOrderInput = z
  .object({
    requestKey: z.uuid(),
    channel: z.enum(manualChannels),
    customerName: z.string().trim().max(100).default(""),
    customerPhone: optionalPhone.default(""),
    fulfillment: z.enum(["pickup", "delivery"]),
    address: z.string().trim().max(250).default(""),
    // A saved zone sets name and fee; without one the fee is typed by hand.
    zoneId: z.uuid().nullable().default(null),
    deliveryCents: z.number().int().min(0).max(99_999_999).default(0),
    paymentMethod: z.enum(["cash", "transfer"]),
    note: z.string().trim().max(500).default(""),
    preparationMinutes: z.number().int().min(5).max(180).nullable().default(null),
    items: checkoutInput.shape.items,
  })
  .strict();
export type ManualOrderInput = z.infer<typeof manualOrderInput>;
/** Name shown when the customer didn't give one, like at the counter. */
export function defaultCustomerName(channel: OrderChannel) {
  return channel === "counter" ? "Mostrador" : `Pedido por ${channelLabels[channel]}`;
}
/** Read a saved order snapshot; never infer an unknown fee from a zero price. */
export function isDeliveryFeePending(order: { fulfillment: string; zoneName: string | null }) {
  return order.fulfillment === "delivery" && order.zoneName === null;
}
export type OrderItem = {
  imageUrl?: string | null;
  productId?: string;
  variantId?: string;
  addOnIds?: string[];
  choiceIds?: string[];
  name: string;
  variant: string;
  addOns: string[];
  /** One line per option group, like "Gustos: 3 Carne, 3 Pollo". */
  choices?: string[];
  quantity: number;
  unitCents: number;
  lineCents: number;
};
export type Order = {
  id: string;
  number: number;
  status: string;
  customerName: string;
  customerPhone: string;
  fulfillment: string;
  address: string | null;
  zoneName: string | null;
  deliveryLocation?: Coordinates | null;
  paymentMethod: string;
  note: string;
  items: OrderItem[];
  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;
  version: number;
  createdAt: string;
  acceptedAt?: string | null;
  /** Kitchen progress once accepted; null while pending or after rejecting. */
  stage?: OrderStage | null;
  stageChangedAt?: string | null;
  trackingToken?: string;
  saleId?: string | null;
  estimatedReadyAt?: string | null;
  rating?: number | null;
  channel?: OrderChannel;
  /** Charged in the register so far, without voided payments. */
  paidCents?: number;
};

// Accepted orders move forward one step at a time. Pickup skips "en camino".
export const orderStages = [
  "preparing",
  "ready",
  "on_the_way",
  "delivered",
] as const;
export type OrderStage = (typeof orderStages)[number];
export const stageLabels: Record<OrderStage, string> = {
  preparing: "En preparación",
  ready: "Listo",
  on_the_way: "En camino",
  delivered: "Entregado",
};
export function stagesFor(fulfillment: string): OrderStage[] {
  return fulfillment === "delivery"
    ? [...orderStages]
    : orderStages.filter((s) => s !== "on_the_way");
}
export function nextStage(
  fulfillment: string,
  stage: OrderStage | null | undefined,
): OrderStage | null {
  if (!stage) return null;
  const steps = stagesFor(fulfillment);
  const at = steps.indexOf(stage);
  return at >= 0 && at < steps.length - 1 ? steps[at + 1] : null;
}
export function nextStageAction(fulfillment: string, stage: OrderStage) {
  const next = nextStage(fulfillment, stage);
  if (next === "ready") return "Marcar listo";
  if (next === "on_the_way") return "Salió en camino";
  if (next === "delivered")
    return fulfillment === "delivery" ? "Marcar entregado" : "Ya lo retiró";
  return null;
}
export const trackingTokenPattern = /^[0-9a-f]{32}$/;
