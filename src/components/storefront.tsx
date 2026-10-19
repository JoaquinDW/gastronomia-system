"use client";
import { useEffect, useRef, useState } from "react";
import { deliveryQuote, type Coordinates } from "@/lib/delivery";
import { LocationPicker } from "./location-picker";
import {
  dayNames,
  formatMoney,
  isStoreOpen,
  productImage,
  resolveChoices,
  type Product,
  type StoreSettings,
} from "@/lib/menu";
import { ChoiceGroup, choiceIdsOf } from "./choice-group";
type CartLine = {
  key: string;
  productId: string;
  variantId: string;
  addOnIds: string[];
  choiceIds: string[];
  quantity: number;
  quotedUnitCents: number;
  label: string;
  choices: string[];
};
/** A cart line for one unit, or null when the picks no longer fit the carta. */
function cartLine(
  p: Product,
  variantId: string,
  addOnIds: string[],
  choiceIds: string[],
  quantity: number,
): CartLine | null {
  const v = p.variants.find((v) => v.id === variantId);
  const extras = p.addOns.filter((a) => addOnIds.includes(a.id));
  const choices = resolveChoices(p, choiceIds);
  if (!v || extras.length !== addOnIds.length || !choices.ok) return null;
  const ids = extras.map((a) => a.id).sort();
  const picks = [...choiceIds].sort();
  return {
    key: JSON.stringify([p.id, v.id, ids, picks]),
    productId: p.id,
    variantId: v.id,
    addOnIds: ids,
    choiceIds: picks,
    quantity,
    quotedUnitCents:
      v.priceCents +
      extras.reduce((n, a) => n + a.priceCents, 0) +
      choices.value.cents,
    label: `${p.name}${v.name !== "Única" ? ` · ${v.name}` : ""}${extras.length ? ` + ${extras.map((a) => a.name).join(", ")}` : ""}`,
    choices: choices.value.labels,
  };
}
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
  onAdd: (p: Product, v: string, a: string[], c: string[]) => void;
  disabled: boolean;
}) {
  const [variant, setVariant] = useState(product.variants[0].id);
  const [extras, setExtras] = useState<string[]>([]);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [choicesOpen, setChoicesOpen] = useState(false);
  const [choiceError, setChoiceError] = useState("");
  const [selected, setSelected] = useState(false);
  const groups = product.optionGroups ?? [];
  const choiceIds = choiceIdsOf(groups, picks);
  const choices = resolveChoices(product, choiceIds);
  const zoom = useRef<HTMLDialogElement>(null);
  const image = product.imageUrl ? productImage(product.imageUrl) : null;
  const v =
    product.variants.find((v) => v.id === variant) ?? product.variants[0];
  const total =
    v.priceCents +
    product.addOns
      .filter((a) => extras.includes(a.id))
      .reduce((n, a) => n + a.priceCents, 0) +
    groups
      .flatMap((g) => g.options)
      .reduce((n, o) => n + o.priceCents * (picks[o.id] ?? 0), 0);
  return (
    <article className={`shop-product ${image ? "has-photo" : ""}`}>
      {image ? (
        <>
          <button
            type="button"
            className="shop-product-photo"
            onClick={() => zoom.current?.showModal()}
            aria-label={`Ver foto de ${product.name}`}
          >
            <img
              src={image.src}
              srcSet={image.srcSet}
              sizes="(max-width: 800px) calc(100vw - 48px), 400px"
              alt={product.name}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              style={{
                objectPosition: `${product.imageFocusX}% ${product.imageFocusY}%`,
              }}
            />
            {product.kind === "combo" ? (
              <span className="small-badge">Promo</span>
            ) : null}
          </button>
          <dialog
            ref={zoom}
            className="photo-zoom"
            aria-label={product.name}
            onClick={(e) => {
              if (e.target === e.currentTarget) zoom.current?.close();
            }}
          >
            <img
              src={image.large}
              alt={product.name}
              referrerPolicy="no-referrer"
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => zoom.current?.close()}
              aria-label="Cerrar foto"
            >
              ×
            </button>
          </dialog>
        </>
      ) : null}
      <div className="shop-product-content">
        <div className="product-heading">
          <h3>{product.name}</h3>
          {product.kind === "combo" && !image ? (
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
        {groups.length ? (
          <details
            className="shop-extras shop-choices"
            open={choicesOpen}
            onToggle={(e) => setChoicesOpen(e.currentTarget.open)}
          >
            <summary>
              {groups.some((g) => g.min)
                ? "Elegí tus opciones"
                : "Elegir opciones (opcional)"}
              {choices.ok && choiceIds.length ? " ✓" : ""}
            </summary>
            {groups.map((g) => (
              <ChoiceGroup
                key={g.id}
                group={g}
                picks={picks}
                inputName={`${product.id}-${g.id}`}
                onChange={(next) => {
                  setPicks(next);
                  setSelected(false);
                  setChoiceError("");
                }}
              />
            ))}
          </details>
        ) : null}
        {choiceError ? (
          <p className="shop-choice-error" role="alert">
            {choiceError}
          </p>
        ) : null}
        <div className="shop-product-footer">
          <strong>{formatMoney(total)}</strong>
          <button
            className="add-to-cart"
            disabled={disabled}
            onClick={() => {
              if (!choices.ok) {
                setChoiceError(choices.message);
                setChoicesOpen(true);
                return;
              }
              onAdd(product, v.id, extras, choiceIds);
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
  const [deliveryLocation, setDeliveryLocation] = useState<Coordinates | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    number: number;
    totalCents: number;
    whatsappUrl: string;
    trackingUrl: string;
  } | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const requestKey = useRef<string | null>(null);
  const cover = settings.coverImageUrl
    ? productImage(settings.coverImageUrl)
    : null;
  const cartStorage = `gastronomia-cart-v1:${business.slug}`;
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(cartStorage) ?? "[]");
      if (Array.isArray(raw)) {
        const valid: CartLine[] = [];
        for (const line of raw.slice(0, 30)) {
          const p = products.find((p) => p.id === line.productId);
          const choiceIds = line.choiceIds ?? [];
          if (
            !p ||
            !Number.isInteger(line.quantity) ||
            line.quantity < 1 ||
            line.quantity > 20 ||
            !Array.isArray(line.addOnIds) ||
            !Array.isArray(choiceIds) ||
            [...line.addOnIds, ...choiceIds].some(
              (id: unknown) => typeof id !== "string",
            )
          )
            continue;
          const restored = cartLine(
            p,
            line.variantId,
            line.addOnIds,
            choiceIds,
            line.quantity,
          );
          if (restored && !valid.some((l) => l.key === restored.key))
            valid.push(restored);
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
  function add(
    p: Product,
    variantId: string,
    addOnIds: string[],
    choiceIds: string[],
  ) {
    const line = cartLine(p, variantId, addOnIds, choiceIds, 1);
    if (!line) return;
    setCart((current) =>
      current.some((l) => l.key === line.key)
        ? current.map((l) =>
            l.key === line.key
              ? { ...l, quantity: Math.min(20, l.quantity + 1) }
              : l,
          )
        : [...current, line],
    );
    requestKey.current = null;
    setResult(null);
  }
  const subtotal = cart.reduce((n, l) => n + l.quotedUnitCents * l.quantity, 0);
  const automaticDelivery = settings.deliveryConfig?.mode === "radius";
  const quote = automaticDelivery ? deliveryQuote(settings.deliveryConfig, settings.deliveryZones, deliveryLocation) : null;
  const zone = automaticDelivery ? quote?.zone : settings.deliveryZones.find((z) => z.id === zoneId);
  const needsLocation = fulfillment === "delivery" && automaticDelivery && !quote;
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
          zoneId: fulfillment === "delivery" ? (zone?.id ?? null) : null,
          ...(fulfillment === "delivery" && automaticDelivery ? { deliveryLocation, quotedDeliveryCents: fee } : {}),
          paymentMethod: form.get("paymentMethod"),
          note: form.get("note"),
          items: cart.map(
            ({
              productId,
              variantId,
              addOnIds,
              choiceIds,
              quantity,
              quotedUnitCents,
            }) => ({
              productId,
              variantId,
              addOnIds,
              choiceIds,
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
          {business.name}
        </a>
        <span className={`store-status ${open ? "active" : ""}`}>
          <span aria-hidden="true" />
          {open ? "Abierto ahora" : "Cerrado ahora"}
        </span>
      </header>
      <main>
        <section className={`shop-cover ${cover ? "has-photo" : ""}`}>
          <div className="shop-cover-media">
            {cover ? (
              <img
                className="shop-cover-photo"
                src={cover.src}
                srcSet={cover.srcSet}
                sizes="(max-width: 1250px) 100vw, 1160px"
                alt=""
                fetchPriority="high"
                referrerPolicy="no-referrer"
                style={{
                  objectPosition: `${settings.coverFocusX}% ${settings.coverFocusY}%`,
                }}
              />
            ) : (
              <div className="shop-cover-marquee" aria-hidden="true">
                {[0, 1].map((n) => (
                  <span key={n}>
                    {Array.from({ length: 4 }, () => business.name).join(" ✳ ")}
                    {" ✳ "}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shop-cover-content">
            <p className="eyebrow">HECHO ACÁ, PEDIDO DIRECTO</p>
            <h1>{business.name}</h1>
          </div>
          <span className="shop-cover-logo" aria-hidden="true">
            {business.name.trim().slice(0, 1)}
          </span>
        </section>
        <section className="shop-hero">
          <div>
            <p className="shop-tagline">¿Qué te tentó hoy?</p>
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
                  <div className="shop-products">
                    {list.map((p) => (
                      <ProductChoice
                        key={p.id}
                        product={p}
                        onAdd={add}
                        disabled={!open || preview || busy}
                      />
                    ))}
                  </div>
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
                <a className="text-button" href={result.trackingUrl}>
                  Seguí tu pedido acá →
                </a>
              </div>
            ) : null}
            {cart.length ? (
              <>
                <ul className="cart-lines">
                  {cart.map((l) => (
                    <li key={l.key}>
                      <div>
                        <strong>
                          {l.label}
                          {l.choices.map((c) => (
                            <small key={c}>{c}</small>
                          ))}
                        </strong>
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
                    <strong>{needsLocation ? "A calcular" : formatMoney(fee)}</strong>
                  </div>
                ) : null}
                <div className="cart-total final-total">
                  <span>{needsLocation ? "Total sin envío" : "Total"}</span>
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
                      {!automaticDelivery ? <label>
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
                      </label> : null}
                      <label>
                        Dirección y referencias
                        <input
                          name="address"
                          autoComplete="street-address"
                          required
                          minLength={5}
                          maxLength={250}
                          value={deliveryAddress}
                          onChange={e => { setDeliveryAddress(e.target.value); setDeliveryLocation(null); requestKey.current = null; }}
                        />
                      </label>
                      {automaticDelivery && settings.deliveryConfig.mode === "radius" ? <>
                        <LocationPicker value={deliveryLocation} address={`${deliveryAddress}, ${business.city}`} origin={settings.deliveryConfig.origin} onChange={location => { setDeliveryLocation(location); requestKey.current = null; }} onSuggestion={({ street, location }) => { setDeliveryAddress(street); setDeliveryLocation(location); requestKey.current = null; }} />
                        <p className={deliveryLocation && !quote ? "form-error" : "field-hint standalone-hint"} role="status">
                          {quote ? `Envío: ${formatMoney(quote.feeCents)} · ${quote.zone.name}` : deliveryLocation ? "Esta dirección está fuera de la cobertura de delivery. Podés elegir retiro si está disponible." : "Marcá tu dirección en el mapa para conocer el costo de envío."}
                        </p>
                      </> : null}
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
                  disabled={busy || !open || preview || needsLocation || (fulfillment === "delivery" && Boolean(zone) && subtotal < zone!.minimumCents)}
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
        <span>Hecho con pedipue.com</span>
      </footer>
    </div>
  );
}
