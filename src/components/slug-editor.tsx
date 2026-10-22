"use client";

import { useState } from "react";
import { slugInput } from "@/lib/business-input";
import { businessPanelUrl, storeUrl } from "@/lib/hosts";

// Dirección de la tienda, editable por el propietario. La anterior queda como
// alias y redirige, así no se rompen QR ni links compartidos.
export function SlugEditor({
  businessId,
  slug,
  editable,
}: {
  businessId: string;
  slug: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!editing)
    return (
      <div className="slug-row">
        <span className="slug-value">{slug}</span>
        {editable ? (
          <button
            type="button"
            className="slug-change"
            onClick={() => setEditing(true)}
          >
            Cambiar
          </button>
        ) : null}
      </div>
    );

  const compact = slug.replaceAll("-", "");
  const preview = storeUrl(value || slug).replace(/^https?:\/\//, "");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const parsed = slugInput.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisá la dirección.");
      return;
    }
    if (parsed.data === slug) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: parsed.data }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(
          data.fields?.slug?.[0] ??
            data.error ??
            "No pudimos cambiar la dirección. Volvé a intentar.",
        );
        setBusy(false);
        return;
      }
      // El panel también vive en la dirección nueva.
      window.location.assign(businessPanelUrl(businessId, data.slug));
    } catch {
      setError("No pudimos conectar. Volvé a intentar.");
      setBusy(false);
    }
  }

  return (
    <form className="app-form slug-form" onSubmit={save} noValidate>
      <fieldset disabled={busy}>
        <label>
          Nueva dirección
          <input
            name="slug"
            value={value}
            onChange={(event) => {
              setValue(event.target.value.toLowerCase());
              setError("");
            }}
            maxLength={63}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? "slug-edit-error" : "slug-edit-hint"}
          />
          {error ? (
            <span className="field-error" id="slug-edit-error">
              {error}
            </span>
          ) : null}
        </label>
        <p id="slug-edit-hint" className="field-hint">
          Tu tienda va a quedar en <strong>{preview}</strong>. Los guiones son
          opcionales. La dirección anterior sigue funcionando y lleva a la
          nueva.
        </p>
        {compact !== slug && value !== compact ? (
          <button
            type="button"
            className="slug-suggestion"
            onClick={() => setValue(compact)}
          >
            Usar sin guiones: <span>{compact}</span>
          </button>
        ) : null}
        <div className="slug-actions">
          <button type="submit" className="primary-button">
            {busy ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setEditing(false);
              setValue(slug);
              setError("");
            }}
          >
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}
