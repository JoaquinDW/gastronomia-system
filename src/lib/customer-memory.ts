import { z } from "zod";
import { coordinatesSchema } from "./delivery";

// Datos del cliente que el checkout recuerda en este navegador para no
// pedirlos en cada pedido. Nombre y WhatsApp sirven para cualquier tienda;
// la dirección se guarda por tienda porque depende de su zona de entrega.
export const customerStorageKey = "pedipue-customer-v1";
export const customerAddressKey = (slug: string) =>
  `pedipue-customer-address-v1:${slug}`;

const customerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(1).max(30),
});
const addressSchema = z.object({
  address: z.string().trim().min(5).max(250),
  location: coordinatesSchema.nullable(),
});
export type SavedCustomer = z.infer<typeof customerSchema>;
export type SavedAddress = z.infer<typeof addressSchema>;

function parse<T>(schema: z.ZodType<T>, raw: string | null): T | null {
  if (!raw) return null;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export const parseSavedCustomer = (raw: string | null) =>
  parse(customerSchema, raw);
export const parseSavedAddress = (raw: string | null) =>
  parse(addressSchema, raw);
export const serializeCustomer = (value: SavedCustomer) => {
  const result = customerSchema.safeParse(value);
  return result.success ? JSON.stringify(result.data) : null;
};
export const serializeAddress = (value: SavedAddress) => {
  const result = addressSchema.safeParse(value);
  return result.success ? JSON.stringify(result.data) : null;
};
