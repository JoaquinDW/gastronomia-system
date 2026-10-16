import Link from "next/link";
import type { Product } from "@/lib/menu";
import { HistoricalOrderCosts } from "./management-historical-costs";
import type { Report, StockItem, Recipe } from "@/lib/management";
import { channels } from "@/lib/management";
import { fixed, money, shiftDate } from "@/lib/management-math";

function change(current: string, previous: string) {
  const a = BigInt(current),
    b = BigInt(previous);
  if (b === 0n)
    return a === 0n ? "Sin cambios" : "Todavía no hay datos para comparar";
  const percent = ((a - b) * 1000n) / (b < 0n ? -b : b);
  return `${percent > 0n ? "+" : ""}${Number(percent) / 10}% frente al período anterior`;
}
function dateLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function ManagementReport({
  report,
  businessId,
  today,
  items,
  cutoffHour,
  recipes,
  products,
}: {
  report: Report;
  businessId: string;
  today: string;
  items: StockItem[];
  cutoffHour: number;
  recipes: Recipe[];
  products: Product[];
}) {
  const root = `/panel/negocios/${businessId}/gestion`,
    api = `/api/businesses/${businessId}/management`;
  const { totals: t } = report;
  const onlyHistoricalMissing =
    report.legacyPendingCount > 0 &&
    report.legacyPendingCount === t.incompleteCount &&
    !t.wasteIncomplete;
  const low = items.filter((i) => fixed(i.quantity) <= fixed(i.minimum));
  const unknown = items.filter(
    (i) => i.unitCost === null && fixed(i.quantity) !== 0n,
  );
  const points = report.days;
  const max = points.reduce((m, d) => {
    const n = BigInt(d.revenue);
    return n > m ? n : m;
  }, 1n);
  const min = points.reduce((m, d) => {
    const n = BigInt(d.revenue);
    return n < m ? n : m;
  }, 0n);
  const y = (n: string) =>
    156 - Number(((BigInt(n) - min) * 128n) / (max - min));
  const x = (i: number) => 20 + (i * 660) / Math.max(points.length - 1, 1);
  const path = points
    .map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.revenue)}`)
    .join(" ");
  return (
    <>
      <section className="mg-period" aria-label="Período de resultados">
        <div className="mg-period-links">
          {[
            ["Hoy", today],
            ["7 días", shiftDate(today, -6)],
            ["Este mes", `${today.slice(0, 7)}-01`],
          ].map(([label, from]) => (
            <Link
              key={label}
              href={`${root}?from=${from}&to=${today}`}
              aria-current={
                report.from === from && report.to === today ? "page" : undefined
              }
            >
              {label}
            </Link>
          ))}
        </div>
        <form className="mg-date-form" action={root}>
          <label>
            Desde
            <input
              type="date"
              name="from"
              required
              defaultValue={report.from}
            />
          </label>
          <label>
            Hasta
            <input type="date" name="to" required defaultValue={report.to} />
          </label>
          <button className="secondary-button" type="submit">
            Ver período
          </button>
        </form>
      </section>
      <div className="mg-report-intro">
        <p>
          {dateLabel(report.from)} al {dateLabel(report.to)} · El día cierra a
          las {cutoffHour.toString().padStart(2, "0")}:00
        </p>
        <a
          className="text-button"
          href={`${api}?view=export-results&from=${report.from}&to=${report.to}`}
        >
          Exportar resultados CSV
        </a>
      </div>
      <section className="mg-scoreboard" aria-label="Los números de tu negocio">
        <div className="mg-main-result">
          <h2>Lo que quedó</h2>
          <p className="mg-result-amount">
            {t.result === null
              ? onlyHistoricalMissing
                ? "Pedidos sin costo"
                : "Faltan costos"
              : money(t.result)}
          </p>
          <p>Lo que te queda (estimado)</p>
          <span>
            {t.result === null
              ? report.legacyPendingCount
                ? "Este período incluye pedidos anteriores a Gestión. Revisá sus productos para completar el costo."
                : "Hay ventas o pérdidas con costos pendientes. Revisá sus ingredientes y costos."
              : report.previous.result === null
                ? "El período anterior tiene costos pendientes"
                : change(t.result, report.previous.result)}
          </span>
          {t.result === null ? (
            <div
              className="mg-cost-actions"
              aria-label="Dónde cargar los costos"
            >
              {report.legacyPendingCount ? (
                <a href="#costos-anteriores">
                  Completar costos de pedidos anteriores
                </a>
              ) : null}
              {!onlyHistoricalMissing ? (
                <>
                  <Link href={`${root}/inventario?action=costs`}>
                    Cargar costos de insumos
                  </Link>
                  <Link href={`${root}/recetas?action=recipe`}>
                    Indicar ingredientes por producto
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        <dl className="mg-equation">
          <div>
            <dt>Total vendido</dt>
            <dd>{money(t.revenue)}</dd>
          </div>
          <div>
            <dt>
              − Costo de lo vendido{" "}
              {t.costsIncomplete ? (
                <span className="mg-inline-warning">faltan datos</span>
              ) : null}
            </dt>
            <dd>{money(t.cost)}</dd>
          </div>
          <div className="mg-subtotal">
            <dt>Ventas menos su costo</dt>
            <dd>{money(t.grossMargin)}</dd>
          </div>
          <div>
            <dt>− Gastos registrados</dt>
            <dd>{money(t.expenses)}</dd>
          </div>
          <div>
            <dt>
              − Pérdidas{" "}
              {t.wasteIncomplete ? (
                <span className="mg-inline-warning">faltan datos</span>
              ) : null}
            </dt>
            <dd>{money(t.waste)}</dd>
          </div>
        </dl>
      </section>
      <p className="mg-disclosure">
        El total vendido ya descuenta las ventas anuladas. Confirmar una venta
        no significa que esté cobrada. La estimación usa los costos y gastos que
        cargaste. Incluye {money(t.delivery)} por envíos; cargá el costo del
        reparto en Gastos. Las pérdidas son insumos o productos que ya no podés
        usar o vender.
      </p>
      {report.legacyEstimatedCount ? (
        <p className="mg-disclosure">
          Incluye {report.legacyEstimatedCount} pedidos anteriores cuyo costo
          estimaste con las recetas que elegiste. Esos costos quedan guardados.
        </p>
      ) : null}
      {t.result === null ? (
        <section className="mg-notice" aria-label="Datos por completar">
          <h2>
            {onlyHistoricalMissing
              ? "Falta completar un pedido anterior"
              : "Antes de sacar conclusiones"}
          </h2>
          <p>
            {t.completeCount} de {t.saleCount} ventas tienen sus costos
            completos.
          </p>
          {report.legacyPendingCount ? (
            <p>
              {report.legacyPendingCount === 1
                ? "Hay un pedido de antes de Gestión que no guardó qué productos de la carta se vendieron."
                : `Hay ${report.legacyPendingCount} pedidos de antes de Gestión sin productos vinculados a la carta.`}{" "}
              Podés elegir sus recetas abajo para estimar el costo, sin volver a
              descontar stock.
            </p>
          ) : null}
          {!onlyHistoricalMissing ? (
            <>
              <p>
                Hay ventas o pérdidas que se registraron sin todos sus costos.
                Los cambios de recetas se usan para las próximas ventas.
              </p>
              <Link href={`${root}/recetas?action=recipe`}>
                Revisar ingredientes
              </Link>
              {" · "}
              <Link href={`${root}/inventario?action=costs`}>
                Revisar costos de insumos
              </Link>
            </>
          ) : null}
        </section>
      ) : null}
      {report.historicalOrders.length ? (
        <section
          className="mg-paper mg-historical-costs"
          id="costos-anteriores"
          aria-label="Costos de pedidos anteriores"
        >
          <h2>Completá los costos de tus pedidos anteriores</h2>
          <p>
            El pedido conserva los nombres originales. Elegí a qué producto
            corresponde cada uno; no los asociamos por nombre.
          </p>
          {report.historicalOrders.map((order) => (
            <HistoricalOrderCosts
              key={order.id}
              order={order}
              products={products}
              recipes={recipes}
              items={items}
              businessId={businessId}
            />
          ))}
          {report.legacyPendingCount > report.historicalOrders.length ? (
            <p>
              Mostramos los primeros {report.historicalOrders.length} pedidos
              pendientes. Al completarlos, aparecerán los siguientes.
            </p>
          ) : null}
        </section>
      ) : null}
      <div className="mg-stat-line">
        <p>
          <strong>{t.saleCount}</strong> ventas registradas
        </p>
        <p>
          <strong>{money(t.ticket)}</strong> por venta, en promedio
        </p>
        <p>
          <strong>{t.cancelledCount}</strong> anulaciones
        </p>
        <p>{change(t.revenue, report.previous.revenue)}</p>
      </div>
      {!t.saleCount && !t.cancelledCount && t.expenses === "0" ? (
        <section className="mg-empty">
          <h2>Los números empiezan con tu primera venta.</h2>
          <p>
            Los pedidos que aceptes se suman solos. También podés cargar ventas
            de mostrador o WhatsApp.
          </p>
          <Link className="secondary-button" href={`${root}/ventas`}>
            Registrar una venta
          </Link>
        </section>
      ) : null}
      <div className="mg-report-grid">
        <section className="mg-paper mg-trend">
          <div className="mg-section-heading">
            <h2>Cómo vienen las ventas</h2>
            <span>Por día</span>
          </div>
          <svg
            className="mg-chart"
            viewBox="0 0 700 190"
            role="img"
            aria-label={`Evolución de ventas entre ${report.from} y ${report.to}. El detalle está en la tabla.`}
          >
            <line
              x1="20"
              x2="680"
              y1={y("0")}
              y2={y("0")}
              stroke="var(--line-strong)"
              strokeWidth="1"
            />
            <path
              d={path}
              fill="none"
              stroke="var(--ink)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {points.length <= 31
              ? points.map((d, i) => (
                  <circle
                    key={d.date}
                    cx={x(i)}
                    cy={y(d.revenue)}
                    r="3"
                    fill="var(--accent)"
                    stroke="var(--ink)"
                  >
                    <title>{`${dateLabel(d.date)}: ${money(d.revenue)}`}</title>
                  </circle>
                ))
              : null}
            <text x="20" y="184">
              {dateLabel(report.from)}
            </text>
            <text x="680" y="184" textAnchor="end">
              {dateLabel(report.to)}
            </text>
          </svg>
          <details>
            <summary>Ver los importes por día</summary>
            <div className="mg-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Ventas</th>
                    <th>Costos conocidos</th>
                    <th>Gastos</th>
                    <th>Pérdida</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((d) => (
                    <tr key={d.date}>
                      <th>{dateLabel(d.date)}</th>
                      <td>{money(d.revenue)}</td>
                      <td>
                        {money(d.cost)}
                        {!d.complete ? " · faltan costos" : ""}
                      </td>
                      <td>{money(d.expenses)}</td>
                      <td>{money(d.waste)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="mg-paper">
          <div className="mg-section-heading">
            <h2>Por dónde vendés</h2>
          </div>
          {report.byChannel.length ? (
            <dl className="mg-channel-list">
              {report.byChannel.map((c) => (
                <div key={c.channel}>
                  <dt>
                    {channels[c.channel as keyof typeof channels]}
                    <small>{c.count} ventas después de anulaciones</small>
                  </dt>
                  <dd>{money(c.revenue)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mg-muted">Todavía no hay ventas en este período.</p>
          )}
        </section>
        <section className="mg-paper">
          <div className="mg-section-heading">
            <h2>Lo más vendido</h2>
            <span>Sin contar anulaciones</span>
          </div>
          {report.products.length ? (
            <ol className="mg-ranking">
              {report.products.map((p) => (
                <li key={p.name}>
                  <span>
                    {p.name}
                    <small>{money(p.revenue)}</small>
                  </span>
                  <strong>{p.quantity}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mg-muted">Tus productos van a aparecer acá.</p>
          )}
        </section>
        <section className="mg-paper">
          <div className="mg-section-heading">
            <h2>Para ocuparse hoy</h2>
          </div>
          <ul className="mg-action-list">
            {low.length ? (
              <li>
                <strong>{low.length} insumos para reponer</strong>
                <span>
                  {low
                    .slice(0, 3)
                    .map((i) => i.name)
                    .join(", ")}
                  {low.length > 3 ? "…" : ""}
                </span>
                <Link href={`${root}/inventario`}>Revisar inventario</Link>
              </li>
            ) : (
              <li>
                <strong>
                  {items.length
                    ? "Stock por encima del mínimo"
                    : "Cargá el stock que tenés"}
                </strong>
                <Link href={`${root}/inventario`}>Ir al inventario</Link>
              </li>
            )}
            {unknown.length ? (
              <li>
                <strong>{unknown.length} insumos sin costo cargado</strong>
                <span>Cargá cuánto te costó el stock que tenés.</span>
                <Link href={`${root}/inventario?action=costs`}>
                  Cargar costos de insumos
                </Link>
              </li>
            ) : null}
            <li>
              <strong>Que no quede ningún gasto afuera</strong>
              <span>
                Alquiler, servicios, sueldos y reparto también cuentan.
              </span>
              <Link href={`${root}/gastos`}>Registrar un gasto</Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
