"use client";
import { useState } from "react";
import type { KitchenConfig } from "@/lib/kitchen";

const minuteChoices = [10, 15, 20, 25, 30, 40, 45, 60, 90];
const warnChoices = [2, 3, 5, 10, 15];

export function KitchenSettings({
  businessId,
  config,
  onSaved,
  onClose,
}: {
  businessId: string;
  config: KitchenConfig;
  onSaved: (config: KitchenConfig) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(config);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = JSON.stringify(form) !== JSON.stringify(config);
  // Keep a saved value that isn't in the list selectable.
  const options = (list: number[], value: number) =>
    [...new Set([...list, value])].sort((a, b) => a - b);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch(`/api/businesses/${businessId}/kitchen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitchen: form }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      onSaved(d.kitchen);
      setForm(d.kitchen);
      setMessage("Listo, guardado para todo el local.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="print-settings" aria-labelledby="kitchen-settings-title">
      <div className="print-settings-heading">
        <h2 id="kitchen-settings-title">Tiempos</h2>
        <button type="button" className="text-button" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <p className="section-description">
        Cada pedido en preparación se pinta según el tiempo que prometiste al
        aceptarlo: <b className="light-chip" data-light="ok">verde</b> va a
        tiempo, <b className="light-chip" data-light="soon">amarillo</b> está
        por vencer y <b className="light-chip" data-light="late">rojo</b> ya
        se pasó.
      </p>
      <form className="app-form" onSubmit={save}>
        <label>
          Si no cargaste demora al aceptar, contar
          <select
            value={form.defaultMinutes}
            onChange={(e) => setForm({ ...form, defaultMinutes: Number(e.target.value) })}
          >
            {options(minuteChoices, form.defaultMinutes).map((n) => (
              <option value={n} key={n}>
                {n} minutos
              </option>
            ))}
          </select>
        </label>
        <label>
          Pasar a amarillo cuando falten
          <select
            value={form.warnMinutes}
            onChange={(e) => setForm({ ...form, warnMinutes: Number(e.target.value) })}
          >
            {options(warnChoices, form.warnMinutes).map((n) => (
              <option value={n} key={n}>
                {n} minutos
              </option>
            ))}
          </select>
        </label>
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
        <button className="primary-button compact-button" disabled={busy || !changed}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </section>
  );
}
