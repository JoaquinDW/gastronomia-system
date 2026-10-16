"use client";
import { useEffect, useRef, useState } from "react";
import type { MenuExtraction } from "@/lib/menu-extraction";
import { moneyToCents, type ProductInput } from "@/lib/menu";
type Row = {
  key: string;
  selected: boolean;
  name: string;
  category: string;
  description: string;
  kind: "product" | "combo";
  variants: { id: string; name: string; price: string }[];
  addOns: { id: string; name: string; price: string }[];
  warnings: string[];
};
type ImportRecord = { id: string; status: string; draft: MenuExtraction };
export function MenuImporter({
  businessId,
  aiAvailable,
  onSaved,
}: {
  businessId: string;
  aiAvailable: boolean;
  onSaved: (message: string) => Promise<void>;
}) {
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [record, setRecord] = useState<ImportRecord | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [applyNote, setApplyNote] = useState(true);
  const [reviewed, setReviewed] = useState(false);
  const [recent, setRecent] = useState<ImportRecord[]>([]);
  const key = useRef<string | null>(null);
  const base = `/api/businesses/${businessId}/menu/import`;
  useEffect(() => {
    fetch(base, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d)
          setRecent(
            d.imports.filter((i: ImportRecord) => i.status === "ready"),
          );
      })
      .catch(() => {});
  }, [base]);
  function openRecord(r: ImportRecord) {
    setRecord(r);
    setReviewed(false);
    setNote(r.draft.globalNotes.join("\n"));
    setRows(
      r.draft.products.map((p) => ({
        key: crypto.randomUUID(),
        selected: true,
        name: p.name,
        category: p.category,
        description: p.description,
        kind: p.kind,
        variants: p.variants.length
          ? p.variants.map((v) => ({
              id: crypto.randomUUID(),
              name: v.name || "Única",
              price: v.price ?? "",
            }))
          : [{ id: crypto.randomUUID(), name: "Única", price: "" }],
        addOns: p.addOns.map((a) => ({
          id: crypto.randomUUID(),
          name: a.name,
          price: a.price ?? "",
        })),
        warnings: p.warnings,
      })),
    );
  }
  async function analyze(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    key.current ??= crypto.randomUUID();
    const form = new FormData(e.currentTarget);
    form.set("requestKey", key.current);
    try {
      const r = await fetch(base, { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) {
        key.current = null;
        throw new Error(d.error);
      }
      if (d.status === "committed") {
        key.current = null;
        throw new Error(
          "Esta importación ya se guardó. Tu carta no se duplicó.",
        );
      }
      openRecord(d);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos analizar el archivo.",
      );
    } finally {
      setBusy(false);
    }
  }
  function patch(index: number, changes: Partial<Row>) {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...changes } : r)));
    setReviewed(false);
  }
  async function save() {
    setError("");
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) {
      setError("Seleccioná al menos un producto.");
      return;
    }
    const products: ProductInput[] = [];
    for (const [i, r] of selected.entries()) {
      const variants = r.variants.map((v) => ({
        id: v.id,
        name: v.name,
        priceCents: moneyToCents(v.price),
      }));
      const addOns = r.addOns.map((v) => ({
        id: v.id,
        name: v.name,
        priceCents: moneyToCents(v.price),
      }));
      if (
        variants.some((v) => v.priceCents === null) ||
        addOns.some((a) => a.priceCents === null)
      ) {
        setError(
          `Revisá los precios de “${r.name}”. Si no conocés el precio, desmarcá el producto.`,
        );
        return;
      }
      products.push({
        name: r.name,
        description: r.description,
        category: r.category,
        kind: r.kind,
        variants: variants as ProductInput["variants"],
        addOns: addOns as ProductInput["addOns"],
        imageUrl: "",
        imageFocusX: 50,
        imageFocusY: 50,
        isAvailable: true,
        sortOrder: i,
      });
    }
    setBusy(true);
    try {
      const response = await fetch(base, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importId: record!.id,
          products,
          menuNote: applyNote ? note : null,
        }),
      });
      const d = await response.json();
      if (!response.ok) throw new Error(d.error);
      await onSaved(
        `${d.result.saved} productos guardados${d.result.skipped ? `; ${d.result.skipped} ya existían y no se sobrescribieron` : ""}.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar la importación.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="import-panel" aria-labelledby="import-title">
      <div className="import-heading">
        <span className="ai-symbol" aria-hidden="true">
          ✦
        </span>
        <div>
          <p className="eyebrow">DE LA FOTO A TU CARTA</p>
          <h2 id="import-title">Tu carta, sin volver a tipearla.</h2>
          <p>
            Leemos productos, precios y promociones. Vos revisás antes de
            guardar.
          </p>
        </div>
      </div>
      {!record ? (
        <>
          <form className="app-form import-form" onSubmit={analyze}>
            <fieldset disabled={busy || !aiAvailable}>
              <label className="file-drop">
                Subí imágenes o PDF
                <input
                  name="files"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  multiple
                  onChange={(e) => {
                    setFileNames(
                      Array.from(e.target.files ?? []).map((f) => f.name),
                    );
                    key.current = null;
                  }}
                />
                <span>
                  {fileNames.length
                    ? fileNames.join(" · ")
                    : "PNG, JPG, WEBP o PDF · hasta 5 archivos, 8 MB cada uno y 12 MB en total"}
                </span>
              </label>
              <label>
                O pegá el texto de tu carta
                <textarea
                  name="text"
                  rows={4}
                  maxLength={30000}
                  placeholder={
                    "Hamburguesa clásica $6.500\nPapas grandes $4.500\nPromo 2 clásicas $12.000"
                  }
                  onChange={() => {
                    key.current = null;
                  }}
                />
              </label>
            </fieldset>
            {!aiAvailable ? (
              <p className="form-error">
                La importación con IA todavía no está configurada. Podés cargar
                los productos manualmente mientras tanto.
              </p>
            ) : null}
            <p className="form-footnote">
              Los archivos se envían a OpenAI para extraer la información. No se
              publican ni se guardan como fotos de productos.
            </p>
            <button
              type="submit"
              className="primary-button compact-button"
              disabled={busy || !aiAvailable}
            >
              {busy
                ? "Leyendo tu carta… Puede tardar hasta 90 segundos."
                : "Analizar carta con IA"}
            </button>
          </form>
          {recent.length ? (
            <div className="recent-imports">
              <h3>Retomar una revisión</h3>
              {recent.map((r, i) => (
                <button
                  className="text-button"
                  key={r.id}
                  onClick={() => openRecord(r)}
                >
                  Carta {i + 1} · {r.draft.products.length} productos detectados
                  →
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="import-review">
          <div className="review-header">
            <h3>Revisá {rows.length} productos detectados</h3>
            <button
              className="quiet-button"
              disabled={busy}
              onClick={() => {
                setRecord(null);
                key.current = null;
              }}
            >
              Analizar otra carta
            </button>
          </div>
          {record.draft.businessName ? (
            <p className="detected-brand">
              Carta detectada: <strong>{record.draft.businessName}</strong>
            </p>
          ) : null}
          {record.draft.warnings.length ? (
            <div className="review-warning">
              {record.draft.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          ) : null}
          {!rows.length ? (
            <p>
              No encontramos productos. Probá una imagen más nítida o cargalos
              manualmente.
            </p>
          ) : null}
          {rows.map((r, i) => (
            <article
              className={`review-product ${r.selected ? "" : "is-excluded"}`}
              key={r.key}
            >
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={(e) => patch(i, { selected: e.target.checked })}
                />{" "}
                Incluir producto {i + 1}
              </label>
              <div className="app-form">
                <div className="form-grid">
                  <label>
                    Nombre
                    <input
                      value={r.name}
                      disabled={!r.selected || busy}
                      onChange={(e) => patch(i, { name: e.target.value })}
                    />
                  </label>
                  <label>
                    Categoría
                    <input
                      value={r.category}
                      disabled={!r.selected || busy}
                      onChange={(e) => patch(i, { category: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Descripción
                  <textarea
                    value={r.description}
                    rows={2}
                    disabled={!r.selected || busy}
                    onChange={(e) => patch(i, { description: e.target.value })}
                  />
                </label>
                <label>
                  Tipo
                  <select
                    value={r.kind}
                    disabled={!r.selected || busy}
                    onChange={(e) =>
                      patch(i, { kind: e.target.value as Row["kind"] })
                    }
                  >
                    <option value="product">Producto</option>
                    <option value="combo">Combo o promoción</option>
                  </select>
                </label>
                {r.variants.map((v, j) => (
                  <div className="form-grid" key={v.id}>
                    <label>
                      Presentación
                      <input
                        value={v.name}
                        disabled={!r.selected || busy}
                        onChange={(e) =>
                          patch(i, {
                            variants: r.variants.map((a, k) =>
                              k === j ? { ...a, name: e.target.value } : a,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Precio en ARS
                      <input
                        inputMode="decimal"
                        value={v.price}
                        placeholder="Revisar precio"
                        aria-invalid={moneyToCents(v.price) === null}
                        disabled={!r.selected || busy}
                        onChange={(e) =>
                          patch(i, {
                            variants: r.variants.map((a, k) =>
                              k === j ? { ...a, price: e.target.value } : a,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                ))}
                {r.addOns.length ? (
                  <details>
                    <summary>Adicionales ({r.addOns.length})</summary>
                    {r.addOns.map((a, j) => (
                      <div className="form-grid" key={a.id}>
                        <label>
                          Adicional
                          <input
                            value={a.name}
                            disabled={!r.selected || busy}
                            onChange={(e) =>
                              patch(i, {
                                addOns: r.addOns.map((v, k) =>
                                  k === j ? { ...v, name: e.target.value } : v,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          Precio
                          <input
                            inputMode="decimal"
                            value={a.price}
                            disabled={!r.selected || busy}
                            onChange={(e) =>
                              patch(i, {
                                addOns: r.addOns.map((v, k) =>
                                  k === j ? { ...v, price: e.target.value } : v,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </details>
                ) : null}
              </div>
              {r.warnings.map((w, j) => (
                <p className="field-error" key={j}>
                  {w}
                </p>
              ))}
            </article>
          ))}
          <div className="app-form review-note">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={applyNote}
                onChange={(e) => setApplyNote(e.target.checked)}
              />{" "}
              Usar estas aclaraciones generales en la tienda
            </label>
            <textarea
              aria-label="Aclaraciones generales de la carta"
              rows={3}
              value={note}
              maxLength={2500}
              disabled={!applyNote || busy}
              onChange={(e) => {
                setNote(e.target.value);
                setReviewed(false);
              }}
            />
          </div>
          <label className="checkbox-label review-consent">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />{" "}
            Revisé nombres, precios en pesos, promociones y aclaraciones.
          </label>
          <button
            className="primary-button"
            disabled={busy || !reviewed || !rows.length}
            onClick={save}
          >
            {busy
              ? "Guardando carta…"
              : `Guardar ${rows.filter((r) => r.selected).length} productos seleccionados`}
          </button>
          <p className="form-footnote">
            Los productos existentes con el mismo nombre se omiten. No se
            cambian precios ni se publica la tienda automáticamente.
          </p>
        </div>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
