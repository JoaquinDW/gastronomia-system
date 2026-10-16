import type { ReactNode } from "react";
import Link from "next/link";
import type { Product } from "@/lib/menu";
import {
  channels,
  type ManagementData,
  type StockItem,
  type Movement,
  type Sale,
} from "@/lib/management";
import {
  costOf,
  decimal,
  fixed,
  money,
  formatManagementDate,
} from "@/lib/management-math";
import type { ManagementEditor } from "./management-editor";
import { Field, units } from "./management-fields";
import { panelBase } from "@/lib/hosts";

const movementNames: Record<string, string> = {
  opening: "Stock inicial",
  purchase: "Compra",
  production_input: "Insumos utilizados",
  production_output: "Preparación",
  sale: "Venta",
  recovery: "Recuperación",
  waste: "Pérdida",
  adjustment: "Stock actualizado",
};
function localTime(date: string, timezone: string) {
  return formatManagementDate(date, timezone);
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mg-empty">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
function formatUnitCost(cents: string) {
  return `$ ${decimal(fixed(cents) / 100n).replace(".", ",")}`;
}
type Props = {
  section: string;
  data: ManagementData;
  products: Product[];
  search: string;
  businessId: string;
  busy: boolean;
  open: (e: ManagementEditor) => void;
  cancelSale: (sale: Sale) => void;
  more: (kind: "sales" | "movements" | "operations") => void;
};
export function ManagementTables({
  section,
  data,
  products,
  search,
  businessId,
  busy,
  open,
  cancelSale,
  more,
}: Props) {
  if (section === "inventario") {
    const visible = data.items.filter((i) =>
      i.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")),
    );
    return (
      <>
        <p className="mg-disclosure">
          El stock se descuenta al confirmar ventas y preparaciones. Los
          negativos se permiten y quedan señalados. Los costos son por unidad
          base.
        </p>
        {!data.items.length ? (
          <Empty title="Empezá por lo que tenés en la cocina.">
            Cargá insumos, envases y productos ya preparados. Si conocés el
            valor del stock que tenés, ya podés estimar tus costos.
          </Empty>
        ) : (
          <div className="mg-table-wrap mg-paper">
            <table>
              <thead>
                <tr>
                  <th>Insumo / producto preparado</th>
                  <th>Stock actual</th>
                  <th>Mínimo</th>
                  <th>Costo por unidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id}>
                    <th>
                      {i.name}
                      <small>
                        {i.kind === "finished"
                          ? "Producto ya preparado"
                          : "Insumo"}
                      </small>
                    </th>
                    <td>
                      <strong
                        className={fixed(i.quantity) < 0n ? "mg-negative" : ""}
                      >
                        {decimal(fixed(i.quantity))} {units[i.unit]}
                      </strong>
                      {fixed(i.quantity) <= fixed(i.minimum) ? (
                        <small className="mg-stock-alert">
                          {fixed(i.quantity) < 0n
                            ? "Stock negativo · revisar"
                            : "Para reponer"}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      {decimal(fixed(i.minimum))} {units[i.unit]}
                    </td>
                    <td>
                      {i.unitCost === null ? (
                        <>
                          <span>Sin costo cargado</span>
                          {fixed(i.quantity) > 0n ? (
                            <button
                              className="text-button"
                              onClick={() =>
                                open({
                                  type: "adjustment",
                                  item: i,
                                  costOnly: true,
                                })
                              }
                            >
                              Cargar costo
                              <span className="sr-only"> de {i.name}</span>
                            </button>
                          ) : (
                            <small>
                              Registrá una compra para cargar su costo.
                            </small>
                          )}
                        </>
                      ) : (
                        <>
                          {formatUnitCost(i.unitCost)} / {units[i.unit]}
                        </>
                      )}
                    </td>
                    <td>
                      <div className="mg-row-actions">
                        <button
                          className="text-button"
                          onClick={() => open({ type: "adjustment", item: i })}
                        >
                          Actualizar stock / pérdidas
                          <span className="sr-only"> de {i.name}</span>
                        </button>
                        <button
                          className="text-button"
                          onClick={() => open({ type: "item", item: i })}
                        >
                          Editar<span className="sr-only"> {i.name}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length ? (
              <p className="mg-muted">No hay insumos con ese nombre.</p>
            ) : null}
          </div>
        )}
        <section className="mg-movement-section">
          <div className="mg-section-heading">
            <h2>Historial de movimientos</h2>
          </div>
          <form
            className="mg-export-form"
            action={`/api/businesses/${businessId}/management`}
          >
            <input type="hidden" name="view" value="export-movements" />
            <Field label="Desde">
              <input
                type="date"
                name="from"
                defaultValue={`${data.today.slice(0, 7)}-01`}
                required
              />
            </Field>
            <Field label="Hasta">
              <input type="date" name="to" defaultValue={data.today} required />
            </Field>
            <button className="secondary-button">
              Exportar movimientos CSV
            </button>
          </form>
          <MovementTable
            movements={data.movements}
            timezone={data.settings.timezone}
          />
          {data.movementsHasMore ? (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => more("movements")}
            >
              Cargar más movimientos
            </button>
          ) : null}
        </section>
      </>
    );
  }
  if (section === "proveedores")
    return data.suppliers.length ? (
      <div className="mg-table-wrap mg-paper">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Contacto</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.suppliers.map((s) => (
              <tr key={s.id}>
                <th>{s.name}</th>
                <td>{s.contact || "Sin contacto"}</td>
                <td>{s.note || "—"}</td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => open({ type: "supplier", supplier: s })}
                  >
                    Editar<span className="sr-only"> {s.name}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty title="Tus proveedores, a mano.">
        Guardá un nombre y su contacto. Después podés vincularlo a cada compra o
        gasto.
      </Empty>
    );
  if (section === "recetas")
    return (
      <>
        {!products.length ? (
          <Empty title="Primero, tu carta.">
            Agregá productos y variantes para asociarles recetas.{" "}
            <Link href={`${panelBase(businessId)}/carta`}>Ir a Carta</Link>
          </Empty>
        ) : (
          <div className="mg-table-wrap mg-paper">
            <table>
              <thead>
                <tr>
                  <th>Producto / opción</th>
                  <th>Qué se usa en cada venta</th>
                  <th>Costo estimado actual</th>
                </tr>
              </thead>
              <tbody>
                {products.flatMap((p) =>
                  [
                    ...p.variants.map((v) => ({ ...v, optionKind: "variant" })),
                    ...p.addOns.map((a) => ({ ...a, optionKind: "addon" })),
                  ].map((option) => {
                    const recipe = data.recipes.find(
                        (r) =>
                          r.productId === p.id &&
                          r.optionId === option.id &&
                          r.optionKind === option.optionKind,
                      ),
                      costs = recipe?.lines.map((l) =>
                        costOf(
                          l.quantity,
                          data.items.find((i) => i.id === l.itemId)?.unitCost ??
                            null,
                        ),
                      );
                    const complete = recipe && costs?.every((c) => c !== null),
                      cost = complete
                        ? costs!.reduce((n, c) => n + BigInt(c!), 0n).toString()
                        : null;
                    return (
                      <tr key={`${p.id}-${option.optionKind}-${option.id}`}>
                        <th>
                          {p.name}
                          <small>
                            {option.optionKind === "addon"
                              ? "Adicional · "
                              : ""}
                            {option.name}
                          </small>
                        </th>
                        <td>
                          {recipe ? (
                            recipe.noConsumption ? (
                              "No usa insumos"
                            ) : (
                              recipe.lines
                                .map((l) => {
                                  const item = data.items.find(
                                    (i) => i.id === l.itemId,
                                  );
                                  return `${l.quantity} ${item ? units[item.unit] : ""} ${item?.name ?? ""}`;
                                })
                                .join(" · ")
                            )
                          ) : (
                            <span className="mg-stock-alert">
                              Falta indicar los ingredientes
                            </span>
                          )}
                          {recipe ? (
                            <small>Versión {recipe.version}</small>
                          ) : null}
                        </td>
                        <td>{money(cost)}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        )}
        <h2 className="mg-spaced-heading">Elaboraciones registradas</h2>
        <OperationList
          data={data}
          kind="production"
          onCorrect={(referenceId, item) =>
            open({ type: "adjustment", referenceId, item })
          }
        />
        {data.operationsHasMore ? (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => more("operations")}
          >
            Ver registros anteriores
          </button>
        ) : null}
      </>
    );
  if (section === "compras")
    return (
      <>
        <p className="mg-disclosure">
          Las compras suman stock y actualizan el costo promedio. Su costo se
          reconoce al vender o registrar pérdida; no se resta de nuevo como
          gasto. Si todavía no hay insumos, cargalos primero en Inventario.
        </p>
        <OperationList
          data={data}
          kind="purchase"
          onCorrect={(referenceId, item) =>
            open({ type: "adjustment", referenceId, item })
          }
        />
        {data.operationsHasMore ? (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => more("operations")}
          >
            Ver registros anteriores
          </button>
        ) : null}
      </>
    );
  if (section === "ventas")
    return data.sales.length ? (
      <>
        <div className="mg-table-wrap mg-paper">
          <table>
            <thead>
              <tr>
                <th>Fecha / venta</th>
                <th>Dónde vendiste</th>
                <th>Total</th>
                <th>Costo guardado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.sales.map((s) => (
                <tr key={s.id}>
                  <th>
                    {localTime(s.createdAt, data.settings.timezone)}
                    <small>{s.note}</small>
                    <small>
                      {s.lines
                        .map(
                          (l) =>
                            `${l.quantity} × ${l.name} (${l.variant})${l.addOns.length ? ` + ${l.addOns.join(", ")}` : ""}`,
                        )
                        .join(" · ")}
                    </small>
                    {s.cancelledAt ? (
                      <small className="mg-stock-alert">
                        Anulada el{" "}
                        {localTime(s.cancelledAt, data.settings.timezone)}
                      </small>
                    ) : null}
                  </th>
                  <td>{channels[s.channel]}</td>
                  <td>{money(s.totalCents)}</td>
                  <td>
                    {s.costComplete ? (
                      money(s.costCents)
                    ) : (
                      <>
                        {money(s.knownCostCents)}
                        <small>Faltan costos</small>
                        <Link
                          href={`${panelBase(businessId)}/gestion/inventario?action=costs`}
                        >
                          Cargar costos de insumos
                        </Link>
                        {" · "}
                        <Link
                          href={`${panelBase(businessId)}/gestion/recetas?action=recipe`}
                        >
                          Indicar ingredientes
                        </Link>
                      </>
                    )}
                  </td>
                  <td>
                    {!s.cancelledAt ? (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => cancelSale(s)}
                      >
                        Anular
                        <span className="sr-only">
                          {" "}
                          venta del{" "}
                          {localTime(s.createdAt, data.settings.timezone)}
                        </span>
                      </button>
                    ) : (
                      "Anulada"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.salesHasMore ? (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => more("sales")}
          >
            Cargar ventas anteriores
          </button>
        ) : null}
        <p className="mg-disclosure">
          Los pedidos históricos anteriores a Gestión se consultan desde Pedidos
          y aparecen en los resultados con costos pendientes.
        </p>
      </>
    ) : (
      <Empty title="Todo lo vendido, en el mismo lugar.">
        Los pedidos nuevos aceptados aparecen automáticamente. Registrá las
        ventas de mostrador, WhatsApp y otros canales desde acá. Si tu carta
        está vacía, agregá sus productos primero.
      </Empty>
    );
  if (section === "gastos")
    return data.expenses.length ? (
      <div className="mg-table-wrap mg-paper">
        <table>
          <thead>
            <tr>
              <th>Fecha / concepto</th>
              <th>Categoría</th>
              <th>Proveedor</th>
              <th>Importe</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.expenses.map((e) => (
              <tr key={e.id}>
                <th>
                  {e.concept}
                  <small>
                    {e.date}
                    {e.note ? ` · ${e.note}` : ""}
                  </small>
                </th>
                <td>{e.category}</td>
                <td>
                  {data.suppliers.find((s) => s.id === e.supplierId)?.name ??
                    "—"}
                </td>
                <td>{money(e.amountCents)}</td>
                <td>
                  {e.reversedAt ? (
                    "Anulado"
                  ) : (
                    <button
                      className="text-button"
                      onClick={() =>
                        open({ type: "reverse_expense", id: e.id })
                      }
                    >
                      Anular<span className="sr-only"> {e.concept}</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty title="Lo que cuesta mantener el local andando.">
        Anotá alquiler, sueldos, servicios, comisiones y reparto para ver un
        resultado más completo.
      </Empty>
    );
  return null;
}
function MovementTable({
  movements,
  timezone,
}: {
  movements: Movement[];
  timezone: string;
}) {
  return movements.length ? (
    <div className="mg-table-wrap mg-paper">
      <table>
        <thead>
          <tr>
            <th>Fecha / motivo</th>
            <th>Insumo</th>
            <th>Movimiento</th>
            <th>Cantidad</th>
            <th>Costo</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <th>
                {localTime(m.createdAt, timezone)}
                {m.reason ? <small>{m.reason}</small> : null}
              </th>
              <td>{m.itemName}</td>
              <td>{movementNames[m.kind] ?? m.kind}</td>
              <td>{decimal(fixed(m.quantity))}</td>
              <td>{money(m.costCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="mg-muted">Todavía no hay movimientos.</p>
  );
}
function OperationList({
  data,
  kind,
  onCorrect,
}: {
  data: ManagementData;
  kind: "purchase" | "production";
  onCorrect: (referenceId: string, item: StockItem) => void;
}) {
  const operations = data.operations.filter((o) => o.type === kind);
  if (!operations.length)
    return (
      <Empty
        title={
          kind === "purchase"
            ? "La próxima compra, anotala acá."
            : "De ingredientes a productos listos."
        }
      >
        {kind === "purchase"
          ? "Podés cargar varios insumos en la misma compra, incluso por kilo, litro o presentación."
          : "Registrá los ingredientes utilizados y la cantidad real obtenida. Al vender, solo se descuenta el producto ya preparado."}
      </Empty>
    );
  return (
    <div className="mg-table-wrap mg-paper">
      <table>
        <thead>
          <tr>
            <th>Fecha / detalle</th>
            <th>{kind === "purchase" ? "Proveedor" : "Cantidad obtenida"}</th>
            <th>{kind === "purchase" ? "Total comprado" : "Ingredientes"}</th>
            <th>Corrección</th>
          </tr>
        </thead>
        <tbody>
          {operations.map((o) => {
            const p = o.payload as {
              note?: string;
              supplierId?: string;
              outputItemId?: string;
              outputQuantity?: string;
              lines: {
                itemId: string;
                quantity: string;
                unit?: string;
                factor?: string;
                totalCents?: string;
              }[];
            };
            const item = data.items.find(
              (i) =>
                i.id ===
                (kind === "production" ? p.outputItemId : p.lines[0]?.itemId),
            );
            return (
              <tr key={o.id}>
                <th>
                  {localTime(o.createdAt, data.settings.timezone)}
                  <small>
                    {kind === "production"
                      ? item?.name
                      : p.lines
                          .map((l) => {
                            const i = data.items.find((i) => i.id === l.itemId);
                            return `${i?.name ?? "Insumo"}: ${l.quantity} ${l.unit === "pack" ? `presentaciones × ${l.factor} ${i?.unit}` : (l.unit ?? i?.unit)}`;
                          })
                          .join(" · ")}
                  </small>
                  {p.note ? <small>{p.note}</small> : null}
                </th>
                <td>
                  {kind === "purchase"
                    ? (data.suppliers.find((s) => s.id === p.supplierId)
                        ?.name ?? "Sin proveedor")
                    : `${p.outputQuantity} ${item ? units[item.unit] : ""}`}
                </td>
                <td>
                  {kind === "purchase"
                    ? money(
                        p.lines
                          .reduce((n, l) => n + BigInt(l.totalCents ?? "0"), 0n)
                          .toString(),
                      )
                    : p.lines
                        .map(
                          (l) =>
                            `${l.quantity} ${data.items.find((i) => i.id === l.itemId)?.name}`,
                        )
                        .join(" · ")}
                </td>
                <td>
                  {kind === "production" ? (
                    item ? (
                      <button
                        className="text-button"
                        onClick={() => onCorrect(o.id, item)}
                      >
                        Registrar ajuste
                      </button>
                    ) : null
                  ) : (
                    p.lines.map((l, index) => {
                      const i = data.items.find((i) => i.id === l.itemId);
                      return i ? (
                        <button
                          key={index}
                          className="text-button mg-correction"
                          onClick={() => onCorrect(o.id, i)}
                        >
                          Ajustar {i.name}
                        </button>
                      ) : null;
                    })
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
