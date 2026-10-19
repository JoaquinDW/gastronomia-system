"use client";
import { useState } from "react";
import type { AutoPrint, TicketConfig } from "@/lib/ticket";

const autoPrintLabels: Record<AutoPrint, string> = {
  off: "Nada, imprimo a mano",
  comanda: "La comanda",
  ticket: "El ticket para el cliente",
  both: "La comanda y el ticket",
};

export function PrintSettings({
  businessId,
  ticket,
  onSaved,
  autoPrint,
  onAutoPrint,
  onClose,
}: {
  businessId: string;
  ticket: TicketConfig;
  onSaved: (ticket: TicketConfig) => void;
  autoPrint: AutoPrint;
  onAutoPrint: (choice: AutoPrint) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(ticket);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = JSON.stringify(form) !== JSON.stringify(ticket);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch(`/api/businesses/${businessId}/ticket`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: form }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onSaved(d.ticket);
      setForm(d.ticket);
      setMessage("Listo, guardado para todo el local.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally {
      setBusy(false);
    }
  }

  // With the ticket off, "both" prints just the comanda.
  const choices = form.enabled
    ? (Object.keys(autoPrintLabels) as AutoPrint[])
    : (["off", "comanda"] as AutoPrint[]);
  const shown = form.enabled
    ? autoPrint
    : autoPrint === "both"
      ? "comanda"
      : autoPrint === "ticket"
        ? "off"
        : autoPrint;

  return (
    <section className="print-settings" aria-labelledby="print-settings-title">
      <div className="print-settings-heading">
        <h2 id="print-settings-title">Impresión</h2>
        <button type="button" className="text-button" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <p className="section-description">
        Imprimí desde el navegador en una térmica de 58 u 80 mm, o en
        cualquier impresora. La comanda es para la cocina; el ticket va en la
        bolsa con el pedido.
      </p>
      <form className="app-form" onSubmit={save}>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />{" "}
          <span>
            Ticket para el cliente
            <small className="field-hint">
              Detalle por categoría, envío, forma de pago y total. Lleva la
              leyenda “Comprobante no válido como factura”.
            </small>
          </span>
        </label>
        <fieldset className="print-paper">
          <legend>Ancho del papel</legend>
          {(["80", "58"] as const).map((paper) => (
            <label className="checkbox-label" key={paper}>
              <input
                type="radio"
                name="paper"
                checked={form.paper === paper}
                onChange={() => setForm({ ...form, paper })}
              />{" "}
              {paper} mm
            </label>
          ))}
        </fieldset>
        {form.enabled ? (
          <label>
            Mensaje al pie del ticket
            <input
              maxLength={200}
              value={form.footer}
              onChange={(e) => setForm({ ...form, footer: e.target.value })}
              placeholder="¡Gracias por tu compra! Seguinos en @tulocal"
            />
          </label>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {message && !changed ? (
          <p className="field-hint standalone-hint" role="status">
            {message}
          </p>
        ) : null}
        <button
          className="primary-button compact-button"
          disabled={busy || !changed}
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </form>
      <div className="app-form print-device">
        <label>
          En esta computadora, al aceptar un pedido imprimir
          <select
            value={shown}
            onChange={(e) => onAutoPrint(e.target.value as AutoPrint)}
          >
            {choices.map((c) => (
              <option value={c} key={c}>
                {autoPrintLabels[c]}
              </option>
            ))}
          </select>
        </label>
        <p className="field-hint">
          Se guarda solo en este dispositivo, así imprime la compu del
          mostrador y no tu celular.
        </p>
        <details>
          <summary>¿Cómo hago para que salga sin confirmar cada vez?</summary>
          <ol>
            <li>Elegí la térmica como impresora predeterminada.</li>
            <li>
              Hacé un acceso directo de Chrome y sumale{" "}
              <code>--kiosk-printing</code> al final del destino.
            </li>
            <li>
              Abrí Pedipue desde ese acceso. Al aceptar, el pedido se imprime
              directo, sin el cuadro de impresión.
            </li>
          </ol>
        </details>
      </div>
    </section>
  );
}
