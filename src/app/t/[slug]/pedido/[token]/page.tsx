import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/menu";
import { storeUrl } from "@/lib/hosts";
import { stageLabels, stagesFor } from "@/lib/checkout";
import { trackOrder, type TrackedOrder } from "@/server/orders";
import { AutoRefresh } from "@/components/auto-refresh";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string; token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, token } = await params;
  const order = await trackOrder(slug, token);
  return {
    title: order
      ? `Pedido #${order.number} · ${order.businessName}`
      : "Seguimiento de pedido — Pedipue",
    robots: { index: false, follow: false },
  };
}

function headline(o: TrackedOrder) {
  const pickup = o.fulfillment !== "delivery";
  if (o.status === "rejected") return "El local no pudo tomar este pedido.";
  if (o.status === "cancelled") return "Este pedido se anuló.";
  if (o.status === "pending_confirmation")
    return "Recibido. Falta que el local lo confirme.";
  switch (o.stage) {
    case "ready":
      return pickup
        ? "¡Listo! Ya podés pasar a buscarlo."
        : "¡Listo! Sale en un rato.";
    case "on_the_way":
      return "Va en camino.";
    case "delivered":
      return pickup
        ? "Retirado. ¡Que lo disfrutes!"
        : "Entregado. ¡Que lo disfrutes!";
    default:
      return "Lo estamos preparando.";
  }
}

export default async function TrackingPage({ params }: Params) {
  const { slug, token } = await params;
  const o = await trackOrder(slug, token);
  if (!o) notFound();
  const steps = stagesFor(o.fulfillment);
  const reached =
    o.status === "accepted" && o.stage ? steps.indexOf(o.stage) : -1;
  const closed =
    o.status === "rejected" ||
    o.status === "cancelled" ||
    o.stage === "delivered";
  const chat = `https://wa.me/${o.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${o.businessName}, te escribo por el pedido #${o.number}.`)}`;
  return (
    <div className="shop-shell">
      {closed ? null : <AutoRefresh seconds={15} />}
      <header className="shop-header">
        <a href={storeUrl(slug)} className="shop-brand">
          {o.businessName}
        </a>
      </header>
      <main className="tracking-page">
        <p className="eyebrow">
          PEDIDO #{o.number.toString().padStart(3, "0")}
        </p>
        <h1>{headline(o)}</h1>
        {o.status === "rejected" || o.status === "cancelled" ? null : (
          <ol className="tracking-steps">
            <li data-done="">Recibido</li>
            {steps.map((s, i) => (
              <li
                key={s}
                data-done={i <= reached ? "" : undefined}
                aria-current={i === reached ? "step" : undefined}
              >
                {s === "delivered" && o.fulfillment !== "delivery"
                  ? "Retirado"
                  : stageLabels[s]}
              </li>
            ))}
          </ol>
        )}
        <section className="tracking-summary">
          <ul>
            {o.items.map((i, j) => (
              <li key={j}>
                <strong>
                  {i.quantity} × {i.name}
                  {i.variant !== "Única" ? ` (${i.variant})` : ""}
                </strong>
                {i.addOns.length ? <span>+ {i.addOns.join(", ")}</span> : null}
                {i.choices?.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </li>
            ))}
          </ul>
          <p>
            {o.fulfillment === "delivery"
              ? `Delivery${o.zoneName ? ` · ${o.zoneName}` : ""}`
              : "Retiro en el local"}{" "}
            · {o.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}
          </p>
          <div className="cart-total">
            <span>Total</span>
            <strong>{formatMoney(o.totalCents)}</strong>
          </div>
        </section>
        <a
          className="whatsapp-button"
          href={chat}
          target="_blank"
          rel="noreferrer"
        >
          Escribirle al local ↗
        </a>
        <p className="form-footnote">
          {closed
            ? "Este pedido ya terminó."
            : "Esta página se actualiza sola. Abrir WhatsApp no acredita el pago: el local lo confirma."}
        </p>
      </main>
    </div>
  );
}
