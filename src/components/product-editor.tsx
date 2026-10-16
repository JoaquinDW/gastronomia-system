"use client";
import { useEffect, useRef, useState } from "react";
import {
  moneyToCents,
  priceInputValue,
  type Product,
  type ProductInput,
} from "@/lib/menu";
export function ProductEditor({
  product,
  categories,
  onSave,
  onClose,
}: {
  product?: Product;
  categories: string[];
  onSave: (p: ProductInput) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [variants, setVariants] = useState<
    { id: string; name: string; price: string }[]
  >(
    () =>
      product?.variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: priceInputValue(v.priceCents),
      })) ?? [{ id: crypto.randomUUID(), name: "Única", price: "" }],
  );
  const [addOns, setAddOns] = useState<
    { id: string; name: string; price: string }[]
  >(
    () =>
      product?.addOns.map((a) => ({
        id: a.id,
        name: a.name,
        price: priceInputValue(a.priceCents),
      })) ?? [],
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    const prices = variants.map((v) => ({
      id: v.id,
      name: v.name,
      priceCents: moneyToCents(v.price),
    }));
    const extras = addOns.map((a) => ({
      id: a.id,
      name: a.name,
      priceCents: moneyToCents(a.price),
    }));
    if (
      prices.some((v) => v.priceCents === null || !v.name.trim()) ||
      extras.some((v) => v.priceCents === null || !v.name.trim())
    ) {
      setError(
        "Cada variante y adicional necesita un nombre y un precio válido en pesos.",
      );
      return;
    }
    setBusy(true);
    try {
      await onSave({
        name: String(form.get("name")),
        description: String(form.get("description")),
        category: String(form.get("category")),
        kind: form.get("kind") === "combo" ? "combo" : "product",
        variants: prices as ProductInput["variants"],
        addOns: extras as ProductInput["addOns"],
        imageUrl: String(form.get("imageUrl")),
        isAvailable: form.get("isAvailable") === "on",
        sortOrder: product?.sortOrder ?? 0,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos guardar el producto.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="editor-dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      onClose={onClose}
      aria-labelledby="product-editor-title"
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">TU CARTA, A TU MANERA</p>
          <h2 id="product-editor-title">
            {product ? "Editar producto" : "Nuevo producto"}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Cerrar editor"
        >
          ×
        </button>
      </div>
      <form className="app-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <label>
              Nombre
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={product?.name}
                placeholder="Doble cheddar"
              />
            </label>
            <label>
              Categoría
              <input
                name="category"
                list="menu-categories"
                required
                maxLength={80}
                defaultValue={product?.category}
                placeholder="Hamburguesas"
              />
              <datalist id="menu-categories">
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </label>
          </div>
          <label>
            Descripción e ingredientes
            <textarea
              name="description"
              maxLength={1500}
              defaultValue={product?.description}
              rows={3}
              placeholder="Lo que incluye y lo que hace especial a este producto."
            />
          </label>
          <div className="form-grid">
            <label>
              Tipo
              <select name="kind" defaultValue={product?.kind ?? "product"}>
                <option value="product">Producto</option>
                <option value="combo">Combo o promoción</option>
              </select>
            </label>
            <label>
              URL de imagen <span className="optional-label">opcional</span>
              <input
                name="imageUrl"
                type="url"
                defaultValue={product?.imageUrl}
                placeholder="https://..."
              />
            </label>
          </div>
          <div className="section-label">
            <h3>Presentaciones y precios</h3>
            <button
              type="button"
              className="quiet-button"
              disabled={variants.length >= 20}
              onClick={() =>
                setVariants([
                  ...variants,
                  { id: crypto.randomUUID(), name: "", price: "" },
                ])
              }
            >
              + Agregar variante
            </button>
          </div>
          <p className="field-hint standalone-hint">
            Por ejemplo: única, simple/doble, 500 g/1 kg o media docena/docena.
            Precios en ARS.
          </p>
          {variants.map((v, i) => (
            <div className="option-editor" key={v.id}>
              <label>
                Presentación
                <input
                  value={v.name}
                  onChange={(e) =>
                    setVariants(
                      variants.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                  required
                  maxLength={80}
                />
              </label>
              <label>
                Precio ($)
                <input
                  inputMode="decimal"
                  value={v.price}
                  placeholder="6500"
                  onChange={(e) =>
                    setVariants(
                      variants.map((x, j) =>
                        j === i ? { ...x, price: e.target.value } : x,
                      ),
                    )
                  }
                  required
                />
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={`Quitar presentación ${i + 1}`}
                disabled={variants.length === 1}
                onClick={() => setVariants(variants.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <details className="extras-editor" open={addOns.length > 0}>
            <summary>Adicionales opcionales ({addOns.length})</summary>
            <p className="field-hint standalone-hint">
              Se pueden sumar una vez por unidad, con su propio precio.
            </p>
            {addOns.map((a, i) => (
              <div className="option-editor" key={a.id}>
                <label>
                  Adicional
                  <input
                    value={a.name}
                    required
                    maxLength={80}
                    onChange={(e) =>
                      setAddOns(
                        addOns.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Precio ($)
                  <input
                    inputMode="decimal"
                    value={a.price}
                    required
                    onChange={(e) =>
                      setAddOns(
                        addOns.map((x, j) =>
                          j === i ? { ...x, price: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Quitar adicional ${i + 1}`}
                  onClick={() => setAddOns(addOns.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="quiet-button"
              type="button"
              disabled={addOns.length >= 20}
              onClick={() =>
                setAddOns([
                  ...addOns,
                  { id: crypto.randomUUID(), name: "", price: "" },
                ])
              }
            >
              + Agregar adicional
            </button>
          </details>
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="isAvailable"
              defaultChecked={product?.isAvailable ?? true}
            />{" "}
            Disponible para vender
          </label>
        </fieldset>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
