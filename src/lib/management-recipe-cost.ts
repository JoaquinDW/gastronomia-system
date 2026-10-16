import type { Recipe, StockItem } from "./management";
import { costOf, multiply } from "./management-math";

/** Quote current recipes explicitly selected for a historical order. No stock changes. */
export function historicalRecipeCost(
  selection: { productId: string; variantId: string; addOnIds: string[] },
  quantity: number,
  recipes: Recipe[],
  items: StockItem[],
) {
  const options = [
    { kind: "variant", id: selection.variantId },
    ...selection.addOnIds.map((id) => ({ kind: "addon", id })),
  ];
  const components: {
    recipeId: string;
    itemId: string;
    name: string;
    quantity: string;
    unitCost: string;
    costCents: string;
  }[] = [];
  const recipeIds: string[] = [];
  let total = 0n;
  for (const option of options) {
    const recipe = recipes.find(
      (r) =>
        r.productId === selection.productId &&
        r.optionId === option.id &&
        r.optionKind === option.kind,
    );
    if (!recipe) return null;
    recipeIds.push(recipe.id);
    for (const line of recipe.lines) {
      const item = items.find((i) => i.id === line.itemId);
      if (!item || item.unitCost === null) return null;
      const q = multiply(line.quantity, String(quantity));
      const costCents = costOf(q, item.unitCost)!;
      total += BigInt(costCents);
      components.push({
        recipeId: recipe.id,
        itemId: item.id,
        name: item.name,
        quantity: q,
        unitCost: item.unitCost,
        costCents,
      });
    }
  }
  return { costCents: total.toString(), recipeIds, components };
}
