"use client";
import { useEffect, useRef, useState } from "react";
import {
  moneyToCents,
  priceInputValue,
  type Product,
  type ProductInput,
} from "@/lib/menu";
import { ProductPhotoField } from "./product-photo-field";
type OptionRow = { id: string; name: string; price: string };
type GroupRow = {
  id: string;
  name: string;
  min: string;
  max: string;
  repeat: boolean;
  options: OptionRow[];
};
const newOption = (): OptionRow => ({
  id: crypto.randomUUID(),
  name: "",
  price: "0",
});
export function ProductEditor({
  businessId,
  product,
  categories,
  onSave,
  onClose,
}: {
  businessId: string;
  product?: Product;
  categories: string[];
  onSave: (p: ProductInput) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [imageFocus, setImageFocus] = useState({
    x: product?.imageFocusX ?? 50,
    y: product?.imageFocusY ?? 50,
  });
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
  const [groups, setGroups] = useState<GroupRow[]>(
    () =>
      product?.optionGroups?.map((g) => ({
        id: g.id,
        name: g.name,
        min: String(g.min),
        max: String(g.max),
        repeat: g.repeat,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          price: priceInputValue(o.priceCents),
        })),
      })) ?? [],
  );
  const updateGroup = (i: number, change: Partial<GroupRow>) =>
    setGroups(groups.map((g, j) => (j === i ? { ...g, ...change } : g)));
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
    const optionGroups = groups.map((g) => ({
      id: g.id,
      name: g.name.trim(),
      min: Number(g.min),
      max: Number(g.max),
      repeat: g.repeat,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceCents: moneyToCents(o.price),
      })),
    }));
    if (
      prices.some((v) => v.priceCents === null || !v.name.trim()) ||
      extras.some((v) => v.priceCents === null || !v.name.trim()) ||
      optionGroups.some((g) =>
        g.options.some((o) => o.priceCents === null || !o.name.trim()),
      )
    ) {
      setError(
        "Cada variante, adicional y opción necesita un nombre y un precio válido en pesos.",
      );
      return;
    }
    const invalidGroup = optionGroups.find(
      (g) =>
        !g.name ||
        !g.options.length ||
        !Number.isInteger(g.min) ||
        !Number.isInteger(g.max) ||
        g.min < 0 ||
        g.max < 1 ||
        g.max > 50 ||
        g.min > g.max ||
        (!g.repeat && g.max > g.options.length),
    );
    if (invalidGroup) {
      setError(
        invalidGroup.name
          ? `Revisá «${invalidGroup.name}»: necesita al menos una opción, y el mínimo no puede superar al máximo. Sin repetir, el máximo no puede superar la cantidad de opciones.`
          : "Cada grupo de opciones necesita un nombre, como «Elegí la salsa».",
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
        optionGroups: optionGroups as ProductInput["optionGroups"],
        imageUrl,
        imageFocusX: imageFocus.x,
        imageFocusY: imageFocus.y,
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
        if (busy || uploading) e.preventDefault();
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
          <ProductPhotoField
            businessId={businessId}
            value={imageUrl}
            onChange={setImageUrl}
            focus={imageFocus}
            onFocusChange={setImageFocus}
            onBusyChange={setUploading}
            disabled={busy}
          />
          <label>
            Tipo
            <select name="kind" defaultValue={product?.kind ?? "product"}>
              <option value="product">Producto</option>
              <option value="combo">Combo o promoción</option>
            </select>
          </label>
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
          <details className="extras-editor" open={groups.length > 0}>
            <summary>Opciones para elegir ({groups.length})</summary>
            <p className="field-hint standalone-hint">
              Para lo que el cliente tiene que elegir antes de pedir: la salsa,
              el punto de la carne, la bebida del combo o los gustos de la
              docena. Con mínimo 0 la elección es opcional.
            </p>
            {groups.map((g, i) => (
              <fieldset className="option-group-editor" key={g.id}>
                <div className="option-group-heading">
                  <label>
                    Nombre del grupo
                    <input
                      value={g.name}
                      required
                      maxLength={80}
                      placeholder="Elegí la salsa"
                      onChange={(e) => updateGroup(i, { name: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Quitar grupo ${g.name || i + 1}`}
                    onClick={() => setGroups(groups.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
                <div className="option-group-rules">
                  <label>
                    Mínimo
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={50}
                      required
                      value={g.min}
                      onChange={(e) => updateGroup(i, { min: e.target.value })}
                    />
                  </label>
                  <label>
                    Máximo
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={50}
                      required
                      value={g.max}
                      onChange={(e) => updateGroup(i, { max: e.target.value })}
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={g.repeat}
                      onChange={(e) =>
                        updateGroup(i, { repeat: e.target.checked })
                      }
                    />
                    Se puede repetir la misma opción
                  </label>
                </div>
                {g.options.map((o, k) => (
                  <div className="option-editor" key={o.id}>
                    <label>
                      Opción
                      <input
                        value={o.name}
                        required
                        maxLength={80}
                        placeholder="Fileto"
                        onChange={(e) =>
                          updateGroup(i, {
                            options: g.options.map((x, j) =>
                              j === k ? { ...x, name: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Precio extra ($)
                      <input
                        inputMode="decimal"
                        value={o.price}
                        required
                        onChange={(e) =>
                          updateGroup(i, {
                            options: g.options.map((x, j) =>
                              j === k ? { ...x, price: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Quitar opción ${o.name || k + 1}`}
                      disabled={g.options.length === 1}
                      onClick={() =>
                        updateGroup(i, {
                          options: g.options.filter((_, j) => j !== k),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  className="quiet-button"
                  type="button"
                  disabled={g.options.length >= 30}
                  onClick={() =>
                    updateGroup(i, { options: [...g.options, newOption()] })
                  }
                >
                  + Agregar opción
                </button>
              </fieldset>
            ))}
            <button
              className="quiet-button"
              type="button"
              disabled={groups.length >= 10}
              onClick={() =>
                setGroups([
                  ...groups,
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    min: "1",
                    max: "1",
                    repeat: false,
                    options: [newOption()],
                  },
                ])
              }
            >
              + Agregar grupo de opciones
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
            disabled={busy || uploading}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={busy || uploading}
          >
            {busy ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
