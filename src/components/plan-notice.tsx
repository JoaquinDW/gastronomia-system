import {
  billingState,
  daysLabel,
  launchMonths,
  trialDays,
  type BillingFields,
} from "@/lib/billing";
import { launchPrice, pedipueWhatsapp } from "@/lib/billing-copy";

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Cordoba",
});

// Aviso del plan arriba del panel. Nunca bloquea: la tienda y los pedidos
// siguen andando aunque la prueba haya vencido; el cobro se arregla a mano.
export function PlanNotice({
  businessName,
  fields,
  now,
}: {
  businessName: string;
  fields: BillingFields;
  now: number;
}) {
  const state = billingState(fields, now);
  if (state.kind === "exempt") return null;
  if (state.kind === "paid" && state.daysLeft > 3) return null;
  const href = pedipueWhatsapp(
    `Hola, quiero pagar Pedipue para ${businessName}.`,
  );
  const urgent =
    state.kind === "expired" ||
    (state.kind === "trial" && state.daysLeft <= 3) ||
    state.kind === "paid";
  let tag: string;
  let message: React.ReactNode;
  if (state.kind === "trial") {
    tag = "PRUEBA GRATIS";
    message = (
      <>
        Te quedan <strong>{daysLabel(state.daysLeft)}</strong> de prueba (hasta
        el {dateFormat.format(state.until)}). Después son {launchPrice} por mes
        los primeros {launchMonths} meses, por transferencia o link de pago.
      </>
    );
  } else if (state.kind === "paid") {
    tag = "TU PLAN";
    message = (
      <>
        Tu mes pago vence el {dateFormat.format(state.until)}. Coordinemos el
        próximo pago así no se corta nada.
      </>
    );
  } else {
    tag = fields.paidUntil ? "PLAN VENCIDO" : "PRUEBA TERMINADA";
    message = fields.paidUntil ? (
      <>
        Tu plan venció el {dateFormat.format(state.since)}. Tu tienda sigue
        recibiendo pedidos; escribinos para coordinar el pago.
      </>
    ) : (
      <>
        Terminaron tus {trialDays} días de prueba. Tu tienda sigue recibiendo
        pedidos; para seguir con Pedipue son {launchPrice} por mes, por
        transferencia o link de pago.
      </>
    );
  }
  return (
    <aside
      className={`plan-notice ${urgent ? "is-urgent" : ""}`}
      aria-label="Tu plan de Pedipue"
    >
      <span className="plan-notice-tag">{tag}</span>
      <p>{message}</p>
      {href ? (
        <a
          className={urgent ? "primary-button" : "ghost-button"}
          href={href}
          target="_blank"
          rel="noopener"
        >
          {state.kind === "trial" && !urgent
            ? "Consultar"
            : "Pagar por WhatsApp"}{" "}
          <span aria-hidden="true">↗</span>
        </a>
      ) : null}
    </aside>
  );
}
