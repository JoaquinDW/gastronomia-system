import { z } from "zod";

export const businessKinds = [
  { value: "hamburgueseria", label: "Hamburguesería" },
  { value: "rotiseria", label: "Rotisería" },
  { value: "pastas", label: "Casa de pastas" },
  { value: "otro", label: "Otro emprendimiento gastronómico" },
] as const;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63)
    .replace(/-$/g, "");
}

export const businessInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Ingresá al menos 2 caracteres.")
      .max(100, "Usá hasta 100 caracteres."),
    slug: z
      .string()
      .trim()
      .min(3, "Usá al menos 3 caracteres.")
      .max(63, "Usá hasta 63 caracteres.")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Usá letras minúsculas, números y guiones entre palabras.",
      ),
    kind: z.enum(["hamburgueseria", "rotiseria", "pastas", "otro"], {
      error: "Elegí el rubro del negocio.",
    }),
    whatsapp: z
      .string()
      .trim()
      .regex(
        /^\+?[\d\s().-]+$/,
        "Ingresá un teléfono válido con código de país.",
      )
      .transform((value) => `+${value.replace(/\D/g, "")}`)
      .pipe(
        z
          .string()
          .regex(
            /^\+[1-9]\d{7,14}$/,
            "Incluí el código de país; por ejemplo, +54 9 351 123 4567.",
          ),
      ),
    city: z
      .string()
      .trim()
      .min(2, "Ingresá la ciudad.")
      .max(100, "Usá hasta 100 caracteres."),
    address: z
      .string()
      .trim()
      .max(200, "Usá hasta 200 caracteres.")
      .default(""),
    requestKey: z.uuid("La solicitud venció. Recargá la página."),
  })
  .strict();

export type BusinessInput = z.infer<typeof businessInput>;
