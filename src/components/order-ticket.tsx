import { formatMoney } from "@/lib/menu";
import { isDeliveryFeePending, type Order } from "@/lib/checkout";
import { groupByCategory, type ProductCategory } from "@/lib/ticket";

const day = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Cordoba",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const time = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Cordoba",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// Customer receipt that goes in the bag: totals, payment and the legal note
// that it is not an invoice. The kitchen keeps using the comanda.
export function CustomerTicket({
  order: o,
  businessName,
  categories,
  footer,
}: {
  order: Order;
  businessName: string;
  categories: ProductCategory[];
  footer: string;
}) {
  const created = new Date(o.createdAt);
  const feePending = isDeliveryFeePending(o);
  return (
    <section className="ticket-print" aria-hidden="true">
      <h1>
        {o.fulfillment === "delivery" ? "Delivery" : "Retiro"} Nº{o.number}
      </h1>
      <p className="ticket-print-business">{businessName}</p>
      <p>{day.format(created).replace(",", "")}</p>
      <p>Creado a las {time.format(created)}</p>
      <div className="ticket-print-block">
        <p className="ticket-print-strong">{o.customerName}</p>
        <p>{o.customerPhone}</p>
      </div>
      {o.address ? (
        <div className="ticket-print-block">
          <p>{o.address}</p>
          {o.zoneName ? <p>{o.zoneName}</p> : null}
        </div>
      ) : null}
      {groupByCategory(o.items, categories).map((g) => (
        <div className="ticket-print-block" key={g.category}>
          <p className="ticket-print-category">{g.category}</p>
          {g.items.map((i, j) => (
            <div className="ticket-print-line" key={j}>
              <p>
                <span>
                  {i.quantity} {i.name}
                </span>
                <span>{formatMoney(i.lineCents)}</span>
              </p>
              {i.variant !== "Única" ? <small>{i.variant}</small> : null}
              {i.addOns.length ? (
                <small>+ {i.addOns.join(", ")}</small>
              ) : null}
              {i.choices?.map((c) => (
                <small key={c}>• {c}</small>
              ))}
            </div>
          ))}
        </div>
      ))}
      {o.note ? <p className="ticket-print-block">Nota: {o.note}</p> : null}
      <div className="ticket-print-totals">
        <p>
          <span>Subtotal</span>
          <span>{formatMoney(o.subtotalCents)}</span>
        </p>
        {o.fulfillment === "delivery" ? (
          <p>
            <span>Envío</span>
            <span>
              {feePending ? "A confirmar" : formatMoney(o.deliveryCents)}
            </span>
          </p>
        ) : null}
        <p className="ticket-print-total">
          <span>
            {feePending ? "Sin envío · " : ""}
            {o.paymentMethod === "cash" ? "Efectivo" : "Transferencia"}
          </span>
          <span>{formatMoney(o.totalCents)}</span>
        </p>
      </div>
      <p className="ticket-print-block">Comprobante no válido como factura.</p>
      {footer ? <p className="ticket-print-footer">{footer}</p> : null}
      <p className="ticket-print-footer">Pedido hecho con pedipue.com</p>
    </section>
  );
}
