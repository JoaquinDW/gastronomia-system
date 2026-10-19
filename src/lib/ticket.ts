import { z } from "zod";
import type { OrderItem } from "./checkout";

// Customer receipt printed with the order. Off until the business turns it on.
export const ticketConfigInput = z
  .object({
    enabled: z.boolean(),
    paper: z.enum(["58", "80"]),
    footer: z.string().trim().max(200),
  })
  .strict();
export type TicketConfig = z.infer<typeof ticketConfigInput>;
export const defaultTicketConfig: TicketConfig = {
  enabled: false,
  paper: "80",
  footer: "",
};

// What this device prints by itself after tapping "Aceptar pedido".
export const autoPrintOptions = ["off", "comanda", "ticket", "both"] as const;
export type AutoPrint = (typeof autoPrintOptions)[number];
export function autoPrintDocs(
  choice: AutoPrint,
  ticketEnabled: boolean,
): ("comanda" | "ticket")[] {
  const docs: ("comanda" | "ticket")[] = [];
  if (choice === "comanda" || choice === "both") docs.push("comanda");
  if (ticketEnabled && (choice === "ticket" || choice === "both"))
    docs.push("ticket");
  return docs;
}

export type ProductCategory = { id: string; category: string };

// Groups the order lines like the menu: categories in menu order, lines in
// order inside each one. Products deleted since then go last, under "Otros".
export function groupByCategory(
  items: OrderItem[],
  categories: ProductCategory[],
): { category: string; items: OrderItem[] }[] {
  const byProduct = new Map(categories.map((c) => [c.id, c.category]));
  const order = [...new Set(categories.map((c) => c.category))];
  const groups = new Map<string, OrderItem[]>();
  for (const item of items) {
    const category =
      (item.productId && byProduct.get(item.productId)) || "Otros";
    groups.set(category, [...(groups.get(category) ?? []), item]);
  }
  const rank = (c: string) => {
    const i = order.indexOf(c);
    return i === -1 ? order.length : i;
  };
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([category, items]) => ({ category, items }));
}
