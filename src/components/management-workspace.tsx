"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/menu";
import type { ManagementData, Sale } from "@/lib/management";
import { pesosToCents } from "@/lib/management-math";
import {
  EditorFields,
  editorTitles,
  type ManagementEditor,
} from "./management-editor";
import { ManagementTables } from "./management-tables";
import { Field } from "./management-fields";

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function quantity(form: FormData, key: string) {
  return text(form, key).replace(",", ".");
}
function optionalMoney(form: FormData, key: string) {
  return text(form, key) ? pesosToCents(text(form, key)) : null;
}
export function ManagementWorkspace({
  businessId,
  section,
  initialData,
  products,
  owner,
}: {
  businessId: string;
  section: string;
  initialData: ManagementData;
  products: Product[];
  owner: boolean;
}) {
  const router = useRouter(),
    base = `/api/businesses/${businessId}/management`;
  const [data, setData] = useState(initialData),
    [editor, setEditor] = useState<ManagementEditor | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [search, setSearch] = useState("");
  const [pages, setPages] = useState({ sales: 0, movements: 0, operations: 0 });
  const [editorSession, setEditorSession] = useState(0);
  const pending = useRef<{ body: string; key: string } | null>(null),
    formHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setData(initialData);
    setPages({ sales: 0, movements: 0, operations: 0 });
  }, [initialData]);
  useEffect(() => {
    if (editor) formHeading.current?.focus();
  }, [editor]);
  function open(value: ManagementEditor) {
    if (busy) return;
    setEditorSession((session) => session + 1);
    setEditor(value);
    setError("");
    setMessage("");
    pending.current = null;
  }
  async function refresh() {
    const r = await fetch(base, { cache: "no-store" }),
      d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setData(d);
    setPages({ sales: 0, movements: 0, operations: 0 });
  }
  async function run(command: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    const body = JSON.stringify(command);
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...command, requestKey: pending.current.key }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setEditor(null);
      const warnings: string[] = result.warnings ?? [];
      setMessage(
        `Listo, quedó registrado.${warnings.length ? ` Atención: ${warnings.join("; ")}.` : ""}${result.costComplete === false || result.incomplete ? " Faltan costos por completar." : ""}`,
      );
      try {
        await refresh();
        router.refresh();
      } catch {
        setError(
          "La operación está guardada. No pudimos actualizar la lista; usá Actualizar.",
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos guardar. Revisá la conexión y volvé a intentar.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor || busy) return;
    const f = new FormData(e.currentTarget);
    try {
      switch (editor.type) {
        case "item":
          await run({
            type: "item",
            ...(editor.item
              ? { id: editor.item.id, version: editor.item.version }
              : {}),
            name: text(f, "name"),
            kind: editor.item?.kind ?? text(f, "kind"),
            unit: editor.item?.unit ?? text(f, "unit"),
            minimum: quantity(f, "minimum"),
            initialQuantity: editor.item ? "0" : quantity(f, "initialQuantity"),
            initialValueCents: editor.item
              ? null
              : optionalMoney(f, "initialValue"),
          });
          break;
        case "supplier":
          await run({
            type: "supplier",
            ...(editor.supplier
              ? { id: editor.supplier.id, version: editor.supplier.version }
              : {}),
            name: text(f, "name"),
            contact: text(f, "contact"),
            note: text(f, "note"),
          });
          break;
        case "adjustment":
          await run({
            type: "adjustment",
            itemId: editor.item.id,
            version: editor.item.version,
            mode: text(f, "mode"),
            quantity: quantity(f, "quantity"),
            totalValueCents: optionalMoney(f, "totalValue"),
            reason: text(f, "reason"),
            referenceId: editor.referenceId ?? null,
          });
          break;
        case "purchase":
          await run({
            type: "purchase",
            supplierId: text(f, "supplierId") || null,
            note: text(f, "note"),
            lines: f.getAll("row").map((k) => ({
              itemId: text(f, `item-${k}`),
              quantity: quantity(f, `quantity-${k}`),
              unit: text(f, `unit-${k}`),
              factor: quantity(f, `factor-${k}`) || "1",
              totalCents: pesosToCents(text(f, `total-${k}`)),
            })),
          });
          break;
        case "recipe": {
          const [productId, optionKind, optionId] = text(f, "option").split(
            ":",
          );
          await run({
            type: "recipe",
            productId,
            optionKind,
            optionId,
            version: Number(text(f, "version")),
            noConsumption: f.has("noConsumption"),
            lines: f.has("noConsumption")
              ? []
              : f.getAll("ingredient").map((k) => ({
                  itemId: text(f, `ingredientItem-${k}`),
                  quantity: quantity(f, `ingredientQuantity-${k}`),
                })),
          });
          break;
        }
        case "production":
          await run({
            type: "production",
            outputItemId: text(f, "outputItemId"),
            outputQuantity: quantity(f, "outputQuantity"),
            note: text(f, "note"),
            lines: f.getAll("ingredient").map((k) => ({
              itemId: text(f, `ingredientItem-${k}`),
              quantity: quantity(f, `ingredientQuantity-${k}`),
            })),
          });
          break;
        case "sale":
          await run({
            type: "sale",
            channel: text(f, "channel"),
            deliveryCents: optionalMoney(f, "delivery") ?? "0",
            note: text(f, "note"),
            lines: f.getAll("saleRow").map((k) => {
              const [productId, variantId] = text(f, `option-${k}`).split(":");
              return {
                productId,
                variantId,
                addOnIds: f.getAll(`addons-${k}`).map(String),
                quantity: Number(text(f, `quantity-${k}`)),
                unitCents: pesosToCents(text(f, `price-${k}`)),
              };
            }),
          });
          break;
        case "expense":
          await run({
            type: "expense",
            date: text(f, "date"),
            category: text(f, "category"),
            amountCents: pesosToCents(text(f, "amount")),
            concept: text(f, "concept"),
            supplierId: text(f, "supplierId") || null,
            note: text(f, "note"),
          });
          break;
        case "reverse_expense":
          await run({
            type: "reverse_expense",
            expenseId: editor.id,
            reason: text(f, "reason"),
          });
          break;
        case "cancel_sale":
          await run({
            type: "cancel_sale",
            saleId: editor.sale.id,
            reason: text(f, "reason"),
            recoveries: editor.movements.map((m) => ({
              movementId: m.id,
              quantity: quantity(f, `recovery-${m.id}`),
            })),
          });
          break;
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Revisá los datos del formulario.",
      );
    }
  }
  async function cancelSale(sale: Sale) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${base}?view=consumptions&saleId=${sale.id}`),
        movements = await r.json();
      if (!r.ok) throw new Error(movements.error);
      open({ type: "cancel_sale", sale, movements });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos cargar los consumos.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function more(kind: "sales" | "movements" | "operations") {
    setBusy(true);
    setError("");
    const next = pages[kind] + (kind === "movements" ? 100 : 50);
    try {
      const r = await fetch(`${base}?${kind}Offset=${next}`),
        d: ManagementData & { error?: string } = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData((old) => ({
        ...old,
        [kind]: [...old[kind], ...d[kind]],
        [`${kind}HasMore`]: d[`${kind}HasMore`],
      }));
      setPages((old) => ({ ...old, [kind]: next }));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos cargar más registros.",
      );
    } finally {
      setBusy(false);
    }
  }
  const labels = {
    inventario: "Agregar insumo",
    proveedores: "Agregar proveedor",
    compras: "Registrar compra",
    gastos: "Registrar gasto",
    recetas: "Configurar receta",
    ventas: "Registrar venta",
  };
  const cannotCreate =
    (section === "compras" && !data.items.length) ||
    (section === "recetas" && !products.length) ||
    (section === "ventas" && !products.length);
  return (
    <div className="mg-workspace">
      {section !== "resultados" ? (
        <div className="mg-toolbar">
          <div>
            {section === "inventario" ? (
              <label className="mg-search">
                Buscar insumo
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Carne, pan, envases…"
                />
              </label>
            ) : (
              <p>
                {section === "ventas"
                  ? "Una venta confirmada descuenta stock y conserva su costo."
                  : section === "recetas"
                    ? "Consumos por unidad vendida y registro de cada tanda."
                    : "Cada registro conserva su fecha y responsable."}
              </p>
            )}
          </div>
          <div className="mg-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={async () => {
                setError("");
                try {
                  await refresh();
                } catch {
                  setError(
                    "No pudimos actualizar. Revisá la conexión y reintentá.",
                  );
                }
              }}
            >
              Actualizar
            </button>
            {section === "recetas" ? (
              <button
                className="secondary-button"
                onClick={() => open({ type: "production" })}
                disabled={
                  busy || !data.items.some((i) => i.kind === "finished")
                }
              >
                Registrar elaboración
              </button>
            ) : null}
            <button
              className={
                editor ? "secondary-button" : "primary-button compact-button"
              }
              disabled={busy || cannotCreate}
              onClick={() =>
                open({
                  type:
                    section === "inventario"
                      ? "item"
                      : section === "proveedores"
                        ? "supplier"
                        : section === "compras"
                          ? "purchase"
                          : section === "gastos"
                            ? "expense"
                            : section === "recetas"
                              ? "recipe"
                              : "sale",
                })
              }
            >
              {labels[section as keyof typeof labels]}
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p className="mg-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {editor ? (
        <section className="mg-editor" aria-labelledby="management-form-title">
          <div className="mg-section-heading">
            <h2 ref={formHeading} tabIndex={-1} id="management-form-title">
              {editorTitles[editor.type]}
            </h2>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setEditor(null);
                setError("");
              }}
            >
              Cerrar formulario
            </button>
          </div>
          <form key={editorSession} className="mg-form" onSubmit={submit}>
            <fieldset disabled={busy}>
              <EditorFields editor={editor} data={data} products={products} />
              <div className="mg-form-actions">
                <button className="primary-button compact-button" type="submit">
                  {busy
                    ? "Guardando…"
                    : editor.type === "cancel_sale" ||
                        editor.type === "reverse_expense"
                      ? "Confirmar anulación"
                      : "Guardar y confirmar"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setEditor(null);
                    setError("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      ) : null}
      <ManagementTables
        section={section}
        data={data}
        products={products}
        search={search}
        businessId={businessId}
        busy={busy}
        open={open}
        cancelSale={cancelSale}
        more={more}
      />
      {section === "resultados" && owner ? (
        <details className="mg-settings">
          <summary>Configurar el cierre de jornada</summary>
          <form
            className="mg-date-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run({
                type: "settings",
                cutoffHour: Number(f.get("cutoffHour")),
                version: data.settings.version,
              });
            }}
          >
            <Field label="La jornada termina a las">
              <select name="cutoffHour" defaultValue={data.settings.cutoffHour}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option value={h} key={h}>
                    {h.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </Field>
            <button className="secondary-button" disabled={busy}>
              Guardar horario
            </button>
          </form>
          <p className="mg-disclosure">
            Zona horaria: {data.settings.timezone}. El cambio se aplica a
            operaciones nuevas; las jornadas ya registradas se conservan.
          </p>
        </details>
      ) : null}
    </div>
  );
}
