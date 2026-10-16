"use client";
import type { Product } from "@/lib/menu";
import {
  expenseCategories,
  type ManagementData,
  type StockItem,
  type Supplier,
  type Movement,
  type Sale,
} from "@/lib/management";
import { decimal, fixed, money } from "@/lib/management-math";
import {
  Field,
  SupplierSelect,
  IngredientLines,
  RecipeEditor,
  PurchaseLines,
  SaleLines,
  units,
} from "./management-fields";

export type ManagementEditor =
  | { type: "item"; item?: StockItem }
  | { type: "supplier"; supplier?: Supplier }
  | {
      type: "adjustment";
      item: StockItem;
      referenceId?: string;
      costOnly?: boolean;
    }
  | { type: "purchase" | "recipe" | "production" | "sale" | "expense" }
  | { type: "cancel_sale"; sale: Sale; movements: Movement[] }
  | { type: "reverse_expense"; id: string };
export const editorTitles = {
  item: "Insumo o producto preparado",
  supplier: "Proveedor",
  adjustment: "Actualizar stock o registrar pérdida",
  purchase: "Registrar compra",
  recipe: "Ingredientes de un producto",
  production: "Registrar preparación",
  sale: "Registrar venta manual",
  expense: "Registrar gasto",
  cancel_sale: "Anular venta",
  reverse_expense: "Anular gasto",
};
export function EditorFields({
  editor,
  data,
  products,
}: {
  editor: ManagementEditor;
  data: ManagementData;
  products: Product[];
}) {
  switch (editor.type) {
    case "item":
      return (
        <div className="mg-form-grid">
          <Field label="Nombre">
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={editor.item?.name}
              placeholder="Carne picada"
            />
          </Field>
          <Field label="Tipo">
            <select
              name="kind"
              defaultValue={editor.item?.kind ?? "ingredient"}
              disabled={!!editor.item}
            >
              <option value="ingredient">Insumo</option>
              <option value="finished">Producto ya preparado</option>
            </select>
          </Field>
          <Field label="Unidad base">
            <select
              name="unit"
              defaultValue={editor.item?.unit ?? "g"}
              disabled={!!editor.item}
            >
              <option value="g">Gramos (g)</option>
              <option value="ml">Mililitros (ml)</option>
              <option value="unit">Unidades</option>
            </select>
          </Field>
          <Field label="Stock mínimo">
            <input
              name="minimum"
              inputMode="decimal"
              required
              defaultValue={
                editor.item ? decimal(fixed(editor.item.minimum)) : "0"
              }
            />
          </Field>
          {!editor.item ? (
            <>
              <Field
                label="Cantidad que tenés ahora"
                hint="Cantidad en la unidad base elegida."
              >
                <input
                  name="initialQuantity"
                  inputMode="decimal"
                  required
                  defaultValue="0"
                />
              </Field>
              <Field
                label="Cuánto te costó todo ese stock ($)"
                hint="Opcional. Dejalo vacío si no conocés el costo."
              >
                <input
                  name="initialValue"
                  inputMode="decimal"
                  placeholder="Sin separador de miles; ej. 12500,50"
                />
              </Field>
            </>
          ) : null}
        </div>
      );
    case "supplier":
      return (
        <div className="mg-form-grid">
          <Field label="Nombre">
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={editor.supplier?.name}
            />
          </Field>
          <Field label="Contacto">
            <input
              name="contact"
              maxLength={200}
              defaultValue={editor.supplier?.contact}
              placeholder="Teléfono, email o persona de contacto"
            />
          </Field>
          <Field label="Notas">
            <textarea
              name="note"
              maxLength={500}
              defaultValue={editor.supplier?.note}
            />
          </Field>
        </div>
      );
    case "adjustment":
      return (
        <>
          <p>
            {editor.item.name} · {units[editor.item.unit]} · Stock actual:{" "}
            {decimal(fixed(editor.item.quantity))}
          </p>
          {editor.referenceId ? (
            <p className="mg-disclosure">
              Este ajuste queda vinculado a la operación original. El registro
              anterior se conserva. Para corregir una preparación, ajustá
              también los insumos afectados desde Inventario.
            </p>
          ) : null}
          <div className="mg-form-grid">
            {editor.costOnly ? (
              <input type="hidden" name="mode" value="count" />
            ) : (
              <Field label="Qué vas a registrar">
                <select name="mode">
                  <option value="count">Actualizar cuánto stock queda</option>
                  <option value="waste">
                    Pérdida: descontar cantidad perdida
                  </option>
                </select>
              </Field>
            )}
            <Field
              label={`Cantidad (${units[editor.item.unit]})`}
              hint={
                editor.costOnly
                  ? "Revisá la cantidad que tenés. El costo se calcula con este stock."
                  : "Si actualizás stock: cuánto queda. Si registrás una pérdida: cuánto se perdió."
              }
            >
              <input
                name="quantity"
                inputMode="decimal"
                required
                defaultValue={
                  editor.costOnly
                    ? decimal(fixed(editor.item.quantity))
                    : undefined
                }
              />
            </Field>
            <Field
              label="Cuánto te costó todo este stock ($)"
              hint={
                editor.costOnly
                  ? "Ingresá el costo total de la cantidad indicada arriba. Ejemplo: si tenés 5 kg y pagaste $ 40.000, ingresá 40000."
                  : "Solo si actualizás stock. Dejalo vacío para mantener el costo anterior."
              }
            >
              <input
                name="totalValue"
                inputMode="decimal"
                required={editor.costOnly}
              />
            </Field>
            <Field label="Motivo">
              <textarea
                name="reason"
                required
                minLength={3}
                maxLength={500}
                defaultValue={
                  editor.costOnly ? "Carga de costo del insumo" : undefined
                }
              />
            </Field>
          </div>
        </>
      );
    case "purchase":
      return (
        <>
          {!data.items.length ? (
            <p>
              Cargá al menos un insumo en Inventario para registrar una compra.
            </p>
          ) : (
            <>
              <SupplierSelect suppliers={data.suppliers} />
              <PurchaseLines items={data.items} />
              <Field label="Notas de la compra">
                <textarea name="note" maxLength={500} />
              </Field>
            </>
          )}
        </>
      );
    case "recipe":
      return (
        <RecipeEditor
          products={products}
          recipes={data.recipes}
          items={data.items}
        />
      );
    case "production":
      return (
        <>
          <div className="mg-form-grid">
            <Field label="Producto ya preparado obtenido">
              <select name="outputItemId" required>
                <option value="">Elegí el producto preparado</option>
                {data.items
                  .filter((i) => i.kind === "finished")
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({units[i.unit]})
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Cantidad real obtenida">
              <input
                name="outputQuantity"
                inputMode="decimal"
                required
                placeholder="Ej. 50"
              />
            </Field>
          </div>
          <h3>Ingredientes utilizados en esta tanda</h3>
          <IngredientLines
            items={data.items.filter((i) => i.kind === "ingredient")}
          />
          <Field label="Notas de preparación">
            <textarea name="note" maxLength={500} />
          </Field>
        </>
      );
    case "sale":
      return (
        <>
          <div className="mg-form-grid">
            <Field label="Dónde vendiste">
              <select name="channel">
                <option value="counter">Mostrador</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="other">Otros</option>
              </select>
            </Field>
            <Field label="Cargo de envío cobrado ($)">
              <input name="delivery" inputMode="decimal" defaultValue="0" />
            </Field>
          </div>
          {products.length ? (
            <SaleLines products={products} />
          ) : (
            <p>Agregá productos en Carta antes de registrar ventas.</p>
          )}
          <Field label="Nota o referencia">
            <input name="note" maxLength={500} />
          </Field>
          <p className="mg-disclosure">
            Registrá el precio por unidad efectivamente vendido, con sus
            adicionales incluidos. No vuelvas a cargar pedidos que ya aceptaste
            desde la tienda. El cobro se verifica por separado.
          </p>
        </>
      );
    case "expense":
      return (
        <>
          <div className="mg-form-grid">
            <Field label="Fecha del gasto">
              <input
                type="date"
                name="date"
                required
                defaultValue={data.today}
              />
            </Field>
            <Field label="Categoría">
              <select name="category">
                {expenseCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Qué pagaste">
              <input
                name="concept"
                required
                minLength={2}
                maxLength={120}
                placeholder="Alquiler de octubre"
              />
            </Field>
            <Field
              label="Importe ($)"
              hint="Pesos sin separador de miles. Coma para centavos."
            >
              <input name="amount" inputMode="decimal" required />
            </Field>
            <SupplierSelect suppliers={data.suppliers} />
            <Field label="Notas">
              <textarea name="note" maxLength={500} />
            </Field>
          </div>
          <p className="mg-disclosure">
            Las compras de insumos se registran en Compras para evitar
            descontarlas dos veces del resultado.
          </p>
        </>
      );
    case "reverse_expense":
      return (
        <>
          <p>
            El gasto se conserva en el historial. El importe deja de contar como
            gasto desde hoy.
          </p>
          <Field label="Motivo de anulación">
            <textarea name="reason" required minLength={3} maxLength={500} />
          </Field>
        </>
      );
    case "cancel_sale":
      return (
        <>
          <p>
            Se anula la venta de {money(editor.sale.totalCents)}. Indicá qué
            recuperaste físicamente; el resto queda como pérdida sin descontarse
            dos veces del stock.
          </p>
          {!editor.sale.costComplete ? (
            <p className="mg-notice">
              A esta venta le faltan ingredientes o costos. No podemos calcular
              toda la pérdida; revisá cuánto stock te queda.
            </p>
          ) : null}
          {editor.movements.length ? (
            <div className="mg-recoveries">
              {editor.movements.map((m) => (
                <Field
                  key={m.id}
                  label={`${m.itemName} · usado: ${decimal(-fixed(m.quantity))}`}
                  hint="Cantidad recuperada; 0 si ya se utilizó y no puede volver al stock."
                >
                  <input
                    name={`recovery-${m.id}`}
                    inputMode="decimal"
                    required
                    defaultValue="0"
                  />
                </Field>
              ))}
            </div>
          ) : (
            <p className="mg-disclosure">
              No hay ingredientes registrados para volver a sumar al stock.
            </p>
          )}
          <Field label="Motivo de anulación">
            <textarea name="reason" required minLength={3} maxLength={500} />
          </Field>
        </>
      );
  }
}
