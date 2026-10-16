"use client";
import { useEffect, useRef, useState } from "react";
import {
  dayNames,
  formatMoney,
  isStoreOpen,
  type Product,
  type StoreSettings,
} from "@/lib/menu";
type CartLine = {
  key: string;
  productId: string;
  variantId: string;
  addOnIds: string[];
  quantity: number;
  quotedUnitCents: number;
  label: string;
};
type Business = {
  name: string;
  slug: string;
  whatsapp: string;
  city: string;
  address: string | null;
  timezone: string;
};
function ProductChoice({
  product,
  onAdd,
  disabled,
}: {
  product: Product;
  onAdd: (p: Product, v: string, a: string[]) => void;
  disabled: boolean;
}) {
  const [variant, setVariant] = useState(product.variants[0].id);
  const [extras, setExtras] = useState<string[]>([]);
  const [selected, setSelected] = useState(false);
  const v =
    product.variants.find((v) => v.id === variant) ?? product.variants[0];
  const total =
    v.priceCents +
    product.addOns
      .filter((a) => extras.includes(a.id))
      .reduce((n, a) => n + a.priceCents, 0);
  return (
    <article className="shop-product">
      {product.imageUrl ? (
        <img
          className="shop-product-image"
          src={product.imageUrl}
          alt=""
          loading="lazy"
          width={120}
          height={120}
          referrerPolicy="no-referrer"
        />
      ) : null}
      <div className="shop-product-content">
        <div className="product-heading">
          <h3>{product.name}</h3>
          {product.kind === "combo" ? (
            <span className="small-badge">Promo</span>
          ) : null}
        </div>
        {product.description ? <p>{product.description}</p> : null}
        {product.variants.length > 1 ? (
          <label className="shop-variant-label">
            Presentación
            <select
              value={variant}
              onChange={(e) => {
                setVariant(e.target.value);
                setSelected(false);
              }}
            >
              {product.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {formatMoney(v.priceCents)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {product.addOns.length ? (
          <details className="shop-extras">
            <summary>Personalizar con adicionales</summary>
            {product.addOns.map((a) => (
              <label className="checkbox-label" key={a.id}>
                <input
                  type="checkbox"
                  checked={extras.includes(a.id)}
                  onChange={(e) => {
                    setExtras(
                      e.target.checked
                        ? [...extras, a.id]
                        : extras.filter((id) => id !== a.id),
                    );
                    setSelected(false);
                  }}
                />
                {a.name}
                <span>+ {formatMoney(a.priceCents)}</span>
              </label>
            ))}
          </details>
        ) : null}
        <div className="shop-product-footer">
          <strong>{formatMoney(total)}</strong>
          <button
            className="add-to-cart"
            disabled={disabled}
            onClick={() => {
              onAdd(product, v.id, extras);
              setSelected(true);
            }}
            aria-label={`Agregar ${product.name}`}
          >
            {selected ? "Agregar otra vez +" : "Agregar +"}
          </button>
        </div>
      </div>
    </article>
  );
}
export function Storefront({
  business,
  products,
  settings,
  initialOpen,
  preview,
}: {
  business: Business;
  products: Product[];
  settings: StoreSettings;
  initialOpen: boolean;
  preview: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">(
    settings.pickupEnabled ? "pickup" : "delivery",
  );
  const [zoneId, setZoneId] = useState(settings.deliveryZones[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    number: number;
    totalCents: number;
    whatsappUrl: string;
  } | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const requestKey = useRef<string | null>(null);
  const cartStorage = `gastronomia-cart-v1:${business.slug}`;
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(cartStorage) ?? "[]");
      if (Array.isArray(raw)) {
        const valid: CartLine[] = [];
        for (const line of raw.slice(0, 30)) {
          const p = products.find((p) => p.id === line.productId);
          const v = p?.variants.find((v) => v.id === line.variantId);
          if (
            p &&
            v &&
            Number.isInteger(line.quantity) &&
            line.quantity > 0 &&
            line.quantity <= 20 &&
            Array.isArray(line.addOnIds) &&
            line.addOnIds.every(
              (id: unknown) =>
                typeof id === "string" && p.addOns.some((a) => a.id === id),
            )
          ) {
            const extras = p.addOns.filter((a) => line.addOnIds.includes(a.id));
            valid.push({
              key: JSON.stringify([p.id, v.id, extras.map((a) => a.id).sort()]),
              productId: p.id,
              variantId: v.id,
              addOnIds: extras.map((a) => a.id),
              quantity: line.quantity,
              quotedUnitCents:
                v.priceCents + extras.reduce((n, a) => n + a.priceCents, 0),
              label: `${p.name}${v.name !== "Única" ? ` · ${v.name}` : ""}${extras.length ? ` + ${extras.map((a) => a.name).join(", ")}` : ""}`,
            });
          }
        }
        setCart(valid);
      }
    } catch {}
    setReady(true);
    const tick = () =>
      setOpen(isStoreOpen(settings.hours, new Date(), business.timezone));
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [cartStorage, products, settings.hours, business.timezone]);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(cartStorage, JSON.stringify(cart));
      } catch {}
    }
  }, [cart, ready, cartStorage]);
  function add(p: Product, variantId: string, addOnIds: string[]) {
    const ids = [...addOnIds].sort();
    const key = JSON.stringify([p.id, variantId, ids]);
    const v = p.variants.find((v) => v.id === variantId)!;
    const extras = p.addOns.filter((a) => ids.includes(a.id));
    setCart((current) => {
      const existing = current.find((l) => l.key === key);
      if (existing)
        return current.map((l) =>
          l.key === key ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l,
        );
      return [
        ...current,
        {
          key,
          productId: p.id,
          variantId,
          addOnIds: ids,
          quantity: 1,
          quotedUnitCents:
            v.priceCents + extras.reduce((n, a) => n + a.priceCents, 0),
          label: `${p.name}${v.name !== "Única" ? ` · ${v.name}` : ""}${extras.length ? ` + ${extras.map((a) => a.name).join(", ")}` : ""}`,
        },
      ];
    });
    requestKey.current = null;
    setResult(null);
  }
  const subtotal = cart.reduce((n, l) => n + l.quotedUnitCents * l.quantity, 0);
  const zone = settings.deliveryZones.find((z) => z.id === zoneId);
  const fee = fulfillment === "delivery" ? (zone?.feeCents ?? 0) : 0;
  const total = subtotal + fee;
  const categories = [...new Set(products.map((p) => p.category))];
  const filtered = products.filter((p) =>
    `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    requestKey.current ??= crypto.randomUUID();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/storefront/${business.slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: requestKey.current,
          customerName: form.get("customerName"),
          customerPhone: form.get("customerPhone"),
          fulfillment,
          address:
            fulfillment === "delivery" ? String(form.get("address") ?? "") : "",
          zoneId: fulfillment === "delivery" ? zoneId : null,
          paymentMethod: form.get("paymentMethod"),
          note: form.get("note"),
          items: cart.map(
            ({
              productId,
              variantId,
              addOnIds,
              quantity,
              quotedUnitCents,
            }) => ({
              productId,
              variantId,
              addOnIds,
              quantity,
              quotedUnitCents,
            }),
          ),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status < 500) requestKey.current = null;
        throw new Error(d.error);
      }
      setResult(d);
      setCart([]);
      setShowCheckout(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos guardar el pedido. Volvé a intentar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shop-shell">
      {preview ? (
        <div className="preview-banner">
          Vista previa privada · Los pedidos están deshabilitados en esta vista.
        </div>
      ) : null}
      <header className="shop-header">
        <a href="#menu" className="shop-brand">
          <span aria-hidden="true">{business.name.slice(0, 1)}</span>
          {business.name}
        </a>
        <span className={`store-status ${open ? "active" : ""}`}>
          <span aria-hidden="true" />
          {open ? "Abierto ahora" : "Cerrado ahora"}
        </span>
      </header>
      <main>
        <section className="shop-hero">
          <div>
            <p className="eyebrow">HECHO ACÁ, PEDIDO DIRECTO</p>
            <h1>
              {business.name}
              <span>¿Qué te tentó hoy?</span>
            </h1>
            {settings.description ? <p>{settings.description}</p> : null}
            <div className="shop-meta">
              <span>{business.city}</span>
              {settings.pickupEnabled ? <span>Retiro en el local</span> : null}
              {settings.deliveryEnabled ? <span>Delivery propio</span> : null}
            </div>
          </div>
          <details className="shop-hours">
            <summary>Horarios y entregas</summary>
            <div>
              {settings.hours.length ? (
                settings.hours.map((h, i) => (
                  <p key={i}>
                    {dayNames[h.day]}{" "}
                    <strong>
                      {h.opens} a {h.closes}
                      {h.closes <= h.opens ? " (+1 día)" : ""}
                    </strong>
                  </p>
                ))
              ) : (
                <p>Horarios pendientes de configurar.</p>
              )}
              {settings.pickupEnabled && business.address ? (
                <p>Retiro: {business.address}</p>
              ) : null}
              {settings.pickupInstructions ? (
                <p>{settings.pickupInstructions}</p>
              ) : null}
              {settings.deliveryEnabled
                ? settings.deliveryZones.map((z) => (
                    <p key={z.id}>
                      {z.name}: {formatMoney(z.feeCents)}
                      {z.minimumCents
                        ? ` · mínimo ${formatMoney(z.minimumCents)}`
                        : ""}
                    </p>
                  ))
                : null}
            </div>
          </details>
        </section>
        {settings.menuNote ? (
          <div className="shop-menu-note">
            <span aria-hidden="true">✳</span>
            <p>{settings.menuNote}</p>
          </div>
        ) : null}
        {!open && !preview ? (
          <p className="closed-notice">
            Podés recorrer la carta. Los pedidos se habilitan dentro del horario
            de atención.
          </p>
        ) : null}
        <div className="shop-layout">
          <div id="menu" className="shop-menu">
            <nav
              className="shop-category-nav"
              aria-label="Categorías de la carta"
            >
              {categories.map((c, i) => (
                <a key={c} href={`#categoria-${i}`}>
                  {c}
                </a>
              ))}
            </nav>
            <label className="catalog-search">
              <span>Buscar en la carta</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="¿Qué tenés ganas de comer?"
              />
            </label>
            {categories.map((c, i) => {
              const list = filtered.filter((p) => p.category === c);
              return list.length ? (
                <section
                  key={c}
                  id={`categoria-${i}`}
                  className="shop-category"
                >
                  <div className="shop-category-heading">
                    <h2>{c}</h2>
                    <span>{list.length.toString().padStart(2, "0")}</span>
                  </div>
                  {list.map((p) => (
                    <ProductChoice
                      key={p.id}
                      product={p}
                      onAdd={add}
                      disabled={!open || preview || busy}
                    />
                  ))}
                </section>
              ) : null;
            })}
            {!filtered.length ? (
              <p className="empty-search">
                No hay productos disponibles con esa búsqueda.
              </p>
            ) : null}
          </div>
          <aside id="pedido" className="shop-cart" aria-labelledby="cart-title">
            <p className="eyebrow">DE TU CARTA A WHATSAPP</p>
            <h2 id="cart-title">Tu pedido.</h2>
            {result ? (
              <div className="checkout-success" role="status">
                <span aria-hidden="true">✓</span>
                <h3>Pedido #{result.number} guardado</h3>
                <p>
                  Total: {formatMoney(result.totalCents)}. Falta que el local lo
                  confirme.
                </p>
                <a
                  className="whatsapp-button"
                  href={result.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Continuar por WhatsApp ↗
                </a>
                <p className="form-footnote">
                  Enviá el resumen en el chat y esperá la confirmación del
                  negocio. Abrir WhatsApp no acredita el pago.
                </p>
              </div>
            ) : null}
            {cart.length ? (
              <>
                <ul className="cart-lines">
                  {cart.map((l) => (
                    <li key={l.key}>
                      <div>
                        <strong>{l.label}</strong>
                        <span>
                          {formatMoney(l.quotedUnitCents * l.quantity)}
                        </span>
                      </div>
                      <div className="quantity-control">
                        <button
                          disabled={busy}
                          aria-label={`Quitar una unidad de ${l.label}`}
                          onClick={() => {
                            setCart(
                              cart
                                .map((x) =>
                                  x.key === l.key
                                    ? { ...x, quantity: x.quantity - 1 }
                                    : x,
                                )
                                .filter((x) => x.quantity > 0),
                            );
                            requestKey.current = null;
                          }}
                        >
                          −
                        </button>
                        <span>{l.quantity}</span>
                        <button
                          disabled={busy || l.quantity >= 20}
                          aria-label={`Sumar una unidad de ${l.label}`}
                          onClick={() => {
                            setCart(
                              cart.map((x) =>
                                x.key === l.key
                                  ? { ...x, quantity: x.quantity + 1 }
                                  : x,
                              ),
                            );
                            requestKey.current = null;
                          }}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="cart-total">
                  <span>Productos</span>
                  <strong>{formatMoney(subtotal)}</strong>
                </div>
                {fulfillment === "delivery" ? (
                  <div className="cart-total">
                    <span>Envío</span>
                    <strong>{formatMoney(fee)}</strong>
                  </div>
                ) : null}
                <div className="cart-total final-total">
                  <span>Total</span>
                  <strong>{formatMoney(total)}</strong>
                </div>
                {!showCheckout ? (
                  <button
                    className="primary-button"
                    disabled={!open || preview || busy}
                    onClick={() => setShowCheckout(true)}
                  >
                    Continuar con mi pedido →
                  </button>
                ) : null}
              </>
            ) : !result ? (
              <p className="empty-cart">
                Elegí algo rico de la carta.
                <br />
                Acá vas a ver tu pedido.
              </p>
            ) : null}
            {showCheckout && cart.length ? (
              <form className="app-form checkout-form" onSubmit={submit}>
                <fieldset disabled={busy}>
                  <label>
                    Tu nombre
                    <input
                      name="customerName"
                      autoComplete="name"
                      required
                      minLength={2}
                      maxLength={100}
                    />
                  </label>
                  <label>
                    Tu WhatsApp
                    <input
                      name="customerPhone"
                      type="tel"
                      autoComplete="tel"
                      required
                      maxLength={30}
                      placeholder="+54 9 351 123 4567"
                    />
                  </label>
                  <label>
                    ¿Cómo lo recibís?
                    <select
                      value={fulfillment}
                      onChange={(e) => {
                        setFulfillment(e.target.value as "pickup" | "delivery");
                        requestKey.current = null;
                      }}
                    >
                      {settings.pickupEnabled ? (
                        <option value="pickup">Retiro en el local</option>
                      ) : null}
                      {settings.deliveryEnabled ? (
                        <option value="delivery">Delivery</option>
                      ) : null}
                    </select>
                  </label>
                  {fulfillment === "delivery" ? (
                    <>
                      <label>
                        Zona de entrega
                        <select
                          value={zoneId}
                          onChange={(e) => {
                            setZoneId(e.target.value);
                            requestKey.current = null;
                          }}
                        >
                          {settings.deliveryZones.map((z) => (
                            <option value={z.id} key={z.id}>
                              {z.name} · {formatMoney(z.feeCents)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Dirección y referencias
                        <input
                          name="address"
                          autoComplete="street-address"
                          required
                          minLength={5}
                          maxLength={250}
                        />
                      </label>
                      {zone?.minimumCents ? (
                        <p className="field-hint standalone-hint">
                          Mínimo para esta zona:{" "}
                          {formatMoney(zone.minimumCents)}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                  <label>
                    Medio de pago
                    <select name="paymentMethod">
                      {settings.paymentMethods.includes("cash") ? (
                        <option value="cash">Efectivo</option>
                      ) : null}
                      {settings.paymentMethods.includes("transfer") ? (
                        <option value="transfer">
                          Transferencia a confirmar
                        </option>
                      ) : null}
                    </select>
                  </label>
                  {settings.paymentMethods.includes("transfer") &&
                  settings.transferAlias ? (
                    <p className="field-hint standalone-hint">
                      Alias para transferir:{" "}
                      <strong>{settings.transferAlias}</strong>. El local
                      verifica la acreditación.
                    </p>
                  ) : null}
                  <label>
                    Observaciones{" "}
                    <span className="optional-label">opcional</span>
                    <textarea
                      name="note"
                      rows={2}
                      maxLength={500}
                      placeholder="Detalles que el local deba tener en cuenta."
                    />
                  </label>
                </fieldset>
                <p className="form-footnote">
                  Guardamos tu pedido y después podés enviar el resumen por
                  WhatsApp. El local debe confirmarlo antes de prepararlo.
                </p>
                <button
                  className="primary-button"
                  disabled={busy || !open || preview}
                  type="submit"
                >
                  {busy ? "Guardando pedido…" : "Confirmar pedido"}
                </button>
              </form>
            ) : null}
            {error ? (
              <p role="alert" className="form-error">
                {error}
              </p>
            ) : null}
          </aside>
        </div>
      </main>
      {cart.length ? (
        <a href="#pedido" className="mobile-cart-link">
          Ver mi pedido · {formatMoney(total)} ↓
        </a>
      ) : null}
      <footer className="shop-footer">
        <span>{business.name} · Pedí directo a tu local</span>
        <span>Con tecnología de gastronomía</span>
      </footer>
    </div>
  );
}
