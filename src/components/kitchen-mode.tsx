"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Order } from "@/lib/checkout";
import { channelLabels, defaultCustomerName } from "@/lib/checkout";
import {
  byUrgency,
  lightLabels,
  minutesSince,
  orderTiming,
  timingLabel,
  type KitchenConfig,
} from "@/lib/kitchen";

type WakeLock = { release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<WakeLock> };

const orderNumber = (o: Order) => `#${o.number.toString().padStart(3, "0")}`;
const origin = (o: Order) =>
  [
    o.fulfillment === "delivery" ? "Delivery" : "Retira",
    o.channel && o.channel !== "store" ? channelLabels[o.channel] : null,
  ]
    .filter(Boolean)
    .join(" · ");

// Full-screen view of the same inbox for a tablet in the kitchen: only what
// is being cooked, big type, a big "Listo" and no prices or phone numbers.
export function KitchenMode({
  orders,
  config,
  now,
  busy,
  clockLabel,
  offline,
  error,
  sound,
  onSound,
  onReady,
  onExit,
}: {
  orders: Order[];
  config: KitchenConfig;
  now: number;
  busy: string;
  clockLabel: string;
  offline: boolean;
  error: string;
  sound: "off" | "on" | "blocked";
  onSound: () => void;
  onReady: (order: Order) => void;
  onExit: () => void;
}) {
  const exit = useRef<HTMLButtonElement>(null);
  const cooking = byUrgency(
    orders.filter((o) => o.status === "accepted" && o.stage === "preparing"),
    config,
    now,
  );
  const ready = orders
    .filter((o) => o.status === "accepted" && o.stage === "ready")
    .sort((a, b) => Date.parse(a.stageChangedAt ?? a.createdAt) - Date.parse(b.stageChangedAt ?? b.createdAt));
  const pending = orders.filter((o) => o.status === "pending_confirmation").length;
  const late = cooking.filter((o) => orderTiming(o, config, now)?.light === "late").length;

  // Keep the tablet awake and the page from scrolling underneath.
  useEffect(() => {
    document.body.classList.add("kitchen-open");
    exit.current?.focus();
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    let lock: WakeLock | null = null;
    const acquire = () => {
      if (api && document.visibilityState === "visible")
        api.request("screen").then((l) => (lock = l), () => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.body.classList.remove("kitchen-open");
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, []);

  return createPortal(
    <div className="kitchen-mode" role="dialog" aria-modal="true" aria-label="Modo cocina">
      <header className="kitchen-bar">
        <div>
          <p className="kitchen-eyebrow">MODO COCINA</p>
          <p className="kitchen-counts">
            <strong>{cooking.length}</strong> en preparación
            {late ? (
              <>
                {" · "}
                <span className="kitchen-late-count">{late} atrasado{late === 1 ? "" : "s"}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="kitchen-bar-actions">
          <p className="kitchen-live" role="status">
            <span className={offline ? "live-dot is-offline" : "live-dot"} aria-hidden="true" />
            {offline ? "Sin conexión, reintentando" : clockLabel}
          </p>
          <button type="button" className="kitchen-ghost" aria-pressed={sound === "on"} onClick={onSound}>
            {sound === "on" ? "Sonido activado" : sound === "blocked" ? "Tocá para activar el sonido" : "Activar sonido"}
          </button>
          <button type="button" className="kitchen-ghost" ref={exit} onClick={onExit}>
            Salir
          </button>
        </div>
      </header>
      {error ? (
        <p className="kitchen-error" role="alert">
          {error}
        </p>
      ) : null}
      {pending ? (
        <button type="button" className="kitchen-pending" onClick={onExit}>
          {pending === 1
            ? "Entró 1 pedido nuevo sin aceptar."
            : `Entraron ${pending} pedidos nuevos sin aceptar.`}{" "}
          <u>Ir a la bandeja</u>
        </button>
      ) : null}
      {cooking.length ? (
        <div className="kitchen-grid">
          {cooking.map((o) => {
            const t = orderTiming(o, config, now)!;
            const name =
              o.customerName && o.customerName !== defaultCustomerName(o.channel ?? "store")
                ? o.customerName
                : null;
            return (
              <article className="kitchen-card" data-light={t.light} key={o.id}>
                <div className="kitchen-card-top">
                  <div>
                    <strong className="kitchen-number">{orderNumber(o)}</strong>
                    <p>{[origin(o), name].filter(Boolean).join(" · ")}</p>
                  </div>
                  <p className="kitchen-timer">
                    <span className="kitchen-light">{lightLabels[t.light]}</span>
                    <strong>{timingLabel(t)}</strong>
                    <span>
                      {t.elapsed} min en cocina{t.assumed ? " · sin estimación" : ""}
                    </span>
                  </p>
                </div>
                <ul className="kitchen-items">
                  {o.items.map((i, j) => (
                    <li key={j}>
                      <strong>
                        <span className="kitchen-qty">{i.quantity}×</span> {i.name}
                        {i.variant !== "Única" ? ` · ${i.variant}` : ""}
                      </strong>
                      {i.addOns.length ? <span>+ {i.addOns.join(", ")}</span> : null}
                      {i.choices?.map((c) => <span key={c}>{c}</span>)}
                    </li>
                  ))}
                </ul>
                {o.note ? <p className="kitchen-note">{o.note}</p> : null}
                <button
                  type="button"
                  className="primary-button kitchen-ready"
                  disabled={busy === o.id}
                  onClick={() => onReady(o)}
                >
                  {busy === o.id ? "Marcando…" : `Listo ${orderNumber(o)}`}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="kitchen-empty">
          <h2>No hay nada en preparación.</h2>
          <p>Cuando aceptes un pedido o cargues uno de mostrador, aparece acá solo.</p>
        </section>
      )}
      {ready.length ? (
        <footer className="kitchen-ready-strip" aria-label="Listos para entregar">
          <p>Listos para entregar</p>
          <ul>
            {ready.map((o) => (
              <li key={o.id}>
                <strong>{orderNumber(o)}</strong>
                <span>
                  {o.fulfillment === "delivery" ? "Delivery" : "Retira"} · hace{" "}
                  {minutesSince(o.stageChangedAt, now)} min
                </span>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </div>,
    document.body,
  );
}
