"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatMoney } from "@/lib/menu";
import {
  nextStage,
  nextStageAction,
  stageLabels,
  stagesFor,
  type Order,
} from "@/lib/checkout";
import { usePanelBase } from "./panel-base";

// ICU versions differ on short-date punctuation and year width. Keep the
// initial server render identical to the browser while using local time.
function orderDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")}, ${part("hour")}:${part("minute")}`;
}

const POLL_MS = 8000;
const SOUND_KEY = "pedipue:order-sound";
const dateTime = { format: (value: Date) => orderDate(value.toISOString()) };
const clock = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Cordoba",
  timeStyle: "short",
});
const orderNumber = (o: Order) => `#${o.number.toString().padStart(3, "0")}`;

type Filter = "active" | "done" | "all";
const isDone = (o: Order) =>
  o.status !== "pending_confirmation" &&
  !(o.status === "accepted" && o.stage !== "delivered");

function statusLabel(o: Order) {
  if (o.status === "pending_confirmation") return "Pendiente";
  if (o.status === "rejected") return "Rechazado";
  if (o.status === "cancelled") return "Anulado";
  return o.stage ? stageLabels[o.stage] : "Aceptado";
}

// Two short tones with the Web Audio API, so there is no file to load.
function chime(ctx: AudioContext) {
  const start = ctx.currentTime;
  [880, 1320].forEach((frequency, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const at = start + i * 0.18;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.32);
  });
}

export function OrderInbox({
  businessId,
  businessName,
  storeBase,
  initialOrders,
}: {
  businessId: string;
  businessName: string;
  storeBase: string;
  initialOrders: Order[];
}) {
  const panel = usePanelBase();
  const [orders, setOrders] = useState(initialOrders);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);
  const [sound, setSound] = useState<"off" | "on" | "blocked">("off");
  const [printing, setPrinting] = useState<Order | null>(null);
  const [copied, setCopied] = useState("");
  const seen = useRef(new Set(initialOrders.map((o) => o.id)));
  const audio = useRef<AudioContext | null>(null);
  const soundOn = useRef(false);
  const base = `/api/businesses/${businessId}/orders`;

  const trackingLink = (o: Order) =>
    new URL(
      `${storeBase}/pedido/${o.trackingToken}`,
      window.location.origin,
    ).toString();

  const enableSound = useCallback(async () => {
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      soundOn.current = true;
      setSound(audio.current.state === "running" ? "on" : "blocked");
      return audio.current.state === "running";
    } catch {
      setSound("blocked");
      return false;
    }
  }, []);

  // Browsers only allow audio after a tap, so a saved preference waits for
  // the first interaction with the page.
  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem(SOUND_KEY) === "on";
    } catch {}
    if (!saved) return;
    soundOn.current = true;
    setSound("blocked");
    const unlock = () => {
      void enableSound();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enableSound]);

  const refresh = useCallback(async () => {
    const r = await fetch(base, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    const next: Order[] = d.orders;
    const arrived = next.filter(
      (o) => !seen.current.has(o.id) && o.status === "pending_confirmation",
    );
    next.forEach((o) => seen.current.add(o.id));
    if (arrived.length) {
      setFresh((f) => new Set([...f, ...arrived.map((o) => o.id)]));
      setFilter((f) => (f === "done" ? "active" : f));
      if (soundOn.current && audio.current?.state === "running")
        chime(audio.current);
    }
    setOrders(next);
    setSyncedAt(new Date());
    setOffline(false);
  }, [base]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "visible")
        await refresh().catch(() => setOffline(true));
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      clearTimeout(timer);
      void tick();
    };
    timer = setTimeout(tick, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const pending = orders.filter(
    (o) => o.status === "pending_confirmation",
  ).length;
  useEffect(() => {
    const title = document.title.replace(/^\(\d+\) /, "");
    document.title = pending ? `(${pending}) ${title}` : title;
  }, [pending]);

  useEffect(() => {
    if (!printing) return;
    document.body.classList.add("printing-comanda");
    const done = () => {
      document.body.classList.remove("printing-comanda");
      setPrinting(null);
    };
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    return () => {
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("printing-comanda");
    };
  }, [printing]);

  async function send(o: Order, change: Record<string, string>) {
    setBusy(o.id);
    setError("");
    setFresh((f) => {
      const next = new Set(f);
      next.delete(o.id);
      return next;
    });
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: o.id, version: o.version, ...change }),
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

  async function copyLink(o: Order) {
    try {
      await navigator.clipboard.writeText(trackingLink(o));
      setCopied(o.id);
      setTimeout(() => setCopied((c) => (c === o.id ? "" : c)), 2500);
    } catch {
      window.prompt("Copiá el link de seguimiento", trackingLink(o));
    }
  }

  function whatsappTracking(o: Order) {
    const text = `Hola ${o.customerName}, podés seguir tu pedido ${orderNumber(o)} de ${businessName} acá: ${trackingLink(o)}`;
    return `https://wa.me/${o.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
  }

  const active = orders.filter((o) => !isDone(o));
  const done = orders.filter(isDone);
  const shown =
    filter === "active" ? active : filter === "done" ? done : orders;

  return (
    <>
      <div className="workspace-toolbar">
        <div
          className="order-filters"
          role="group"
          aria-label="Filtrar pedidos"
        >
          {(
            [
              ["active", "En curso", active.length],
              ["done", "Terminados", done.length],
              ["all", "Todos", orders.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label} <span>{count}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <p className="live-status" role="status">
            <span
              className={offline ? "live-dot is-offline" : "live-dot"}
              aria-hidden="true"
            />
            {offline
              ? "Sin conexión, reintentando"
              : syncedAt
                ? `En vivo · ${clock.format(syncedAt)}`
                : "En vivo"}
          </p>
          <button
            type="button"
            className="secondary-button"
            aria-pressed={sound === "on"}
            onClick={async () => {
              if (sound === "on") {
                soundOn.current = false;
                setSound("off");
                try {
                  localStorage.setItem(SOUND_KEY, "off");
                } catch {}
                return;
              }
              if (await enableSound()) {
                chime(audio.current!);
                try {
                  localStorage.setItem(SOUND_KEY, "on");
                } catch {}
              }
            }}
          >
            {sound === "on"
              ? "Sonido activado"
              : sound === "blocked"
                ? "Tocá para activar el sonido"
                : "Activar sonido"}
          </button>
        </div>
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
            Esta pantalla se actualiza sola: dejala abierta y activá el sonido
            para enterarte al toque. El cliente continúa por WhatsApp, pero
            abrir el chat no confirma el pedido ni lo marca como pagado.
          </p>
        </section>
      ) : !shown.length ? (
        <p className="field-hint standalone-hint">
          {filter === "active"
            ? "No hay pedidos en curso. Los nuevos aparecen acá solos."
            : "Todavía no hay pedidos terminados."}
        </p>
      ) : (
        <div className="order-grid">
          {shown.map((o) => {
            const next = nextStage(o.fulfillment, o.stage);
            const action = o.stage
              ? nextStageAction(o.fulfillment, o.stage)
              : null;
            const steps = stagesFor(o.fulfillment);
            return (
              <article
                className={
                  fresh.has(o.id) ? "order-ticket is-new" : "order-ticket"
                }
                key={o.id}
              >
                <div className="ticket-heading">
                  <strong>{orderNumber(o)}</strong>
                  <span
                    className="small-badge"
                    data-status={o.stage ?? o.status}
                  >
                    {fresh.has(o.id) ? "Nuevo" : statusLabel(o)}
                  </span>
                </div>
                <p>{dateTime.format(new Date(o.createdAt))}</p>
                {o.stage && o.status === "accepted" ? (
                  <ol className="stage-track" aria-label="Estado del pedido">
                    {steps.map((s, i) => (
                      <li
                        key={s}
                        aria-current={s === o.stage ? "step" : undefined}
                        data-done={i <= steps.indexOf(o.stage!) || undefined}
                      >
                        {stageLabels[s]}
                      </li>
                    ))}
                  </ol>
                ) : null}
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
                {o.deliveryLocation ? <a className="text-button" href={`https://www.google.com/maps/dir/?api=1&destination=${o.deliveryLocation.lat},${o.deliveryLocation.lng}`} target="_blank" rel="noopener noreferrer">Abrir ubicación de entrega en Maps</a> : null}
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
                      {i.choices?.map((c) => (
                        <span key={c}>{c}</span>
                      ))}
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
                      onClick={() => send(o, { status: "rejected" })}
                    >
                      Rechazar
                    </button>
                    <button
                      className="primary-button compact-button"
                      disabled={busy === o.id}
                      onClick={() => send(o, { status: "accepted" })}
                    >
                      Aceptar pedido
                    </button>
                  </div>
                ) : null}
                {o.status === "accepted" && next && action ? (
                  <div className="ticket-actions">
                    <button
                      className="primary-button compact-button"
                      disabled={busy === o.id}
                      onClick={() => send(o, { stage: next })}
                    >
                      {action}
                    </button>
                  </div>
                ) : null}
                <div className="ticket-links">
                  {o.status !== "rejected" ? (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setPrinting(o)}
                    >
                      Imprimir comanda
                    </button>
                  ) : null}
                  {o.trackingToken && o.status === "accepted" ? (
                    <>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => copyLink(o)}
                      >
                        {copied === o.id
                          ? "Link copiado ✓"
                          : "Copiar link de seguimiento"}
                      </button>
                      <a
                        className="text-button"
                        href={whatsappTracking(o)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Mandar seguimiento por WhatsApp ↗
                      </a>
                    </>
                  ) : null}
                  {o.saleId && o.status === "accepted" ? (
                    <Link
                      className="text-button"
                      href={`${panel}/gestion/ventas`}
                    >
                      Ver venta o registrar anulación
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {printing
        ? createPortal(
            <Comanda order={printing} businessName={businessName} />,
            document.body,
          )
        : null}
    </>
  );
}

// Kitchen ticket, sized for 80 mm thermal printers but readable on A4.
function Comanda({
  order: o,
  businessName,
}: {
  order: Order;
  businessName: string;
}) {
  return (
    <section className="comanda-print" aria-hidden="true">
      <p className="comanda-business">{businessName}</p>
      <div className="comanda-heading">
        <strong>{orderNumber(o)}</strong>
        <span>{o.fulfillment === "delivery" ? "DELIVERY" : "RETIRA"}</span>
      </div>
      <p>{dateTime.format(new Date(o.createdAt))}</p>
      <p className="comanda-customer">
        {o.customerName} · {o.customerPhone}
      </p>
      {o.address ? (
        <p>
          {o.address}
          {o.zoneName ? ` (${o.zoneName})` : ""}
        </p>
      ) : null}
      <ul>
        {o.items.map((i, j) => (
          <li key={j}>
            <strong>
              {i.quantity} × {i.name}
              {i.variant !== "Única" ? ` · ${i.variant}` : ""}
            </strong>
            {i.addOns.length ? <span>+ {i.addOns.join(", ")}</span> : null}
            {i.choices?.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </li>
        ))}
      </ul>
      {o.note ? <p className="comanda-note">NOTA: {o.note}</p> : null}
      <p className="comanda-total">
        <span>{o.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}</span>
        <strong>{formatMoney(o.totalCents)}</strong>
      </p>
    </section>
  );
}
