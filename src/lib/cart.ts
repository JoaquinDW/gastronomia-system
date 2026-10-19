import { resolveChoices, type Product } from "./menu";
export type CartLine = {
  key: string;
  productId: string;
  variantId: string;
  addOnIds: string[];
  choiceIds: string[];
  quantity: number;
  quotedUnitCents: number;
  label: string;
  choices: string[];
};
/** A cart line for one unit, or null when the picks no longer fit the carta. */
export function cartLine(
  p: Product,
  variantId: string,
  addOnIds: string[],
  choiceIds: string[],
  quantity: number,
): CartLine | null {
  const v = p.variants.find((v) => v.id === variantId);
  const extras = p.addOns.filter((a) => addOnIds.includes(a.id));
  const choices = resolveChoices(p, choiceIds);
  if (!v || extras.length !== addOnIds.length || !choices.ok) return null;
  const ids = extras.map((a) => a.id).sort();
  const picks = [...choiceIds].sort();
  return {
    key: JSON.stringify([p.id, v.id, ids, picks]),
    productId: p.id,
    variantId: v.id,
    addOnIds: ids,
    choiceIds: picks,
    quantity,
    quotedUnitCents:
      v.priceCents +
      extras.reduce((n, a) => n + a.priceCents, 0) +
      choices.value.cents,
    label: `${p.name}${v.name !== "Única" ? ` · ${v.name}` : ""}${extras.length ? ` + ${extras.map((a) => a.name).join(", ")}` : ""}`,
    choices: choices.value.labels,
  };
}

/** "1.500", "1500" or "1500,50" pesos to cents; null when it isn't a price. */
export function pesosToCents(value: string): number | null {
  const clean = value.trim().replace(/\$|\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!clean) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
