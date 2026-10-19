"use client";
import { useState } from "react";
import type { AutoPrint, TicketConfig } from "@/lib/ticket";
import { PrinterError, type UsbPrinter } from "@/lib/usb-printer";

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
  usbSupported,
  printer,
  onConnect,
  onForget,
  onTest,
}: {
  businessId: string;
  ticket: TicketConfig;
  onSaved: (ticket: TicketConfig) => void;
  autoPrint: AutoPrint;
  onAutoPrint: (choice: AutoPrint) => void;
  onClose: () => void;
  usbSupported: boolean;
  /** Name of the connected USB printer, if any. */
  printer: string | null;
  onConnect: () => Promise<UsbPrinter | null>;
  onForget: () => Promise<void>;
  onTest: (picked?: UsbPrinter) => Promise<void>;
}) {
  const [form, setForm] = useState(ticket);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = JSON.stringify(form) !== JSON.stringify(ticket);
  const [usbBusy, setUsbBusy] = useState(false);
  const [usbMessage, setUsbMessage] = useState("");
  const [usbError, setUsbError] = useState("");

  async function usbAction(action: () => Promise<string | null>) {
    setUsbBusy(true);
    setUsbError("");
    setUsbMessage("");
    try {
      const message = await action();
      if (message) setUsbMessage(message);
    } catch (e) {
      setUsbError(
        e instanceof PrinterError
          ? e.message
          : "No pudimos usar la impresora. Desenchufala, volvela a enchufar y probá de nuevo.",
      );
    } finally {
      setUsbBusy(false);
    }
  }

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
        <h3>Impresora de esta computadora</h3>
        {!usbSupported ? (
          <p className="field-hint standalone-hint">
            Para que los pedidos salgan solos, abrí Pedipue en Chrome o Edge
            desde la compu que tiene la impresora enchufada por USB.
          </p>
        ) : printer ? (
          <>
            <p className="printer-connected">
              <span className="live-dot" aria-hidden="true" /> {printer}
            </p>
            <div className="ticket-links">
              <button
                type="button"
                className="text-button"
                disabled={usbBusy}
                onClick={() =>
                  usbAction(async () => {
                    await onTest();
                    return "Listo, mandamos una hoja de prueba.";
                  })
                }
              >
                Imprimir prueba
              </button>
              <button
                type="button"
                className="text-button"
                disabled={usbBusy}
                onClick={() =>
                  usbAction(async () => {
                    await onForget();
                    return null;
                  })
                }
              >
                Desconectar
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="secondary-button"
              disabled={usbBusy}
              onClick={() =>
                usbAction(async () => {
                  const picked = await onConnect();
                  if (!picked) return null;
                  await onTest(picked);
                  return "Conectada. Si salió la hoja de prueba, ya está.";
                })
              }
            >
              Conectar impresora USB
            </button>
            <p className="field-hint standalone-hint">
              Enchufá la térmica, tocá el botón y elegila de la lista. Se hace
              una sola vez en esta compu.
            </p>
          </>
        )}
        {usbError ? (
          <p className="form-error" role="alert">
            {usbError}
          </p>
        ) : null}
        {usbMessage ? (
          <p className="field-hint standalone-hint" role="status">
            {usbMessage}
          </p>
        ) : null}
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
          {printer && !usbError
            ? "Sale directo por la impresora, sin preguntar. Dejá abierta esta pantalla de Pedidos."
            : "Sin impresora conectada, se abre el cuadro de impresión del navegador."}{" "}
          Vale solo para esta compu, así no imprime tu celular.
        </p>
      </div>
    </section>
  );
}
