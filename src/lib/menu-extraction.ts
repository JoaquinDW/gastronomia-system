import { z } from "zod";
const amount = z
  .string()
  .regex(/^\d{1,7}(?:\.\d{1,2})?$/)
  .nullable();
const extractedOption = z.object({
  name: z.string(),
  price: amount,
  rawPrice: z.string().nullable(),
});
export const extractionSchema = z.object({
  businessName: z.string().nullable(),
  currency: z.enum(["ARS", "USD", "unknown"]),
  globalNotes: z.array(z.string()),
  warnings: z.array(z.string()),
  deliveryMentioned: z.boolean(),
  hours: z.array(
    z.object({
      day: z.number().int().min(0).max(6),
      opens: z.string(),
      closes: z.string(),
    }),
  ),
  products: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      category: z.string(),
      kind: z.enum(["product", "combo"]),
      variants: z.array(extractedOption),
      addOns: z.array(extractedOption),
      warnings: z.array(z.string()),
    }),
  ),
});
export type MenuExtraction = z.infer<typeof extractionSchema>;
