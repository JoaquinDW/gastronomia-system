"use client";
import { useEffect, useRef, useState } from "react";
import { formatMoney, productImage } from "@/lib/menu";
import { isDeliveryFeePending } from "@/lib/checkout";
import { statusLabels, type OrderTrackingData } from "@/lib/order-tracking";
import { storeUrl } from "@/lib/hosts";

function Icon({ kind }: { kind: "receipt" | "cook" | "bag" | "bike" | "check" | "chat" | "bank" }) {
  const paths = {
    receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6",
    cook: "M8 21V11a4 4 0 0 1-2-7 4 4 0 0 1 6-1 4 4 0 0 1 6 1 4 4 0 0 1-2 7v10H8Zm0-5h8",
    bag: "M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2",
    bike: "M8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm14 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 17l4-9h5l5 9M8 5h4m2 3 2-4h3",
    check: "m5 12 4 4L19 6",
    chat: "M21 11a9 9 0 0 1-13 8l-5 2 1-5A9 9 0 1 1 21 11ZM8 10h8m-8 4h5",
    bank: "m3 8 9-5 9 5H3Zm3 3v7m6-7v7m6-7v7M3 21h18",
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}
function dateLabel(value: string, timezone: string, timeOnly = false) {
  const parts = new Intl.DateTimeFormat("es-AR", { timeZone: timezone, ...(timeOnly ? {} : { day: "2-digit", month: "2-digit" }), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const p = (key: string) => parts.find(x => x.type === key)?.value;
  return `${timeOnly ? "" : `${p("day")}/${p("month")} · `}${p("hour")}:${p("minute")} hs`;
}
export function OrderTracking({ initial, confirm }: { initial: OrderTrackingData; confirm: boolean }) {
  const [data, setData] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [copyState, setCopyState] = useState("");
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const { order, business } = data;
  const endpoint = `/api/storefront/${business.slug}/orders/${order.token}`;
  const terminal = ["completed", "cancelled", "rejected"].includes(order.status);
  const pending = order.status === "pending_confirmation";
  const cancelled = ["cancelled", "rejected"].includes(order.status);
  const feePending = isDeliveryFeePending(order);
  useEffect(() => {
    if (confirm && initial.order.status === "pending_confirmation") dialog.current?.showModal();
  }, [confirm, initial.order.status]);
  useEffect(() => { if (!pending) dialog.current?.close(); }, [pending]);
  useEffect(() => {
    if (terminal) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let running = false;
    async function refresh() {
      if (running || disposed) return;
      clearTimeout(timer);
      if (document.visibilityState !== "hidden") {
        running = true;
        controller = new AbortController();
        const timeout = setTimeout(() => controller?.abort(), 12000);
        try {
          const r = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
          if (!r.ok) throw new Error();
          const next = await r.json();
          if (!disposed) { setData(next); setOffline(false); }
        } catch { if (!disposed) setOffline(true); }
        finally { clearTimeout(timeout); running = false; }
      }
      if (!disposed) timer = setTimeout(refresh, 10000);
    }
    void refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("online", refresh); };
  }, [endpoint, terminal]);
  function dismiss() {
    dialog.current?.close();
    const url = new URL(window.location.href);
    url.searchParams.delete("confirm");
    window.history.replaceState(null, "", url);
  }
  async function rate(rating: number) {
    setRatingBusy(true); setRatingError("");
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating }) });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setData(current => ({ ...current, order: { ...current.order, rating: result.rating } }));
    } catch (e) { setRatingError(e instanceof Error ? e.message : "No pudimos guardar tu calificación."); }
    finally { setRatingBusy(false); }
  }
  const steps: { status: string; label: string; icon: "receipt" | "cook" | "bag" | "bike" | "check" }[] = [
    { status: "pending_confirmation", label: "Recibido", icon: "receipt" },
    { status: "accepted", label: "Preparando", icon: "cook" },
    { status: "ready", label: "Listo", icon: "bag" },
    ...(order.fulfillment === "delivery" ? [{ status: "out_for_delivery", label: "En camino", icon: "bike" as const }] : []),
    { status: "completed", label: "Entregado", icon: "check" },
  ];
  const currentStep = steps.findIndex(s => s.status === order.status);
  const cover = business.coverImageUrl ? productImage(business.coverImageUrl) : null;
  return <main className="tracking-page">
    <div className="tracking-wrap">
      <header className="tracking-brand">
        <a href={storeUrl(business.slug)} aria-label={`Volver a la carta de ${business.name}`} className="tracking-avatar">{cover ? <img src={cover.src} alt="" /> : business.name.slice(0, 1)}</a>
        <h1>{business.name}</h1>
        <div className="tracking-meta"><span>{order.fulfillment === "delivery" ? "Delivery" : "Retiro"} · #{order.number}</span><time dateTime={order.createdAt}>{dateLabel(order.createdAt, business.timezone)}</time></div>
      </header>
      <section className="tracking-status" aria-label="Estado del pedido">
        {!cancelled ? <ol className="tracking-steps">{steps.map((step, index) => <li key={step.status} className={index <= currentStep ? "is-reached" : ""} aria-current={index === currentStep ? "step" : undefined}><span><Icon kind={index < currentStep ? "check" : step.icon} /></span><small>{step.label}</small></li>)}</ol> : null}
        <div aria-live="polite"><h2>{statusLabels[order.status] ?? "Consultá al local"}</h2>
          <p>{pending ? "Enviá tu pedido por WhatsApp para que el local lo confirme." : cancelled ? "Contactá al local si necesitás ayuda con el pedido o el pago." : order.status === "completed" ? "Gracias por elegirnos. ¡Que lo disfrutes!" : order.status === "out_for_delivery" ? "Tu pedido está en camino a la dirección que indicaste." : order.status === "ready" ? (order.fulfillment === "delivery" ? "Tu pedido está listo para salir." : "Ya podés pasar a buscar tu pedido.") : order.estimatedReadyAt ? <>Listo aproximadamente a las <strong>{dateLabel(order.estimatedReadyAt, business.timezone, true)}</strong>.</> : "El local ya está preparando tu pedido."}</p>
        </div>
        {!terminal ? <p className={`tracking-live ${offline ? "is-offline" : ""}`} role="status"><i />{offline ? "Sin conexión. Reintentando…" : "Seguimiento automático · cada 10 s"}</p> : null}
        <a className={pending ? "tracking-button" : "tracking-contact"} href={pending ? data.whatsappUrl : data.contactUrl} data-track={pending ? "order_whatsapp_clicked" : "order_contact_clicked"} data-track-store={business.slug} data-track-place="page" target="_blank" rel="noopener noreferrer"><Icon kind="chat" />{pending ? "Confirmar por WhatsApp" : "Contactar por WhatsApp"}</a>
      </section>
      <section className="tracking-card">
        <div className="tracking-card-heading"><h2><Icon kind="receipt" />Tu pedido</h2><span>{order.items.reduce((n, i) => n + i.quantity, 0)} productos</span></div>
        <ul className="tracking-items">{order.items.map((item, index) => <li key={index}>
          {item.imageUrl ? <img src={productImage(item.imageUrl).src} alt="" width="48" height="48" /> : <span className="tracking-item-placeholder"><Icon kind="bag" /></span>}
          <div><strong>{item.quantity}× {item.name}</strong>{item.variant !== "Única" ? <small>{item.variant}</small> : null}{item.addOns.length ? <small>{item.addOns.join(" · ")}</small> : null}{item.choices?.map(choice => <small key={choice}>{choice}</small>)}</div><b>{formatMoney(item.lineCents)}</b>
        </li>)}</ul>
        <dl className="tracking-totals"><div><dt>Productos</dt><dd>{formatMoney(order.subtotalCents)}</dd></div>{order.fulfillment === "delivery" ? <div><dt>Envío</dt><dd>{feePending ? "A confirmar" : formatMoney(order.deliveryCents)}</dd></div> : null}<div className="tracking-total"><dt>{feePending ? "Total sin envío" : "Total"} · {order.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}</dt><dd>{formatMoney(order.totalCents)}</dd></div></dl>
        <p className="tracking-address">{order.fulfillment === "delivery" ? `Entrega en ${order.address}` : business.pickupInstructions || "Retiro en el local"}</p>
        {order.note ? <p className="tracking-note"><strong>Tu nota</strong>{order.note}</p> : null}
      </section>
      {order.paymentMethod === "transfer" && !cancelled ? <section className="tracking-card tracking-payment">
        <h2><Icon kind="bank" />Datos para la transferencia</h2>
        {business.transferAlias ? <div className="tracking-alias"><div><small>ALIAS</small><strong>{business.transferAlias}</strong></div><button onClick={async () => { try { await navigator.clipboard.writeText(business.transferAlias); setCopyState("Alias copiado"); } catch { setCopyState("No pudimos copiarlo. Seleccioná el alias para copiarlo."); } }}>Copiar</button></div> : <p>Pedile los datos de transferencia al local por WhatsApp.</p>}
        <p>{feePending ? "Productos (envío a confirmar)" : "Total a transferir"}: <strong>{formatMoney(order.totalCents)}</strong></p>
        <small>El local verificará el pago.</small><span role="status">{copyState}</span>
      </section> : null}
      {order.status === "completed" ? <section className="tracking-rating"><h2>¿Cómo estuvo tu pedido?</h2><p>Tocá una estrella para calificar a {business.name}.</p><div aria-label="Calificar pedido">{[1,2,3,4,5].map(n => <button key={n} aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`} aria-pressed={order.rating === n} disabled={ratingBusy} onClick={() => rate(n)} className={(order.rating ?? 0) >= n ? "is-selected" : ""}>★</button>)}</div><p role="status">{order.rating ? "¡Gracias por compartir tu experiencia!" : ""}</p>{ratingError ? <p role="alert">{ratingError}</p> : null}</section> : null}
      <footer className="tracking-footer"><a href={storeUrl(business.slug)}>Volver a la carta ↗</a><span>Hecho con <b>pedipue.</b></span></footer>
    </div>
    <dialog ref={dialog} className="tracking-dialog" aria-labelledby="confirm-title" onCancel={dismiss}>
      <span className="tracking-dialog-icon"><Icon kind="chat" /></span><p className="tracking-eyebrow">UN PASO MÁS</p><h2 id="confirm-title">Tu pedido ya está guardado.</h2><p>Enviás el mensaje y el local puede empezar a prepararlo.</p><ol><li>Se abrirá WhatsApp con tu pedido.</li><li>Enviá el mensaje para pedir la confirmación.</li></ol><a className="tracking-button" href={data.whatsappUrl} data-track="order_whatsapp_clicked" data-track-store={business.slug} data-track-place="dialog" target="_blank" rel="noopener noreferrer" onClick={dismiss}>Confirmar por WhatsApp ↗</a><button className="tracking-later" onClick={dismiss}>Ver mi pedido primero</button>
    </dialog>
  </main>;
}
