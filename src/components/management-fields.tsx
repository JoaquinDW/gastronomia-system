"use client";
import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Product } from "@/lib/menu";
import type { StockItem, Supplier, Recipe } from "@/lib/management";
export const units = { g: "g", ml: "ml", unit: "un." };
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="mg-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{
              id: string;
              "aria-describedby"?: string;
            }>,
            { id, "aria-describedby": hint ? `${id}-hint` : undefined },
          )
        : children}
      {hint ? <small id={`${id}-hint`}>{hint}</small> : null}
    </div>
  );
}
export function SupplierSelect({ suppliers }: { suppliers: Supplier[] }) {
  return (
    <Field label="Proveedor">
      <select name="supplierId">
        <option value="">Sin proveedor</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function IngredientLines({
  items,
  initial = [],
  allowEmpty = false,
}: {
  items: StockItem[];
  initial?: { itemId: string; quantity: string }[];
  allowEmpty?: boolean;
}) {
  const [rows, setRows] = useState(() =>
    initial.length
      ? initial.map((l, i) => ({ ...l, key: `initial-${i}` }))
      : [{ key: "first", itemId: "", quantity: "" }],
  );
  return (
    <div className="mg-lines">
      {rows.map((row, i) => (
        <div className="mg-line mg-ingredient-line" key={row.key}>
          <input type="hidden" name="ingredient" value={row.key} />
          <Field label={`Insumo ${i + 1}`}>
            <select
              name={`ingredientItem-${row.key}`}
              defaultValue={row.itemId}
              required={!allowEmpty}
            >
              <option value="">Elegí un insumo</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({units[item.unit]})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cantidad en unidad base">
            <input
              name={`ingredientQuantity-${row.key}`}
              inputMode="decimal"
              required={!allowEmpty}
              defaultValue={row.quantity}
            />
          </Field>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setRows((old) => old.filter((r) => r.key !== row.key))
            }
          >
            Quitar<span className="sr-only"> insumo {i + 1}</span>
          </button>
        </div>
      ))}
      <button
        className="secondary-button"
        type="button"
        onClick={() =>
          setRows((old) => [
            ...old,
            { key: crypto.randomUUID(), itemId: "", quantity: "" },
          ])
        }
      >
        Agregar insumo
      </button>
    </div>
  );
}
export function RecipeEditor({
  products,
  recipes,
  items,
}: {
  products: Product[];
  recipes: Recipe[];
  items: StockItem[];
}) {
  const options = products.flatMap((p) => [
    ...p.variants.map((v) => ({
      value: `${p.id}:variant:${v.id}`,
      label: `${p.name} · ${v.name}`,
    })),
    ...p.addOns.map((a) => ({
      value: `${p.id}:addon:${a.id}`,
      label: `${p.name} · Adicional: ${a.name}`,
    })),
  ]);
  const [selected, setSelected] = useState(
    () =>
      options.find((o) => {
        const [productId, optionKind, optionId] = o.value.split(":");
        return !recipes.some(
          (r) =>
            r.productId === productId &&
            r.optionKind === optionKind &&
            r.optionId === optionId,
        );
      })?.value ??
      options[0]?.value ??
      "",
  );
  const [productId, kind, optionId] = selected.split(":"),
    recipe = recipes.find(
      (r) =>
        r.productId === productId &&
        r.optionId === optionId &&
        r.optionKind === kind,
    );
  return (
    <>
      <Field label="Producto y opción de la carta">
        <select
          name="option"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          required
        >
          {options.map((o) => (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <input type="hidden" name="version" value={recipe?.version ?? 0} />
      <RecipeConsumption
        key={`${selected}-${recipe?.version ?? 0}`}
        items={items}
        recipe={recipe}
        products={products}
        recipes={recipes}
        selected={selected}
      />
      <p className="mg-disclosure">
        Cargá lo que lleva una unidad vendida. Para una promo de dos especiales,
        agregá 2 × Especial en productos. Sus insumos se suman solos: no los
        vuelvas a cargar abajo. Podés agregar envases u otros extras. Si cambia
        la receta de la Especial, las próximas ventas de la promo usarán esa
        receta.
      </p>
    </>
  );
}
function RecipeConsumption({
  recipe,
  items,
  products,
  recipes,
  selected,
}: {
  recipe?: Recipe;
  items: StockItem[];
  products: Product[];
  recipes: Recipe[];
  selected: string;
}) {
  const [none, setNone] = useState(recipe?.noConsumption ?? false);
  return (
    <>
      <label className="mg-checkbox">
        <input
          type="checkbox"
          name="noConsumption"
          checked={none}
          onChange={(e) => setNone(e.target.checked)}
        />
        Esta opción no usa insumos ni agrega costos
      </label>
      {!none ? (
        <>
          <RecipeProductLines
            products={products}
            recipes={recipes}
            selected={selected}
            initial={recipe?.lines.filter((l) => "productId" in l) ?? []}
          />
          <h3>Insumos propios o extras</h3>
          <IngredientLines
            items={items}
            initial={recipe?.lines.filter((l) => "itemId" in l)}
            allowEmpty
          />
        </>
      ) : null}
    </>
  );
}
function RecipeProductLines({
  products,
  recipes,
  selected,
  initial,
}: {
  products: Product[];
  recipes: Recipe[];
  selected: string;
  initial: { productId: string; variantId: string; quantity: string }[];
}) {
  const [rows, setRows] = useState(() =>
    initial.map((line, i) => ({
      key: `initial-product-${i}`,
      option: `${line.productId}:${line.variantId}`,
      quantity: line.quantity,
    })),
  );
  const options = products.flatMap((p) =>
    p.variants
      .filter((v) => {
        const base = recipes.find(
          (r) =>
            r.productId === p.id &&
            r.optionId === v.id &&
            r.optionKind === "variant",
        );
        return (
          `${p.id}:variant:${v.id}` !== selected &&
          base &&
          base.lines.every((l) => "itemId" in l)
        );
      })
      .map((v) => ({
        value: `${p.id}:${v.id}`,
        label: `${p.name} · ${v.name}`,
      })),
  );
  return (
    <div className="mg-lines">
      <h3>Productos que incluye (para promos)</h3>
      {rows.map((row, i) => (
        <div className="mg-line mg-ingredient-line" key={row.key}>
          <input type="hidden" name="recipeProduct" value={row.key} />
          <Field label={`Producto incluido ${i + 1}`}>
            <select
              name={`recipeProduct-${row.key}`}
              defaultValue={row.option}
              required
            >
              <option value="">Elegí un producto con receta</option>
              {row.option && !options.some((o) => o.value === row.option) ? (
                <option value={row.option}>
                  Producto fuera de la carta o con receta pendiente
                </option>
              ) : null}
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Unidades del producto ${i + 1}`}>
            <input
              name={`recipeProductQuantity-${row.key}`}
              type="number"
              min="1"
              max="999"
              step="1"
              required
              defaultValue={row.quantity}
            />
          </Field>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setRows((old) => old.filter((r) => r.key !== row.key))
            }
          >
            Quitar<span className="sr-only"> producto {i + 1}</span>
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary-button"
        disabled={!options.length}
        onClick={() =>
          setRows((old) => [
            ...old,
            { key: crypto.randomUUID(), option: "", quantity: "1" },
          ])
        }
      >
        Agregar producto de la carta
      </button>
      {!options.length ? (
        <p className="mg-disclosure">
          Primero cargá los ingredientes de un producto para poder usarlo dentro
          de una promo.
        </p>
      ) : null}
    </div>
  );
}

export function PurchaseLines({ items }: { items: StockItem[] }) {
  const [rows, setRows] = useState([
    { key: "first", itemId: items[0]?.id ?? "" },
  ]);
  return (
    <div className="mg-lines">
      {rows.map((row, index) => {
        const item = items.find((i) => i.id === row.itemId);
        return (
          <div className="mg-line mg-purchase-line" key={row.key}>
            <input type="hidden" name="row" value={row.key} />
            <Field label={`Insumo ${index + 1}`}>
              <select
                name={`item-${row.key}`}
                required
                value={row.itemId}
                onChange={(e) =>
                  setRows((old) =>
                    old.map((r) =>
                      r.key === row.key ? { ...r, itemId: e.target.value } : r,
                    ),
                  )
                }
              >
                {items.map((i) => (
                  <option value={i.id} key={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cantidad">
              <input
                name={`quantity-${row.key}`}
                inputMode="decimal"
                required
              />
            </Field>
            <Field label="Unidad de compra">
              <select key={row.itemId} name={`unit-${row.key}`}>
                <option value={item?.unit}>
                  {item ? units[item.unit] : "Unidad"}
                </option>
                {item?.unit === "g" ? (
                  <option value="kg">kg</option>
                ) : item?.unit === "ml" ? (
                  <option value="l">litros</option>
                ) : null}
                <option value="pack">Presentación / paquete</option>
              </select>
            </Field>
            <Field
              label={`Contenido por presentación (${item ? units[item.unit] : ""})`}
              hint="Se usa solo al elegir presentación."
            >
              <input
                name={`factor-${row.key}`}
                inputMode="decimal"
                defaultValue="1"
                required
              />
            </Field>
            <Field label="Costo total de la línea ($)">
              <input name={`total-${row.key}`} inputMode="decimal" required />
            </Field>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setRows((old) => old.filter((r) => r.key !== row.key))
              }
            >
              Quitar<span className="sr-only"> línea {index + 1}</span>
            </button>
          </div>
        );
      })}
      <button
        className="secondary-button"
        type="button"
        onClick={() =>
          setRows((old) => [
            ...old,
            { key: crypto.randomUUID(), itemId: items[0]?.id ?? "" },
          ])
        }
      >
        Agregar línea de compra
      </button>
    </div>
  );
}
export function SaleLines({ products }: { products: Product[] }) {
  const [rows, setRows] = useState(["first"]);
  return (
    <div className="mg-lines">
      {rows.map((key, i) => (
        <SaleRow
          key={key}
          rowKey={key}
          index={i}
          products={products}
          remove={() => setRows((old) => old.filter((r) => r !== key))}
        />
      ))}
      <button
        className="secondary-button"
        type="button"
        onClick={() => setRows((old) => [...old, crypto.randomUUID()])}
      >
        Agregar producto
      </button>
    </div>
  );
}
function SaleRow({
  rowKey,
  index,
  products,
  remove,
}: {
  rowKey: string;
  index: number;
  products: Product[];
  remove: () => void;
}) {
  const [selected, setSelected] = useState(
      `${products[0]?.id}:${products[0]?.variants[0]?.id}`,
    ),
    [addOns, setAddOns] = useState<string[]>([]);
  const [pId, vId] = selected.split(":"),
    product = products.find((p) => p.id === pId),
    variant = product?.variants.find((v) => v.id === vId);
  const suggested =
    (variant?.priceCents ?? 0) +
    (product?.addOns
      .filter((a) => addOns.includes(a.id))
      .reduce((n, a) => n + a.priceCents, 0) ?? 0);
  return (
    <div className="mg-line mg-sale-line">
      <input type="hidden" name="saleRow" value={rowKey} />
      <Field label={`Producto ${index + 1}`}>
        <select
          name={`option-${rowKey}`}
          value={selected}
          required
          onChange={(e) => {
            setSelected(e.target.value);
            setAddOns([]);
          }}
        >
          {products.flatMap((p) =>
            p.variants.map((v) => (
              <option value={`${p.id}:${v.id}`} key={`${p.id}:${v.id}`}>
                {p.name} · {v.name}
              </option>
            )),
          )}
        </select>
      </Field>
      <Field label="Unidades">
        <input
          name={`quantity-${rowKey}`}
          type="number"
          min="1"
          max="1000"
          required
          defaultValue="1"
        />
      </Field>
      <Field label="Precio por unidad vendido ($)">
        <input
          key={`${selected}-${addOns.join(",")}`}
          name={`price-${rowKey}`}
          inputMode="decimal"
          required
          defaultValue={(suggested / 100).toFixed(2).replace(".", ",")}
        />
      </Field>
      {product?.addOns.length ? (
        <div className="mg-sale-addons">
          {product.addOns.map((a) => (
            <label className="mg-checkbox" key={a.id}>
              <input
                type="checkbox"
                name={`addons-${rowKey}`}
                value={a.id}
                checked={addOns.includes(a.id)}
                onChange={(e) =>
                  setAddOns((old) =>
                    e.target.checked
                      ? [...old, a.id]
                      : old.filter((id) => id !== a.id),
                  )
                }
              />
              {a.name}
            </label>
          ))}
        </div>
      ) : null}
      <button className="text-button" type="button" onClick={remove}>
        Quitar<span className="sr-only"> producto {index + 1}</span>
      </button>
    </div>
  );
}
