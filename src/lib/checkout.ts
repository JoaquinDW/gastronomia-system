import { z } from "zod";
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
    paymentMethod: z.enum(["cash", "transfer"]),
    note: z.string().trim().max(500).default(""),
    items: z
      .array(
        z
          .object({
            productId: z.uuid(),
            variantId: z.uuid(),
            addOnIds: z.array(z.uuid()).max(20),
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
export type OrderItem = {
  productId?: string;
  variantId?: string;
  addOnIds?: string[];
  name: string;
  variant: string;
  addOns: string[];
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
  paymentMethod: string;
  note: string;
  items: OrderItem[];
  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;
  version: number;
  createdAt: string;
  acceptedAt?: string | null;
  saleId?: string | null;
};
