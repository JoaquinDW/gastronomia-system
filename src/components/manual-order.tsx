"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatMoney,
  resolveChoices,
  type DeliveryZone,
  type Product,
} from "@/lib/menu";
import {
  channelLabels,
  defaultCustomerName,
  manualChannels,
  type Order,
} from "@/lib/checkout";
import { cartLine, pesosToCents, type CartLine } from "@/lib/cart";
import { ChoiceGroup, choiceIdsOf, type ChoicePicks } from "./choice-group";

type Channel = (typeof manualChannels)[number];
export type CreatedOrder = Order & {
  management: { warnings?: string[]; costComplete?: boolean } | null;
};

const configurable = (p: Product) =>
  p.variants.length > 1 || p.addOns.length > 0 || (p.optionGroups ?? []).length > 0;

function ProductOptions({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (line: CartLine) => void;
}) {
  const [variant, setVariant] = useState(product.variants[0].id);
  const [extras, setExtras] = useState<string[]>([]);
  const [picks, setPicks] = useState<ChoicePicks>({});
  const [error, setError] = useState("");
  const groups = product.optionGroups ?? [];
  const choiceIds = choiceIdsOf(groups, picks);
  const line = cartLine(product, variant, extras, choiceIds, 1);
  return (
    <div className="manual-options">
      {product.variants.length > 1 ? (
        <label>
          Presentación
          <select value={variant} onChange={(e) => setVariant(e.target.value)}>
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {formatMoney(v.priceCents)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {product.addOns.map((a) => (
        <label className="checkbox-label" key={a.id}>
          <input
            type="checkbox"
            checked={extras.includes(a.id)}
            onChange={(e) =>
              setExtras(
                e.target.checked
                  ? [...extras, a.id]
                  : extras.filter((id) => id !== a.id),
              )
            }
          />
          {a.name} <span>+ {formatMoney(a.priceCents)}</span>
        </label>
      ))}
      {groups.map((g) => (
        <ChoiceGroup
          key={g.id}
          group={g}
          picks={picks}
          inputName={`manual-${product.id}-${g.id}`}
          onChange={(next) => {
            setPicks(next);
            setError("");
          }}
        />
      ))}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="secondary-button"
        onClick={() => {
          const check = resolveChoices(product, choiceIds);
          if (!check.ok || !line)
            return setError(check.ok ? "Revisá las opciones." : check.message);
          onAdd(line);
        }}
      >
        Sumar al pedido{line ? ` · ${formatMoney(line.quotedUnitCents)}` : ""}
      </button>
    </div>
  );
}

export function ManualOrder({
  businessId,
  onCreated,
  onClose,
}: {
  businessId: string;
  onCreated: (order: CreatedOrder) => void;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [channel, setChannel] = useState<Channel>("counter");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [fee, setFee] = useState("");
  const [payment, setPayment] = useState<"cash" | "transfer">("cash");
  const [preparation, setPreparation] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Kept until the order is saved, so a retry after a dropped connection
  // returns the same order instead of loading it twice.
  const requestKey = useRef(crypto.randomUUID());

  useEffect(() => {
    let live = true;
    fetch(`/api/businesses/${businessId}/menu`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (!live) return;
        setProducts(d.products);
        setZones(d.settings.deliveryZones ?? []);
        setZoneId(d.settings.deliveryZones?.[0]?.id ?? "");
      })
      .catch((e) =>
        live && setLoadError(e instanceof Error && e.message ? e.message : "No pudimos traer la carta."),
      );
    return () => {
      live = false;
    };
  }, [businessId]);

  const available = useMemo(
    () => (products ?? []).filter((p) => p.isAvailable),
    [products],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? available.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(q))
      : available;
  }, [available, query]);
  const categories = [...new Set(shown.map((p) => p.category))];

  const zone = zones.find((z) => z.id === zoneId);
  const feeCents =
    fulfillment !== "delivery" ? 0 : zone ? zone.feeCents : pesosToCents(fee);
  const subtotal = cart.reduce((n, l) => n + l.quotedUnitCents * l.quantity, 0);
  const units = cart.reduce((n, l) => n + l.quantity, 0);

  function add(line: CartLine) {
    setCart((current) => {
      const same = current.find((l) => l.key === line.key);
      return same
        ? current.map((l) =>
            l.key === line.key ? { ...l, quantity: Math.min(20, l.quantity + 1) } : l,
          )
        : [...current, line];
    });
    setOpen("");
    setError("");
  }
  function change(key: string, delta: number) {
    setCart((current) =>
      current
        .map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.length) return setError("Sumá al menos un producto.");
    if (feeCents === null)
      return setError("Revisá el costo de envío: solo números, por ejemplo 1500.");
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/businesses/${businessId}/orders/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey: requestKey.current,
          channel,
          customerName: name,
          customerPhone: phone,
          fulfillment,
          address: fulfillment === "delivery" ? address : "",
          zoneId: fulfillment === "delivery" && zone ? zone.id : null,
          deliveryCents: fulfillment === "delivery" && !zone ? feeCents : 0,
          paymentMethod: payment,
          note,
          preparationMinutes: preparation ? Number(preparation) : null,
          items: cart.map(({ productId, variantId, addOnIds, choiceIds, quantity, quotedUnitCents }) => ({
            productId,
            variantId,
            addOnIds,
            choiceIds,
            quantity,
            quotedUnitCents,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      requestKey.current = crypto.randomUUID();
      onCreated(d.order);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No pudimos cargar el pedido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="manual-order" aria-labelledby="manual-order-title">
      <div className="print-settings-heading">
        <h2 id="manual-order-title">Nuevo pedido</h2>
        <button type="button" className="text-button" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <p className="section-description">
        Para lo que entra por mostrador, teléfono o WhatsApp. Queda aceptado y
        en preparación, con la venta registrada y los insumos descontados, igual
        que un pedido de la tienda.
      </p>
      <div className="manual-picker">
        <h3>Productos</h3>
        {loadError ? (
          <p className="form-error" role="alert">
            {loadError}
          </p>
        ) : !products ? (
          <p className="field-hint">Cargando la carta…</p>
        ) : !available.length ? (
          <p className="field-hint">
            No hay productos disponibles. Sumalos o activalos en Carta.
          </p>
        ) : (
          <>
            <input
              type="search"
              className="manual-search"
              placeholder="Buscar en la carta"
              aria-label="Buscar en la carta"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {!shown.length ? (
              <p className="field-hint">No encontramos “{query}”.</p>
            ) : null}
            {categories.map((c) => (
              <div key={c} className="manual-category">
                <h4>{c}</h4>
                <ul>
                  {shown
                    .filter((p) => p.category === c)
                    .map((p) => {
                      const from = Math.min(...p.variants.map((v) => v.priceCents));
                      const simple = !configurable(p) && cartLine(p, p.variants[0].id, [], [], 1);
                      return (
                        <li key={p.id} data-open={open === p.id || undefined}>
                          <button
                            type="button"
                            className="manual-product"
                            aria-expanded={simple ? undefined : open === p.id}
                            onClick={() =>
                              simple ? add(simple) : setOpen(open === p.id ? "" : p.id)
                            }
                          >
                            <span>{p.name}</span>
                            <strong>
                              {p.variants.length > 1 ? "desde " : ""}
                              {formatMoney(from)}
                            </strong>
                            <span className="manual-add" aria-hidden="true">
                              {open === p.id ? "−" : "+"}
                            </span>
                          </button>
                          {open === p.id ? (
                            <ProductOptions product={p} onAdd={add} />
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>
      <form className="app-form manual-summary" onSubmit={submit}>
        <h3>Pedido</h3>
        {cart.length ? (
          <ul className="manual-cart">
            {cart.map((l) => (
              <li key={l.key}>
                <div>
                  <strong>{l.label}</strong>
                  {l.choices.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
                <div className="manual-stepper">
                  <button
                    type="button"
                    onClick={() => change(l.key, -1)}
                    aria-label={`Quitar uno de ${l.label}`}
                  >
                    −
                  </button>
                  <span>{l.quantity}</span>
                  <button
                    type="button"
                    onClick={() => change(l.key, 1)}
                    disabled={l.quantity >= 20}
                    aria-label={`Sumar uno de ${l.label}`}
                  >
                    +
                  </button>
                </div>
                <strong className="manual-price">
                  {formatMoney(l.quotedUnitCents * l.quantity)}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-hint">Tocá un producto de la carta para sumarlo.</p>
        )}
        <fieldset>
          <legend>Por dónde entró</legend>
          <div className="order-filters" role="group" aria-label="Por dónde entró">
            {manualChannels.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={channel === c}
                onClick={() => setChannel(c)}
              >
                {channelLabels[c]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <label>
            Nombre
            <input
              value={name}
              maxLength={100}
              placeholder={defaultCustomerName(channel)}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Teléfono (opcional)
            <input
              type="tel"
              value={phone}
              maxLength={30}
              placeholder="351 123 4567"
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        </div>
        <fieldset>
          <legend>Entrega</legend>
          <div className="order-filters" role="group" aria-label="Entrega">
            {(
              [
                ["pickup", "Retira"],
                ["delivery", "Delivery"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={fulfillment === value}
                onClick={() => setFulfillment(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        {fulfillment === "delivery" ? (
          <div className="form-grid">
            <label className="manual-wide">
              Dirección
              <input
                value={address}
                required
                minLength={5}
                maxLength={250}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
            <label>
              Envío
              <select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} · {formatMoney(z.feeCents)}
                  </option>
                ))}
                <option value="">Otro importe</option>
              </select>
            </label>
            {!zone ? (
              <label>
                Costo de envío ($)
                <input
                  inputMode="decimal"
                  value={fee}
                  placeholder="0"
                  onChange={(e) => setFee(e.target.value)}
                />
              </label>
            ) : null}
          </div>
        ) : null}
        <div className="form-grid">
          <label>
            Pago
            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value as "cash" | "transfer")}
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
            </select>
          </label>
          <label>
            Tiempo de preparación
            <select value={preparation} onChange={(e) => setPreparation(e.target.value)}>
              <option value="">Sin estimación</option>
              {[10, 15, 20, 30, 45, 60, 90].map((n) => (
                <option value={n} key={n}>
                  {n} minutos
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Nota para la cocina
          <input
            value={note}
            maxLength={500}
            placeholder="Sin cebolla, bien cocida…"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="cart-total">
          <span>
            Total{units ? ` · ${units} ${units === 1 ? "producto" : "productos"}` : ""}
          </span>
          <strong>{formatMoney(subtotal + (feeCents ?? 0))}</strong>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary-button" disabled={busy || !cart.length}>
          {busy ? "Cargando…" : "Cargar pedido"}
        </button>
        <p className="field-hint">
          Cargar el pedido no lo marca como cobrado.
        </p>
      </form>
    </section>
  );
}
