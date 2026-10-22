import { z } from "zod";
import { reservedSlugs } from "@/lib/hosts";

export const businessKinds = [
  { value: "hamburgueseria", label: "Hamburguesería" },
  { value: "pizzeria", label: "Pizzería" },
  { value: "empanadas", label: "Empanadas" },
  { value: "lomiteria", label: "Lomitería y sándwiches" },
  { value: "lomito_arabe", label: "Lomitos árabes" },
  { value: "shawarma", label: "Shawarma y comida de Medio Oriente" },
  { value: "rotiseria", label: "Rotisería" },
  { value: "pastas", label: "Casa de pastas" },
  { value: "parrilla", label: "Parrilla" },
  { value: "milanesas", label: "Milanesas" },
  { value: "pancheria", label: "Panchería" },
  { value: "picadas", label: "Picadas y tablas" },
  { value: "sushi", label: "Sushi y comida japonesa" },
  { value: "asiatica", label: "Comida china y asiática" },
  { value: "mexicana", label: "Comida mexicana" },
  { value: "peruana", label: "Comida peruana" },
  { value: "vegana", label: "Vegana y vegetariana" },
  { value: "saludable", label: "Comida saludable y ensaladas" },
  { value: "viandas", label: "Viandas" },
  { value: "bar", label: "Bar y cervecería" },
  { value: "cafeteria", label: "Cafetería" },
  { value: "panaderia", label: "Panadería y confitería" },
  { value: "pasteleria", label: "Pastelería y tortas" },
  { value: "heladeria", label: "Heladería" },
  { value: "otro", label: "Otro emprendimiento gastronómico" },
] as const;

const businessKindValues = businessKinds.map((kind) => kind.value) as [
  (typeof businessKinds)[number]["value"],
  ...(typeof businessKinds)[number]["value"][],
];

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

// Los guiones son opcionales: "daflomitosarabes" y "daf-lomitos-arabes" valen.
export const slugInput = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usá al menos 3 caracteres.")
  .max(63, "Usá hasta 63 caracteres.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Usá letras minúsculas y números, sin espacios ni tildes. Los guiones entre palabras son opcionales.",
  )
  .refine(
    (slug) => !reservedSlugs.has(slug),
    "Esa dirección está reservada. Probá con otra.",
  );

export const businessInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Ingresá al menos 2 caracteres.")
      .max(100, "Usá hasta 100 caracteres."),
    slug: slugInput,
    kind: z.enum(businessKindValues, {
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
