"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatMoney } from "@/lib/menu";
import {
  channelLabels,
  defaultCustomerName,
  nextStage,
  nextStageAction,
  stageLabels,
  stagesFor,
  type Order,
} from "@/lib/checkout";
import {
  autoPrintDocs,
  autoPrintOptions,
  type AutoPrint,
  type ProductCategory,
  type TicketConfig,
} from "@/lib/ticket";
import {
  columnsFor,
  comandaReceipt,
  rasterize,
  type Raster,
  testPage,
  ticketReceipt,
} from "@/lib/escpos";
import {
  concatBytes,
  pickPrinter,
  printBytes,
  printerName,
  PrinterError,
  savedPrinter,
  usb,
  type UsbPrinter,
} from "@/lib/usb-printer";
import { usePanelBase } from "./panel-base";
import { CustomerTicket } from "./order-ticket";
import { PrintSettings } from "./print-settings";
import { ManualOrder, type CreatedOrder } from "./manual-order";
import { KitchenMode } from "./kitchen-mode";
import { ChargeDialog } from "./charge-dialog";
import { KitchenSettings } from "./kitchen-settings";
import {
  minutesSince,
  orderTiming,
  timingLabel,
  type KitchenConfig,
} from "@/lib/kitchen";

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
const TICK_MS = 10000;
const KITCHEN_PARAM = "cocina";
const SOUND_KEY = "pedipue:order-sound";
const AUTO_PRINT_KEY = "pedipue:auto-print";
const dateTime = { format: (value: Date) => orderDate(value.toISOString()) };
const clock = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Cordoba",
  timeStyle: "short",
});
// Older orders were never charged in the register; only offer charging the
// recent ones, the same window Caja lists.
const CHARGE_WINDOW_MS = 24 * 60 * 60 * 1000;
const promisedPayment = (o: Order) =>
  o.paymentMethod === "cash" ? "Efectivo" : "Transferencia";
const orderNumber = (o: Order) => `#${o.number.toString().padStart(3, "0")}`;
/** "Teléfono · Delivery"; store orders, and names that already say the
 * channel, only say how they're delivered. */
const orderOrigin = (o: Order) =>
  [
    o.channel && o.channel !== "store" && o.customerName !== defaultCustomerName(o.channel)
      ? channelLabels[o.channel]
      : null,
    o.fulfillment === "delivery" ? "Delivery" : "Retiro",
  ]
    .filter(Boolean)
    .join(" · ");

type Filter = "active" | "done" | "all";
type PrintJob = { order: Order; docs: ("comanda" | "ticket")[] };
const isDone = (o: Order) =>
  o.status !== "pending_confirmation" &&
  !(o.status === "accepted" && o.stage !== "delivered");

function statusLabel(o: Order) {
  if (o.status === "pending_confirmation") return "Pendiente";
  if (o.status === "rejected") return "Rechazado";
  if (o.status === "cancelled") return "Anulado";
  return o.stage ? stageLabels[o.stage] : "Aceptado";
}

function saleNotice(m: { warnings?: string[]; costComplete?: boolean }) {
  return [
    ...(m.warnings ?? []),
    ...(m.costComplete === false
      ? ["Venta registrada con costos pendientes. Revisá las recetas en Gestión."]
      : []),
  ];
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
  logoImageUrl,
  storeBase,
  initialOrders,
  initialTicket,
  initialCategories,
  initialKitchen,
  initialCashOpen,
}: {
  businessId: string;
  businessName: string;
  logoImageUrl: string;
  storeBase: string;
  initialOrders: Order[];
  initialTicket: TicketConfig;
  initialCategories: ProductCategory[];
  initialKitchen: KitchenConfig;
  initialCashOpen: boolean;
}) {
  const panel = usePanelBase();
  const [orders, setOrders] = useState(initialOrders);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [preparation, setPreparation] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [offline, setOffline] = useState(false);
  const [sound, setSound] = useState<"off" | "on" | "blocked">("off");
  const [printing, setPrinting] = useState<PrintJob | null>(null);
  const [ticket, setTicket] = useState(initialTicket);
  const [categories, setCategories] = useState(initialCategories);
  const [printSettings, setPrintSettings] = useState(false);
  const [creating, setCreating] = useState(false);
  const [autoPrint, setAutoPrint] = useState<AutoPrint>("off");
  const [printer, setPrinter] = useState<UsbPrinter | null>(null);
  const [usbSupported, setUsbSupported] = useState(false);
  const [copied, setCopied] = useState("");
  const [kitchen, setKitchen] = useState(initialKitchen);
  const [kitchenMode, setKitchenMode] = useState(false);
  const [timeSettings, setTimeSettings] = useState(false);
  const [cashOpen, setCashOpen] = useState(initialCashOpen);
  const [charging, setCharging] = useState<Order | null>(null);
  // Timers follow the server clock (from each poll's Date header), so a
  // tablet with the wrong time still colors orders right.
  const skew = useRef(0);
  const [now, setNow] = useState<number | null>(null);
  const seen = useRef(new Set(initialOrders.map((o) => o.id)));
  const audio = useRef<AudioContext | null>(null);
  const soundOn = useRef(false);
  const base = `/api/businesses/${businessId}/orders`;

  // The server render has no window; links become absolute once mounted.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const trackingLink = (o: Order) =>
    origin
      ? new URL(`${storeBase}/pedido/${o.trackingToken}`, origin).toString()
      : `${storeBase}/pedido/${o.trackingToken}`;

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTO_PRINT_KEY) as AutoPrint;
      if (autoPrintOptions.includes(saved)) setAutoPrint(saved);
    } catch {}
  }, []);

  // Chrome keeps the printer the user picked; reconnect to it on load and
  // when it is plugged back in.
  useEffect(() => {
    const api = usb();
    if (!api) return;
    setUsbSupported(true);
    const sync = () => void savedPrinter().then(setPrinter);
    sync();
    api.addEventListener("connect", sync);
    api.addEventListener("disconnect", sync);
    return () => {
      api.removeEventListener("connect", sync);
      api.removeEventListener("disconnect", sync);
    };
  }, []);

  // The logo heads the customer ticket. It comes from the server already in
  // black and white at printer size; loading it here keeps it ready both for
  // the USB printer and for the print dialog, which doesn't wait for images.
  const [logo, setLogo] = useState<(Raster & { src: string }) | null>(null);
  const logoSrc =
    ticket.enabled && logoImageUrl
      ? `/api/businesses/${businessId}/ticket/logo?paper=${ticket.paper}&v=${logoImageUrl.split("/").pop()}`
      : "";
  useEffect(() => {
    setLogo(null);
    if (!logoSrc) return;
    let alive = true;
    const img = new Image();
    img.src = logoSrc;
    img
      .decode()
      .then(() => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || !alive) return;
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setLogo({ ...rasterize(data, width, height), src: logoSrc });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [logoSrc]);

  // Straight to the USB printer when there is one; otherwise, or if it
  // fails, the browser's print dialog.
  async function print(order: Order, docs: PrintJob["docs"]) {
    if (!printer) return setPrinting({ order, docs });
    const width = columnsFor(ticket.paper);
    try {
      await printBytes(
        printer,
        concatBytes(
          docs.map((doc) =>
            doc === "comanda"
              ? comandaReceipt(order, businessName, width)
              : ticketReceipt(order, businessName, categories, ticket.footer, width, logo),
          ),
        ),
      );
    } catch (e) {
      setError(
        `${e instanceof PrinterError ? e.message : "No pudimos imprimir por USB."} Te abrimos el cuadro de impresión.`,
      );
      setPrinting({ order, docs });
    }
  }

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
    const served = Date.parse(r.headers.get("date") ?? "");
    if (served) {
      skew.current = served - Date.now();
      setNow(served);
    }
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
    if (d.categories) setCategories(d.categories);
    if (d.kitchen) setKitchen(d.kitchen);
    if (typeof d.cashOpen === "boolean") setCashOpen(d.cashOpen);
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

  // Rendered without timers on the server; they start once mounted.
  useEffect(() => {
    const tick = () => setNow(Date.now() + skew.current);
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // A bookmark with ?cocina=1 opens the tablet straight in kitchen mode.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get(KITCHEN_PARAM) === "1")
      setKitchenMode(true);
  }, []);

  function openKitchen(open: boolean) {
    setKitchenMode(open);
    const url = new URL(window.location.href);
    if (open) url.searchParams.set(KITCHEN_PARAM, "1");
    else url.searchParams.delete(KITCHEN_PARAM);
    window.history.replaceState(window.history.state, "", url);
    try {
      if (open) void document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    } catch {}
  }

  async function toggleSound() {
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
  }

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

  async function send(o: Order, change: Record<string, string | number>) {
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
      const docs =
        change.status === "accepted"
          ? autoPrintDocs(autoPrint, ticket.enabled)
          : [];
      if (docs.length) void print(d.order, docs);
      if (d.order.management) setNotice(saleNotice(d.order.management).join(" · "));
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos atender el pedido.",
      );
    } finally {
      setBusy("");
    }
  }

  async function created(order: CreatedOrder) {
    seen.current.add(order.id);
    setCreating(false);
    setFilter((f) => (f === "done" ? "active" : f));
    setError("");
    setNotice(
      [
        `Pedido ${orderNumber(order)} cargado y en preparación.`,
        ...(order.management ? saleNotice(order.management) : []),
      ].join(" · "),
    );
    const docs = autoPrintDocs(autoPrint, ticket.enabled);
    if (docs.length) void print(order, docs);
    await refresh().catch(() => setOffline(true));
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

  // Un solo aviso por WhatsApp, el que corresponde a la etapa del pedido.
  function whatsappAction(o: Order) {
    if (!o.customerPhone || o.status !== "accepted" || o.stage === "delivered")
      return null;
    const hi = `Hola ${o.customerName}, `;
    const n = `${orderNumber(o)} de ${businessName}`;
    const track = o.trackingToken ? ` Podés seguirlo acá: ${trackingLink(o)}` : "";
    let label: string;
    let text: string;
    if (o.stage === "ready" && o.fulfillment !== "delivery") {
      label = "Avisar por WhatsApp que está listo";
      text = `${hi}tu pedido ${n} ya está listo para retirar. ¡Te esperamos!`;
    } else if (o.stage === "on_the_way") {
      label = "Avisar por WhatsApp que va en camino";
      text = `${hi}tu pedido ${n} ya salió y va en camino.${track}`;
    } else if (o.trackingToken) {
      label = "Mandar seguimiento por WhatsApp";
      text = `${hi}podés seguir tu pedido ${n} acá: ${trackingLink(o)}`;
    } else {
      return null;
    }
    return {
      label,
      href: `https://wa.me/${o.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`,
    };
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
            className="primary-button compact-button"
            aria-expanded={creating}
            onClick={() => setCreating((open) => !open)}
          >
            Nuevo pedido
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => openKitchen(true)}
          >
            Modo cocina
          </button>
          <button
            type="button"
            className="secondary-button"
            aria-expanded={timeSettings}
            onClick={() => setTimeSettings((open) => !open)}
          >
            Tiempos
          </button>
          <button
            type="button"
            className="secondary-button"
            aria-expanded={printSettings}
            onClick={() => setPrintSettings((open) => !open)}
          >
            Impresión
          </button>
          <button
            type="button"
            className="secondary-button"
            aria-pressed={sound === "on"}
            onClick={() => void toggleSound()}
          >
            {sound === "on"
              ? "Sonido activado"
              : sound === "blocked"
                ? "Tocá para activar el sonido"
                : "Activar sonido"}
          </button>
        </div>
      </div>
      {creating ? (
        <ManualOrder
          businessId={businessId}
          onCreated={(order) => void created(order)}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {timeSettings ? (
        <KitchenSettings
          businessId={businessId}
          config={kitchen}
          onSaved={setKitchen}
          onClose={() => setTimeSettings(false)}
        />
      ) : null}
      {printSettings ? (
        <PrintSettings
          businessId={businessId}
          ticket={ticket}
          onSaved={setTicket}
          autoPrint={autoPrint}
          onAutoPrint={(choice) => {
            setAutoPrint(choice);
            try {
              localStorage.setItem(AUTO_PRINT_KEY, choice);
            } catch {}
          }}
          onClose={() => setPrintSettings(false)}
          usbSupported={usbSupported}
          printer={printer ? printerName(printer) : null}
          onConnect={async () => {
            const picked = await pickPrinter();
            if (picked) setPrinter(picked);
            return picked;
          }}
          onForget={async () => {
            await printer?.forget?.();
            setPrinter(null);
          }}
          onTest={async (picked) => {
            const target = picked ?? printer;
            if (!target) return;
            await printBytes(target, testPage(businessName, columnsFor(ticket.paper)));
          }}
        />
      ) : null}
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
      {!orders.length && creating ? null : !orders.length ? (
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
            const timing = now === null ? null : orderTiming(o, kitchen, now);
            return (
              <article
                className={
                  fresh.has(o.id) ? "order-ticket is-new" : "order-ticket"
                }
                data-light={timing?.light}
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
                {timing ? (
                  <p className="order-timer" data-light={timing.light}>
                    <strong>{timingLabel(timing)}</strong>
                    <span>
                      {timing.elapsed} min en cocina
                      {timing.assumed ? ` · contando ${kitchen.defaultMinutes} min` : ""}
                    </span>
                  </p>
                ) : o.status === "pending_confirmation" && now !== null ? (
                  <p className="order-timer">
                    <strong>Esperando hace {minutesSince(o.createdAt, now)} min</strong>
                  </p>
                ) : null}
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
                  {[o.customerPhone, orderOrigin(o)].filter(Boolean).join(" · ")}
                </p>
                {o.address ? (
                  <p>
                    {o.zoneName ?? "Envío a confirmar"} · {o.address}
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
                <ChargeStatus
                  order={o}
                  canCharge={
                    now !== null &&
                    !!o.acceptedAt &&
                    now - Date.parse(o.acceptedAt) < CHARGE_WINDOW_MS
                  }
                  onCharge={() => setCharging(o)}
                />
                {o.rating ? <p className="field-hint standalone-hint">Calificación del cliente: {o.rating}/5 ★</p> : null}
                {o.status === "pending_confirmation" ? <label className="ticket-preparation">Tiempo estimado de preparación
                  <select disabled={busy === o.id} value={preparation[o.id] ?? ""} onChange={e => setPreparation(current => ({ ...current, [o.id]: e.target.value }))}>
                    <option value="">Sin estimación</option>
                    {[10, 15, 20, 30, 45, 60, 90].map(n => <option value={n} key={n}>{n} minutos</option>)}
                  </select>
                </label> : null}
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
                      onClick={() => send(o, { status: "accepted", ...(preparation[o.id] ? { preparationMinutes: Number(preparation[o.id]) } : {}) })}
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
                {whatsappAction(o) ? (
                  <a
                    className="text-button ticket-whatsapp"
                    href={whatsappAction(o)!.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {whatsappAction(o)!.label} ↗
                  </a>
                ) : null}
                {o.status !== "rejected" ? (
                  <details className="ticket-more">
                    <summary className="text-button">Más opciones</summary>
                    <div className="ticket-links">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void print(o, ["comanda"])}
                      >
                        Imprimir comanda
                      </button>
                      {ticket.enabled ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => void print(o, ["ticket"])}
                        >
                          Imprimir ticket
                        </button>
                      ) : null}
                      {o.trackingToken && o.status === "accepted" ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => copyLink(o)}
                        >
                          {copied === o.id
                            ? "Link copiado ✓"
                            : "Copiar link de seguimiento"}
                        </button>
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
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
      {charging ? (
        <ChargeDialog
          businessId={businessId}
          order={{ ...charging, paidCents: charging.paidCents ?? 0 }}
          cashOpen={cashOpen}
          onClose={() => setCharging(null)}
          onCharged={(message) => {
            setCharging(null);
            setError("");
            setNotice(message);
            void refresh().catch(() => setOffline(true));
          }}
        />
      ) : null}
      {kitchenMode && now !== null ? (
        <KitchenMode
          orders={orders}
          config={kitchen}
          now={now}
          busy={busy}
          clockLabel={syncedAt ? `En vivo · ${clock.format(syncedAt)}` : "En vivo"}
          offline={offline}
          error={error}
          sound={sound}
          onSound={() => void toggleSound()}
          onReady={(o) => void send(o, { stage: "ready" })}
          onExit={() => openKitchen(false)}
        />
      ) : null}
      {printing
        ? createPortal(
            <div className="print-sheet" data-paper={ticket.paper}>
              {printing.docs.map((doc) =>
                doc === "comanda" ? (
                  <Comanda
                    key={doc}
                    order={printing.order}
                    businessName={businessName}
                  />
                ) : (
                  <CustomerTicket
                    key={doc}
                    order={printing.order}
                    businessName={businessName}
                    categories={categories}
                    footer={ticket.footer}
                    logo={
                      logo
                        ? {
                            src: logo.src,
                            // Same share of the paper as on the USB printer.
                            width: `${(logo.width / (ticket.paper === "58" ? 384 : 576)) * 100}%`,
                          }
                        : null
                    }
                  />
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

// What the register says about the order: charged, partly charged or not yet.
function ChargeStatus({
  order: o,
  canCharge,
  onCharge,
}: {
  order: Order;
  canCharge: boolean;
  onCharge: () => void;
}) {
  const paid = o.paidCents ?? 0;
  const left = o.totalCents - paid;
  if (o.status === "pending_confirmation" || o.status === "rejected")
    return (
      <p className="field-hint standalone-hint">
        Dice que paga con {promisedPayment(o).toLowerCase()}
      </p>
    );
  if (o.status !== "accepted")
    return paid ? (
      <p className="charge-status" data-state="warn">
        Tenía cobrado {formatMoney(paid)}. Si lo devolviste, anulá el cobro en Caja.
      </p>
    ) : null;
  if (left <= 0)
    return (
      <p className="charge-status" data-state="paid">
        <strong>Cobrado</strong>
      </p>
    );
  return (
    <div className="charge-row">
      <p className="charge-status" data-state={paid ? "partial" : "unpaid"}>
        <strong>{paid ? `Falta ${formatMoney(left)}` : "Sin cobrar"}</strong>
        <span>
          {paid
            ? `Cobrado ${formatMoney(paid)}`
            : `Dice que paga con ${promisedPayment(o).toLowerCase()}`}
        </span>
      </p>
      {canCharge ? (
        <button type="button" className="secondary-button compact-button" onClick={onCharge}>
          Cobrar
        </button>
      ) : null}
    </div>
  );
}

// Kitchen ticket, sized for 58 or 80 mm thermal printers but readable on A4.
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
      <p>
        {dateTime.format(new Date(o.createdAt))}
        {o.channel && o.channel !== "store" ? ` · ${channelLabels[o.channel].toUpperCase()}` : ""}
      </p>
      <p className="comanda-customer">
        {[o.customerName, o.customerPhone].filter(Boolean).join(" · ")}
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
