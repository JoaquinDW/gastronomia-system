"use client";
import Link from "next/link";
import { useState } from "react";
import {
  dayNames,
  moneyToCents,
  priceInputValue,
  settingsInput,
  type Hours,
  type StoreSettings,
} from "@/lib/menu";
export function StoreConfigurator({
  businessId,
  slug,
  initialSettings,
  productCount,
  suggestedHours,
}: {
  businessId: string;
  slug: string;
  initialSettings: StoreSettings;
  productCount: number;
  suggestedHours: Hours;
}) {
  const [s, setS] = useState(initialSettings);
  const [zones, setZones] = useState(() =>
    s.deliveryZones.map((z) => ({
      id: z.id,
      name: z.name,
      fee: priceInputValue(z.feeCents),
      minimum: priceInputValue(z.minimumCents),
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const base = `/api/businesses/${businessId}/store`;
  async function save() {
    const { isPublished, version, ...rest } = s;
    void isPublished;
    const deliveryZones = zones.map((z) => ({
      id: z.id,
      name: z.name,
      feeCents: moneyToCents(z.fee),
      minimumCents: moneyToCents(z.minimum),
    }));
    if (
      deliveryZones.some((z) => z.feeCents === null || z.minimumCents === null)
    )
      throw new Error(
        "Revisá los precios de envío y los mínimos. Deben ser importes válidos en pesos.",
      );
    const parsed = settingsInput.safeParse({ ...rest, deliveryZones });
    if (!parsed.success)
      throw new Error(parsed.error.issues.map((i) => i.message).join(" · "));
    const r = await fetch(base, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: parsed.data, version }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setS(d.settings);
    return d.settings as StoreSettings;
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await save();
      setNotice("La configuración de tu tienda quedó guardada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!s.isPublished) await save();
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: !s.isPublished }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setS((prev) => ({
        ...prev,
        isPublished: d.settings.isPublished,
        version: d.settings.version,
      }));
      setNotice(
        d.settings.isPublished
          ? "Tu tienda está activa. Ya podés compartir su enlace."
          : "Tu tienda quedó pausada y su enlace ya no muestra la carta al público.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos cambiar el estado de la tienda.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="store-config-layout">
      <form className="app-form config-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <section className="config-section">
            <div className="section-label">
              <h2>
                <span>01</span> Presentación
              </h2>
            </div>
            <label>
              Descripción de tu negocio
              <textarea
                rows={3}
                maxLength={600}
                value={s.description}
                onChange={(e) => setS({ ...s, description: e.target.value })}
                placeholder="Lo que preparás y por qué tus clientes vuelven."
              />
            </label>
            <label>
              Aclaraciones de la carta
              <textarea
                rows={3}
                maxLength={2500}
                value={s.menuNote}
                onChange={(e) => setS({ ...s, menuNote: e.target.value })}
                placeholder="Por ejemplo: todas las hamburguesas incluyen una porción de papas."
              />
            </label>
            <p className="field-hint standalone-hint">
              Se muestran en tu tienda para que el cliente sepa qué incluye su
              pedido.
            </p>
          </section>
          <section className="config-section">
            <h2>
              <span>02</span> Horarios de atención
            </h2>
            <p className="section-description">
              Horario de Argentina. Podés agregar varios turnos por día. Un
              cierre anterior a la apertura corresponde al día siguiente.
            </p>
            {suggestedHours.length ? (
              <button
                type="button"
                className="secondary-button suggested-hours"
                onClick={() => setS({ ...s, hours: suggestedHours })}
              >
                Usar los horarios detectados en la carta
              </button>
            ) : null}
            <div className="hours-editor">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                const slots = s.hours
                  .map((h, i) => ({ ...h, index: i }))
                  .filter((h) => h.day === day);
                return (
                  <div className="hours-day" key={day}>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={slots.length > 0}
                        onChange={(e) =>
                          setS({
                            ...s,
                            hours: e.target.checked
                              ? [
                                  ...s.hours,
                                  { day, opens: "20:00", closes: "00:00" },
                                ]
                              : s.hours.filter((h) => h.day !== day),
                          })
                        }
                      />
                      {dayNames[day]}
                    </label>
                    <div className="day-slots">
                      {slots.length ? (
                        slots.map((h, j) => (
                          <div className="time-slot" key={h.index}>
                            <input
                              type="time"
                              aria-label={`Apertura ${dayNames[day]} turno ${j + 1}`}
                              value={h.opens}
                              onChange={(e) =>
                                setS({
                                  ...s,
                                  hours: s.hours.map((x, i) =>
                                    i === h.index
                                      ? { ...x, opens: e.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                            <span>a</span>
                            <input
                              type="time"
                              aria-label={`Cierre ${dayNames[day]} turno ${j + 1}`}
                              value={h.closes}
                              onChange={(e) =>
                                setS({
                                  ...s,
                                  hours: s.hours.map((x, i) =>
                                    i === h.index
                                      ? { ...x, closes: e.target.value }
                                      : x,
                                  ),
                                })
                              }
                            />
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Quitar turno ${j + 1} de ${dayNames[day]}`}
                              onClick={() =>
                                setS({
                                  ...s,
                                  hours: s.hours.filter(
                                    (_, i) => i !== h.index,
                                  ),
                                })
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="closed-label">Cerrado</span>
                      )}
                      {slots.length > 0 && slots.length < 3 ? (
                        <button
                          type="button"
                          className="quiet-button"
                          onClick={() =>
                            setS({
                              ...s,
                              hours: [
                                ...s.hours,
                                { day, opens: "12:00", closes: "15:00" },
                              ],
                            })
                          }
                        >
                          + Otro turno
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="config-section">
            <h2>
              <span>03</span> Retiro y delivery
            </h2>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={s.pickupEnabled}
                onChange={(e) =>
                  setS({ ...s, pickupEnabled: e.target.checked })
                }
              />{" "}
              Retiro en el local
            </label>
            {s.pickupEnabled ? (
              <>
                <label>
                  Indicaciones para retirar
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={s.pickupInstructions}
                    onChange={(e) =>
                      setS({ ...s, pickupInstructions: e.target.value })
                    }
                    placeholder="Timbre, referencia o instrucciones para encontrar el local."
                  />
                </label>
                <p className="field-hint standalone-hint">
                  La dirección que registraste para el local se mostrará a tus
                  clientes.
                </p>
              </>
            ) : null}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={s.deliveryEnabled}
                onChange={(e) =>
                  setS({ ...s, deliveryEnabled: e.target.checked })
                }
              />{" "}
              Delivery propio por zonas
            </label>
            {s.deliveryEnabled ? (
              <div className="delivery-zones">
                <p className="section-description">
                  El cliente elige su barrio. El local verifica la dirección
                  antes de confirmar el pedido.
                </p>
                {zones.map((z, i) => (
                  <div className="zone-editor" key={z.id}>
                    <label>
                      Nombre de zona o barrio
                      <input
                        value={z.name}
                        maxLength={100}
                        required
                        onChange={(e) =>
                          setZones(
                            zones.map((v, j) =>
                              j === i ? { ...v, name: e.target.value } : v,
                            ),
                          )
                        }
                        placeholder="Centro"
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        Envío ($)
                        <input
                          inputMode="decimal"
                          value={z.fee}
                          required
                          onChange={(e) =>
                            setZones(
                              zones.map((v, j) =>
                                j === i ? { ...v, fee: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Compra mínima ($)
                        <input
                          inputMode="decimal"
                          value={z.minimum}
                          required
                          onChange={(e) =>
                            setZones(
                              zones.map((v, j) =>
                                j === i ? { ...v, minimum: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="quiet-button muted-action"
                      onClick={() => setZones(zones.filter((_, j) => j !== i))}
                    >
                      Quitar zona
                    </button>
                  </div>
                ))}
                <button
                  className="secondary-button"
                  type="button"
                  disabled={zones.length >= 30}
                  onClick={() =>
                    setZones([
                      ...zones,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        fee: "0",
                        minimum: "0",
                      },
                    ])
                  }
                >
                  + Agregar zona de delivery
                </button>
              </div>
            ) : null}
          </section>
          <section className="config-section">
            <h2>
              <span>04</span> Medios de pago
            </h2>
            {[
              ["cash", "Efectivo"],
              ["transfer", "Transferencia bancaria"],
            ].map(([method, label]) => (
              <label className="checkbox-label" key={method}>
                <input
                  type="checkbox"
                  checked={s.paymentMethods.includes(
                    method as "cash" | "transfer",
                  )}
                  onChange={(e) =>
                    setS({
                      ...s,
                      paymentMethods: e.target.checked
                        ? [...s.paymentMethods, method as "cash" | "transfer"]
                        : s.paymentMethods.filter((m) => m !== method),
                    })
                  }
                />
                {label}
              </label>
            ))}
            {s.paymentMethods.includes("transfer") ? (
              <label>
                Alias o CBU
                <input
                  value={s.transferAlias}
                  maxLength={100}
                  required
                  onChange={(e) =>
                    setS({ ...s, transferAlias: e.target.value })
                  }
                  placeholder="MI.LOCAL.ALIAS"
                />
              </label>
            ) : null}
            <p className="field-hint standalone-hint">
              Los pagos se verifican manualmente. Elegir transferencia no marca
              el pedido como pagado.
            </p>
          </section>
        </fieldset>
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "Guardando…" : "Guardar configuración"}
        </button>
      </form>
      <aside className="publish-panel">
        <div className={`store-status ${s.isPublished ? "active" : ""}`}>
          <span aria-hidden="true" />
          {s.isPublished ? "Tienda activa" : "Tienda sin publicar"}
        </div>
        <h2>
          Tu próximo pedido
          <br />
          empieza acá.
        </h2>
        <p>
          Revisá la carta, los horarios y cómo vas a entregar. Después compartí
          el enlace de tu tienda.
        </p>
        <ul className="publish-checks">
          <li>
            {productCount > 0 ? "✓" : "○"} {productCount}{" "}
            {productCount === 1
              ? "producto disponible"
              : "productos disponibles"}
          </li>
          <li>{s.hours.length ? "✓" : "○"} Horarios de atención</li>
          <li>
            {s.pickupEnabled || s.deliveryEnabled ? "✓" : "○"} Modalidad de
            entrega
          </li>
        </ul>
        <Link
          className="secondary-button"
          href={`/t/${slug}?preview=1`}
          target="_blank"
        >
          Vista previa de la tienda ↗
        </Link>
        <button className="primary-button" disabled={busy} onClick={publish}>
          {busy
            ? "Actualizando…"
            : s.isPublished
              ? "Pausar tienda"
              : "Guardar y activar tienda"}
        </button>
        {s.isPublished ? (
          <div className="share-store">
            <Link href={`/t/${slug}`} target="_blank">
              /t/{slug} ↗
            </Link>
            <button
              className="quiet-button"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/t/${slug}`,
                  );
                  setCopied(true);
                } catch {
                  setError(
                    "No pudimos copiar el enlace. Podés abrirlo y copiar la dirección.",
                  );
                }
              }}
            >
              {copied ? "Enlace copiado" : "Copiar enlace"}
            </button>
          </div>
        ) : null}
        <p className="form-footnote">
          Los pedidos se guardan pendientes y el cliente continúa por WhatsApp.
          El local los confirma desde su panel.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="success-notice" role="status">
            {notice}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
