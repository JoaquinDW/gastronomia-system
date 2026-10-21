"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { appUrl, storeUrl } from "@/lib/hosts";
import {
  createSandbox,
  DEMO_API,
  DEMO_ID,
  type DemoState,
  type Sandbox,
} from "@/lib/demo/sandbox";
import { CashRegister } from "./cash-register";
import { MenuManager } from "./menu-manager";
import { OrderInbox } from "./order-inbox";
import { StoreConfigurator } from "./store-configurator";

// La demo del panel: las mismas pantallas, con un local de ejemplo que vive
// en memoria. El fetch del navegador se desvía al sandbox solo para
// /api/businesses/demo/...; Gestión sigue yendo al servidor, de solo lectura.

const DemoContext = createContext<Sandbox | null>(null);
let active: Sandbox | null = null;
let realFetch: typeof fetch | null = null;

function requestBody(body: BodyInit | null | undefined) {
  if (typeof body !== "string") return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function install(sandbox: Sandbox) {
  active = sandbox;
  if (realFetch) return;
  const original = window.fetch.bind(window);
  realFetch = original;
  window.fetch = async (input, init) => {
    const href =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(href, window.location.href);
    const local =
      url.origin === window.location.origin &&
      url.pathname.startsWith(`${DEMO_API}/`) &&
      !url.pathname.startsWith(`${DEMO_API}/management`);
    if (!active || !local) return original(input, init);
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    // Una pausa corta, como la de la red, para que se vean los estados.
    await new Promise((done) => setTimeout(done, 180));
    const reply = active.handle(
      method,
      url.pathname.slice(DEMO_API.length),
      requestBody(init?.body),
    );
    return Response.json(reply.body, { status: reply.status });
  };
}

function uninstall() {
  if (realFetch) window.fetch = realFetch;
  realFetch = null;
  active = null;
}

export function DemoProvider({
  initial,
  children,
}: {
  initial: DemoState;
  children: React.ReactNode;
}) {
  const [sandbox] = useState(() => createSandbox(initial));
  // Antes que los efectos de las pantallas, que piden datos al montarse.
  if (typeof window !== "undefined") install(sandbox);
  useEffect(() => {
    install(sandbox);
    return uninstall;
  }, [sandbox]);
  return (
    <DemoContext.Provider value={sandbox}>{children}</DemoContext.Provider>
  );
}

function useSandbox() {
  const sandbox = useContext(DemoContext);
  if (!sandbox) throw new Error("La demo necesita DemoProvider.");
  return sandbox;
}

export function DemoBanner() {
  return (
    <aside className="demo-banner" aria-label="Estás en la demo">
      <span className="demo-banner-tag">DEMO</span>
      <p>
        <span className="demo-banner-long">
          Estás probando el panel de <strong>Brasa Club</strong>, un local de
          ejemplo. Tocá lo que quieras: nada se guarda y al recargar vuelve a
          empezar.
        </span>
        <span className="demo-banner-short">
          Panel de <strong>Brasa Club</strong>, un local de ejemplo. Nada se
          guarda.
        </span>
      </p>
      <Link
        className="primary-button compact-button"
        href={appUrl("/registro")}
      >
        Crear mi tienda <span aria-hidden="true">→</span>
      </Link>
    </aside>
  );
}

export function DemoOrders() {
  const sandbox = useSandbox();
  const [initial] = useState(() => ({
    orders: sandbox.listOrders(),
    cashOpen: Boolean(sandbox.cashState().session),
  }));
  const { state } = sandbox;
  return (
    <OrderInbox
      businessId={DEMO_ID}
      businessName={state.business.name}
      storeBase={storeUrl(state.business.slug)}
      initialOrders={initial.orders}
      initialTicket={state.ticket}
      initialCategories={state.categories}
      initialKitchen={state.kitchen}
      initialCashOpen={initial.cashOpen}
    />
  );
}

export function DemoCash() {
  const sandbox = useSandbox();
  const [initial] = useState(() => sandbox.cashState());
  return (
    <CashRegister
      businessId={DEMO_ID}
      timezone={sandbox.state.timezone}
      initialState={initial}
    />
  );
}

export function DemoMenu() {
  const sandbox = useSandbox();
  const [initial] = useState(() => sandbox.state.products);
  return (
    <MenuManager
      businessId={DEMO_ID}
      initialProducts={initial}
      aiAvailable={false}
    />
  );
}

export function DemoStore() {
  const sandbox = useSandbox();
  const [initial] = useState(() => ({
    settings: sandbox.state.settings,
    count: sandbox.state.products.filter((p) => p.isAvailable).length,
  }));
  return (
    <StoreConfigurator
      businessId={DEMO_ID}
      slug={sandbox.state.business.slug}
      initialSettings={initial.settings}
      productCount={initial.count}
      suggestedHours={[]}
    />
  );
}
