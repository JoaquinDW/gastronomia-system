"use client";
import { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/menu";
import type { Order } from "@/lib/checkout";
import { usePanelBase } from "./panel-base";
export function OrderInbox({
  businessId,
  initialOrders,
}: {
  businessId: string;
  initialOrders: Order[];
}) {
  const panel = usePanelBase();
  const [orders, setOrders] = useState(initialOrders);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const base = `/api/businesses/${businessId}/orders`;
  async function refresh() {
    const r = await fetch(base, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setOrders(d.orders);
  }
  async function decide(o: Order, status: "accepted" | "rejected") {
    setBusy(o.id);
    setError("");
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: o.id, version: o.version, status }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (d.order.management)
        setNotice(
          [
            ...(d.order.management.warnings ?? []),
            ...(d.order.management.costComplete === false
              ? [
                  "Venta registrada con costos pendientes. Revisá las recetas en Gestión.",
                ]
              : []),
          ].join(" · "),
        );
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos atender el pedido.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="workspace-toolbar">
        <p>
          {orders.filter((o) => o.status === "pending_confirmation").length}{" "}
          pendientes de confirmar
        </p>
        <button
          className="secondary-button"
          onClick={async () => {
            try {
              await refresh();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "No pudimos actualizar.",
              );
            }
          }}
        >
          Actualizar pedidos ↻
        </button>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="field-hint standalone-hint" role="status">
          {notice}
        </p>
      ) : null}
      {!orders.length ? (
        <section className="empty-catalog">
          <h2>
            Tu primer pedido
            <br />
            va a aparecer acá.
          </h2>
          <p>
            Al finalizar en la tienda, el pedido se guarda pendiente y el
            cliente continúa por WhatsApp. Abrir el chat no lo confirma ni lo
            marca como pagado.
          </p>
        </section>
      ) : (
        <div className="order-grid">
          {orders.map((o) => (
            <article className="order-ticket" key={o.id}>
              <div className="ticket-heading">
                <strong>#{o.number.toString().padStart(3, "0")}</strong>
                <span className="small-badge">
                  {o.status === "accepted"
                    ? "Aceptado"
                    : o.status === "cancelled"
                      ? "Anulado"
                      : o.status === "rejected"
                        ? "Rechazado"
                        : "Pendiente"}
                </span>
              </div>
              <p>
                {new Intl.DateTimeFormat("es-AR", {
                  timeZone: "America/Argentina/Cordoba",
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(o.createdAt))}
              </p>
              <h2>{o.customerName}</h2>
              <p>
                {o.customerPhone} ·{" "}
                {o.fulfillment === "delivery" ? "Delivery" : "Retiro"}
              </p>
              {o.address ? (
                <p>
                  {o.zoneName} · {o.address}
                </p>
              ) : null}
              <ul>
                {o.items.map((i, j) => (
                  <li key={j}>
                    <strong>
                      {i.quantity} × {i.name}
                    </strong>
                    {i.variant !== "Única" ? <span>{i.variant}</span> : null}
                    {i.addOns.length ? (
                      <span>+ {i.addOns.join(", ")}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {o.note ? <p className="ticket-note">{o.note}</p> : null}
              <div className="cart-total">
                <span>Total</span>
                <strong>{formatMoney(o.totalCents)}</strong>
              </div>
              <p className="field-hint standalone-hint">
                {o.paymentMethod === "cash" ? "Efectivo" : "Transferencia"} ·
                cobro a verificar
              </p>
              {o.status === "pending_confirmation" ? (
                <div className="ticket-actions">
                  <button
                    className="secondary-button"
                    disabled={busy === o.id}
                    onClick={() => decide(o, "rejected")}
                  >
                    Rechazar
                  </button>
                  <button
                    className="primary-button compact-button"
                    disabled={busy === o.id}
                    onClick={() => decide(o, "accepted")}
                  >
                    Aceptar pedido
                  </button>
                </div>
              ) : null}
              {o.saleId && o.status === "accepted" ? (
                <Link className="text-button" href={`${panel}/gestion/ventas`}>
                  Ver venta o registrar anulación
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
