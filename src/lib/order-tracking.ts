import { formatMoney } from "./menu";
import { isDeliveryFeePending, type Order } from "./checkout";
import { storeUrl } from "./hosts";

export const statusLabels: Record<string, string> = {
  pending_confirmation: "Esperando confirmación", accepted: "En preparación",
  ready: "Listo para entregar", out_for_delivery: "En camino",
  completed: "Entregado", rejected: "Pedido rechazado", cancelled: "Pedido anulado",
};
export function trackingStatus(order: Pick<Order, "status" | "stage">) {
  if (order.status !== "accepted") return order.status;
  return ({ preparing: "accepted", ready: "ready", on_the_way: "out_for_delivery", delivered: "completed" } as const)[order.stage ?? "preparing"];
}
export function trackingUrl(slug: string, token: string, origin?: string) {
  const path = `${storeUrl(slug)}/pedido/${token}`;
  return origin ? new URL(path, origin).href : path;
}
export function orderWhatsappUrl(order: Order, whatsapp: string, url: string) {
  const pendingFee = isDeliveryFeePending(order);
  const message = [
    `${order.fulfillment === "delivery" ? "DELIVERY" : "RETIRO"} ${order.number}`,
    `Hola, soy ${order.customerName} y realicé el siguiente pedido:`, "",
    ...order.items.flatMap(i => [
      `${i.quantity} × ${i.name} ${formatMoney(i.lineCents)}`,
      ...(i.variant !== "Única" ? [`• ${i.variant}`] : []),
      ...i.addOns.map(a => `• ${a}`),
      ...(i.choices ?? []).map(choice => `• ${choice}`),
    ]), "",
    `${formatMoney(order.subtotalCents)} Productos`,
    ...(order.fulfillment === "delivery" ? [pendingFee ? "Delivery: costo a confirmar por el local" : `${formatMoney(order.deliveryCents)} Delivery`] : []),
    `${formatMoney(order.totalCents)} ${pendingFee ? "TOTAL SIN ENVÍO" : "TOTAL"} (Pago ${order.paymentMethod === "cash" ? "Efectivo" : "Transferencia"})`,
    ...(order.address ? [`Dirección: ${order.address}`] : []),
    ...(order.zoneName ? [`Zona: ${order.zoneName}`] : []),
    ...(order.deliveryLocation ? [`Ubicación: https://www.google.com/maps/search/?api=1&query=${order.deliveryLocation.lat},${order.deliveryLocation.lng}`] : []),
    ...(order.note ? [`Nota: ${order.note}`] : []), "",
    "¡Seguí el estado de tu pedido!", url,
  ].join("\n");
  return `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
export type TrackedOrder = Pick<Order, "number" | "status" | "fulfillment" | "address" | "zoneName" | "paymentMethod" | "note" | "items" | "subtotalCents" | "deliveryCents" | "totalCents" | "createdAt" | "estimatedReadyAt" | "rating"> & { token: string };
export type OrderTrackingData = {
  order: TrackedOrder;
  business: { name: string; slug: string; timezone: string; coverImageUrl: string | null; logoImageUrl: string | null; transferAlias: string; pickupInstructions: string };
  whatsappUrl: string;
  contactUrl: string;
};
