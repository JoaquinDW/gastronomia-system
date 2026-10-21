"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { billingState, daysLabel, type BillingFields } from "@/lib/billing";

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Argentina/Cordoba",
});

export function billingSummary(fields: BillingFields, now: number) {
  const state = billingState(fields, now);
  switch (state.kind) {
    case "exempt":
      return { label: "Exento", tone: "", detail: "No paga" };
    case "paid":
      return {
        label: "Pago",
        tone: "is-live",
        detail: `Hasta el ${dateFormat.format(state.until)}`,
      };
    case "trial":
      return {
        label: "Prueba",
        tone: "is-trial",
        detail: `Quedan ${daysLabel(state.daysLeft)}`,
      };
    case "expired":
      return {
        label: "Vencido",
        tone: "is-due",
        detail: state.daysAgo
          ? `Hace ${daysLabel(state.daysAgo)}`
          : "Venció hoy",
      };
  }
}

// Celda de cobro del superadmin: estado y acciones para anotar un pago a mano.
export function BillingControls({
  businessId,
  name,
  fields,
  now,
}: {
  businessId: string;
  name: string;
  fields: BillingFields;
  now: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const summary = billingSummary(fields, now);
  const state = billingState(fields, now);

  async function send(body: object, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/businesses/${businessId}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-cell">
      <span className={`admin-badge ${summary.tone}`}>{summary.label}</span>
      <small className="admin-sub">{summary.detail}</small>
      <div className="admin-billing-actions">
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() =>
            send({ action: "add_month" }, `¿Anotar un mes pago para ${name}?`)
          }
        >
          +1 mes pago
        </button>
        {state.kind === "trial" || state.kind === "expired" ? (
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => send({ action: "extend_trial" })}
          >
            +7 días de prueba
          </button>
        ) : null}
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() =>
            send(
              { action: "set_exempt", exempt: state.kind !== "exempt" },
              state.kind === "exempt"
                ? `¿Quitarle la exención a ${name}? Si no tiene fechas, arranca una prueba de 14 días.`
                : `¿Marcar ${name} como exento? No le vamos a mostrar avisos de pago.`,
            )
          }
        >
          {state.kind === "exempt" ? "Quitar exención" : "Marcar exento"}
        </button>
      </div>
      {error ? (
        <small className="admin-sub admin-error" role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}
