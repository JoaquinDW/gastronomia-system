"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Navegación del panel de un local: sidebar agrupada en desktop y barra
// inferior con cuatro accesos más "Más" en celular. La arma el layout del
// negocio, así que cada página solo pone su contenido.

type Key =
  | "home"
  | "orders"
  | "cash"
  | "menu"
  | "store"
  | "resultados"
  | "ventas"
  | "gastos"
  | "compras"
  | "inventario"
  | "recetas"
  | "proveedores";

type Item = { key: Key; label: string; path: string; ownerOnly?: boolean };

const groups: { title: string; items: Item[] }[] = [
  {
    title: "Operación",
    items: [
      { key: "orders", label: "Pedidos", path: "/pedidos" },
      { key: "cash", label: "Caja", path: "/caja" },
      { key: "menu", label: "Carta", path: "/carta" },
      { key: "store", label: "Tienda", path: "/tienda" },
    ],
  },
  {
    title: "Números",
    items: [
      {
        key: "resultados",
        label: "Resultados",
        path: "/gestion",
        ownerOnly: true,
      },
      { key: "ventas", label: "Ventas", path: "/gestion/ventas" },
      {
        key: "gastos",
        label: "Gastos",
        path: "/gestion/gastos",
        ownerOnly: true,
      },
      { key: "compras", label: "Compras", path: "/gestion/compras" },
    ],
  },
  {
    title: "Cocina",
    items: [
      { key: "inventario", label: "Inventario", path: "/gestion/inventario" },
      { key: "recetas", label: "Recetas", path: "/gestion/recetas" },
      {
        key: "proveedores",
        label: "Proveedores",
        path: "/gestion/proveedores",
      },
    ],
  },
];

const home: Item = { key: "home", label: "Resumen", path: "" };
const shortcuts: Key[] = ["home", "orders", "cash", "menu"];

// Trazo lineal de 2.5 px, sin emoji (ver docs/DESIGN-SYSTEM.md).
const icons: Record<Key | "more" | "out", string> = {
  home: "M4 11 12 4l8 7M6 9.5V20h12V9.5",
  orders: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  cash: "M3 10h18v10H3zM6 10V6h12v4M12 13.5v3M9 15h.01M15 15h.01",
  menu: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM9 9h6M9 13h4",
  store:
    "M4 9 5.5 4h13L20 9M4 9h16v2a3 3 0 0 1-6 0 3 3 0 0 1-4 0 3 3 0 0 1-6 0zM5 13v7h14v-7",
  resultados: "M4 20h16M7 16v-4M12 16V7M17 16v-7",
  ventas: "M4 17 10 11l4 4 6-7M15 8h5v5",
  gastos: "M3 7h18v12H3zM3 11h18M7 15h3",
  compras: "M3 4h3l2.5 11h10L21 8H7.5M10 20h.01M17 20h.01",
  inventario: "M4 8 12 4l8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9",
  recetas: "M6 11a4 4 0 1 1 3-6.7A4 4 0 1 1 18 11v3H6zM6 14v6h12v-6",
  proveedores:
    "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19.5a1.5 1.5 0 1 0 0-.01M17 19.5a1.5 1.5 0 1 0 0-.01",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  out: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
};

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 3.5 : 2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icons[name]} />
    </svg>
  );
}

function activeKey(pathname: string, base: string, id: string): Key {
  // Con dominios la URL visible es /<slug>/...; sin ellos, /panel/negocios/<id>/...
  const prefix = [base, `/panel/negocios/${id}`].find(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const [first, second] = pathname
    .slice(prefix?.length ?? 0)
    .split("/")
    .filter(Boolean);
  if (first === "pedidos") return "orders";
  if (first === "caja") return "cash";
  if (first === "carta") return "menu";
  if (first === "tienda") return "store";
  if (first === "gestion") {
    const all = groups.flatMap((g) => g.items).map((i) => i.key);
    return second && all.includes(second as Key)
      ? (second as Key)
      : "resultados";
  }
  return "home";
}

export function BusinessNav({
  id,
  base,
  name,
  role,
  storeHref,
  isPublished,
  businessesHref,
}: {
  id: string;
  base: string;
  name: string;
  role: string;
  storeHref: string;
  isPublished: boolean;
  businessesHref: string;
}) {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const editor = role === "owner" || role === "manager";
  const owner = role === "owner";
  let active = activeKey(pathname, base, id);
  // Sin Resultados, Gestión abre en Inventario.
  if (active === "resultados" && !owner) active = "inventario";
  const visible = editor
    ? groups.map((g) => ({
        ...g,
        items: g.items.filter((i) => owner || !i.ownerOnly),
      }))
    : [];
  const all = [home, ...visible.flatMap((g) => g.items)];
  const bar = shortcuts
    .map((k) => all.find((i) => i.key === k))
    .filter((i): i is Item => Boolean(i));

  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: KeyboardEvent) =>
      e.key === "Escape" && setMoreOpen(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [moreOpen]);

  const link = (item: Item) => (
    <Link
      key={item.key}
      href={`${base}${item.path}`}
      aria-current={active === item.key ? "page" : undefined}
    >
      <Icon name={item.key} />
      <span>{item.label}</span>
    </Link>
  );
  const store = (
    <Link
      className={isPublished ? "biz-store-link" : "biz-store-link draft"}
      href={storeHref}
      target="_blank"
    >
      <Icon name="out" />
      <span>
        {isPublished ? "Ver mi tienda pública" : "Vista previa de la tienda"}
        <small>{isPublished ? "Online" : "Sin publicar"}</small>
      </span>
    </Link>
  );
  const sections = (
    <>
      <div className="biz-nav-group">{link(home)}</div>
      {visible.map((g) => (
        <div className="biz-nav-group" key={g.title}>
          <p className="biz-nav-title">{g.title}</p>
          {g.items.map(link)}
        </div>
      ))}
    </>
  );

  return (
    <>
      <aside className="biz-sidebar" aria-label="Secciones del negocio">
        <div className="biz-identity">
          <span className="biz-initial" aria-hidden="true">
            {name.trim().charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{name}</strong>
            <Link href={businessesHref}>← Mis negocios</Link>
          </div>
        </div>
        <nav className="biz-nav" aria-label="Gestión del negocio">
          {sections}
        </nav>
        {store}
      </aside>

      <nav className="biz-tabbar" aria-label="Accesos rápidos">
        {bar.map(link)}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="biz-more"
          aria-current={
            !moreOpen && !bar.some((i) => i.key === active) ? "page" : undefined
          }
          onClick={() => setMoreOpen((o) => !o)}
        >
          <Icon name="more" />
          <span>Más</span>
        </button>
      </nav>
      {moreOpen ? (
        <div className="biz-more-backdrop" onClick={() => setMoreOpen(false)}>
          <div
            id="biz-more"
            className="biz-more"
            role="dialog"
            aria-modal="true"
            aria-label="Todas las secciones"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="biz-more-head">
              <strong>{name}</strong>
              <button
                type="button"
                className="text-button"
                onClick={() => setMoreOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <nav className="biz-nav" aria-label="Todas las secciones">
              {sections}
            </nav>
            {store}
            <Link className="biz-more-back" href={businessesHref}>
              ← Mis negocios
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
