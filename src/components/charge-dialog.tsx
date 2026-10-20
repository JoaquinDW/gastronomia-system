"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/menu";
import { pesosToCents } from "@/lib/cart";
import {
  changeFor,
  paymentLabels,
  paymentMethods,
  suggestedBills,
  type PaymentMethod,
} from "@/lib/cash";
import { usePanelBase } from "./panel-base";

export type ChargeTarget = {
  id: string;
  number: number;
  customerName: string;
  paymentMethod: string;
  totalCents: number;
  paidCents: number;
};

const pesos = (cents: number) =>
  (cents / 100).toLocaleString("es-AR", { maximumFractionDigits: 2, useGrouping: false });

// Charge an order in the open shift: full, partial or split across methods.
// Cash asks what the customer hands over and shows the change.
export function ChargeDialog({
  businessId,
  order,
  cashOpen,
  onCharged,
  onClose,
}: {
  businessId: string;
  order: ChargeTarget;
  cashOpen: boolean;
  onCharged: (message: string) => void;
  onClose: () => void;
}) {
  const panel = usePanelBase();
  const dialog = useRef<HTMLDialogElement>(null);
  const requestKey = useRef(crypto.randomUUID());
  const left = order.totalCents - order.paidCents;
  const [method, setMethod] = useState<PaymentMethod>(
    order.paymentMethod === "transfer" ? "transfer" : "cash",
  );
  const [amount, setAmount] = useState(pesos(left));
  const [tendered, setTendered] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => dialog.current?.showModal(), []);

  const amountCents = pesosToCents(amount);
  const tenderedCents = tendered.trim() ? pesosToCents(tendered) : null;
  const validAmount = amountCents !== null && amountCents > 0 && amountCents <= left;
  const change = method === "cash" ? changeFor(amountCents ?? 0, tenderedCents) : null;
  const short =
    method === "cash" && tenderedCents !== null && amountCents !== null && tenderedCents < amountCents;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validAmount || short) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/businesses/${businessId}/cash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment",
          requestKey: requestKey.current,
          orderId: order.id,
          method,
          amountCents,
          tenderedCents: method === "cash" && tenderedCents ? tenderedCents : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const rest = d.leftCents as number | undefined;
      onCharged(
        [
          `Cobraste ${formatMoney(amountCents!)} del pedido #${order.number} en ${paymentLabels[method].toLowerCase()}.`,
          change ? `Vuelto: ${formatMoney(change)}.` : "",
          rest ? `Falta cobrar ${formatMoney(rest)}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No pudimos registrar el cobro.");
      requestKey.current = crypto.randomUUID();
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="editor-dialog charge-dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      onClose={onClose}
      aria-labelledby="charge-title"
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">PEDIDO #{order.number.toString().padStart(3, "0")} · {order.customerName}</p>
          <h2 id="charge-title">Cobrar</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar">
          ×
        </button>
      </div>
      <dl className="charge-balance">
        <div>
          <dt>Total</dt>
          <dd>{formatMoney(order.totalCents)}</dd>
        </div>
        {order.paidCents ? (
          <div>
            <dt>Ya cobrado</dt>
            <dd>{formatMoney(order.paidCents)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Falta</dt>
          <dd>
            <strong>{formatMoney(left)}</strong>
          </dd>
        </div>
      </dl>
      {!cashOpen ? (
        <div className="charge-closed">
          <p>La caja está cerrada. Abrí un turno para empezar a cobrar.</p>
          <Link className="primary-button" href={`${panel}/caja`}>
            Ir a Caja
          </Link>
        </div>
      ) : (
        <form className="app-form" onSubmit={submit}>
          <fieldset disabled={busy}>
            <legend className="sr-only">Medio de pago</legend>
            <div className="order-filters charge-methods" role="group" aria-label="Medio de pago">
              {paymentMethods.map((m) => (
                <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>
                  {paymentLabels[m]}
                </button>
              ))}
            </div>
            <div className="form-grid">
              <label>
                Cobrar ($)
                <input
                  inputMode="decimal"
                  value={amount}
                  aria-invalid={!validAmount || undefined}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="field-hint">
                  {amountCents !== null && amountCents > left
                    ? `No puede superar lo que falta, ${formatMoney(left)}.`
                    : amountCents !== null && amountCents > 0 && amountCents < left
                      ? `Cobro parcial: después quedan ${formatMoney(left - amountCents)}.`
                      : "Para dividir el pago, cobrá una parte y después el resto."}
                </span>
              </label>
              {method === "cash" ? (
                <label>
                  ¿Con cuánto paga? ($)
                  <input
                    inputMode="decimal"
                    value={tendered}
                    placeholder="Opcional"
                    aria-invalid={short || undefined}
                    onChange={(e) => setTendered(e.target.value)}
                  />
                  <span className="charge-bills">
                    {suggestedBills(amountCents ?? left).map((b) => (
                      <button key={b} type="button" className="secondary-button compact-button" onClick={() => setTendered(pesos(b))}>
                        {formatMoney(b)}
                      </button>
                    ))}
                  </span>
                </label>
              ) : null}
            </div>
            {method === "cash" && (change !== null || short) ? (
              <p className="charge-change" role="status">
                {short ? (
                  "No alcanza para cubrir el cobro."
                ) : (
                  <>
                    <span>Vuelto</span>
                    <strong>{formatMoney(change!)}</strong>
                  </>
                )}
              </p>
            ) : null}
            {method !== "cash" ? (
              <p className="field-hint standalone-hint">
                {method === "transfer"
                  ? "Cobralo cuando veas la plata en tu cuenta, no por una captura."
                  : "Cobralo cuando el posnet o la app confirmen el pago."}
              </p>
            ) : null}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="primary-button" disabled={busy || !validAmount || short}>
              {busy ? "Cobrando…" : validAmount ? `Cobrar ${formatMoney(amountCents!)}` : "Cobrar"}
            </button>
          </fieldset>
        </form>
      )}
    </dialog>
  );
}
