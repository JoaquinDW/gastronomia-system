"use client";
import { useEffect, useRef, useState } from "react";
import { productImage } from "@/lib/menu";
import { LogoFramer } from "./logo-framer";

// The logo goes in the sticker on the edge of the store cover. The preview
// shows it over the cover the business already chose, the way customers see it.
export function StoreLogoField({
  businessId,
  businessName,
  value,
  onChange,
  cover,
  onBusyChange,
  disabled,
}: {
  businessId: string;
  businessName: string;
  value: string;
  onChange: (url: string) => void;
  cover: { url: string; x: number; y: number };
  onBusyChange: (busy: boolean) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  // The image being framed: a file just picked, or the logo already uploaded.
  const [framing, setFraming] = useState<string | null>(null);
  useEffect(() => {
    if (!framing?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(framing);
  }, [framing]);
  function pick(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Elegí un archivo de imagen (PNG, JPG o WEBP).");
      return;
    }
    setError("");
    setFraming(URL.createObjectURL(file));
  }
  async function upload(logo: Blob) {
    setFraming(null);
    setError("");
    setUploading(true);
    onBusyChange(true);
    try {
      const body = new FormData();
      body.set("image", logo, "logo.png");
      body.set("kind", "logo");
      const r = await fetch(`/api/businesses/${businessId}/menu/images`, {
        method: "POST",
        body,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No pudimos subir el logo.");
      onChange(d.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos subir el logo.");
    } finally {
      setUploading(false);
      onBusyChange(false);
    }
  }
  const logo = value ? productImage(value) : null;
  const coverImage = cover.url ? productImage(cover.url) : null;
  const locked = disabled || uploading;
  return (
    <div className="logo-field">
      <div className="photo-field-label">
        Logo <span className="optional-label">opcional</span>
      </div>
      {framing ? (
        <LogoFramer
          src={framing}
          onDone={upload}
          onCancel={() => setFraming(null)}
        />
      ) : (
        <div className="logo-field-body">
          <div
            className={`logo-preview ${dragging ? "is-dragging" : ""}`}
            onDragOver={(e) => {
              if (locked) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!locked) pick(e.dataTransfer.files[0]);
            }}
          >
            <div className="logo-preview-cover" aria-hidden="true">
              {coverImage ? (
                <img
                  src={coverImage.src}
                  alt=""
                  referrerPolicy="no-referrer"
                  style={{ objectPosition: `${cover.x}% ${cover.y}%` }}
                />
              ) : null}
            </div>
            <button
              type="button"
              className={`logo-sticker ${logo ? "has-image" : ""}`}
              disabled={locked}
              onClick={() => input.current?.click()}
              aria-label={logo ? "Cambiar el logo" : "Subir el logo"}
            >
              {logo ? (
                <img
                  src={logo.src}
                  alt={`Logo de ${businessName}`}
                  referrerPolicy="no-referrer"
                />
              ) : (
                businessName.trim().slice(0, 1)
              )}
            </button>
            {uploading ? (
              <div className="photo-uploading" role="status">
                Subiendo logo…
              </div>
            ) : null}
          </div>
          <div className="logo-field-copy">
            <p className="field-hint">
              {logo
                ? "Así se ve sobre tu portada. También sale en el ticket y en la imagen cuando compartís el enlace."
                : "Sin logo, el sticker muestra la inicial de tu local. Mejor cuadrado, con fondo blanco o transparente. Mínimo 120 px por lado."}
            </p>
            <div className="photo-actions">
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={locked}
                onClick={() => input.current?.click()}
              >
                {logo ? "Cambiar logo" : "Subir logo"}
              </button>
              {logo ? (
                <button
                  type="button"
                  className="quiet-button"
                  disabled={locked}
                  onClick={() => setFraming(logo.large)}
                >
                  Acomodar
                </button>
              ) : null}
              {logo ? (
                <button
                  type="button"
                  className="quiet-button muted-action"
                  disabled={locked}
                  onClick={() => onChange("")}
                >
                  Quitar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Elegir el logo"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
