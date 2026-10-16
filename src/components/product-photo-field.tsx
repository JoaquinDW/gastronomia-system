"use client";
import { useRef, useState } from "react";

type Focus = { x: number; y: number };
const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)));
import { productImage } from "@/lib/menu";

// Phone photos can weigh 5–10 MB. We shrink them in the browser so uploads stay
// fast on mobile data and under hosting body limits; the server makes the final WebP.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 4_000_000) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.9),
  );
}

export function ProductPhotoField({
  businessId,
  value,
  onChange,
  focus,
  onFocusChange,
  onBusyChange,
  disabled,
}: {
  businessId: string;
  value: string;
  onChange: (url: string) => void;
  focus: Focus;
  onFocusChange: (focus: Focus) => void;
  onBusyChange: (busy: boolean) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState("");
  const [moving, setMoving] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    start: Focus;
    spanX: number;
    spanY: number;
  } | null>(null);
  // Dragging moves the photo inside the frame, like positioning a print behind a mat:
  // the focus point shifts by how far the pointer moved over the part that gets cropped.
  function startDrag(e: React.PointerEvent<HTMLImageElement>) {
    if (locked) return;
    const img = e.currentTarget;
    const frame = img.getBoundingClientRect();
    const scale = Math.max(
      frame.width / img.naturalWidth,
      frame.height / img.naturalHeight,
    );
    const spanX = img.naturalWidth * scale - frame.width;
    const spanY = img.naturalHeight * scale - frame.height;
    if (spanX < 1 && spanY < 1) return;
    img.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: focus, spanX, spanY };
    setMoving(true);
  }
  function moveDrag(e: React.PointerEvent<HTMLImageElement>) {
    const d = drag.current;
    if (!d) return;
    onFocusChange({
      x:
        d.spanX < 1
          ? d.start.x
          : clamp(d.start.x - ((e.clientX - d.x) / d.spanX) * 100),
      y:
        d.spanY < 1
          ? d.start.y
          : clamp(d.start.y - ((e.clientY - d.y) / d.spanY) * 100),
    });
  }
  function endDrag() {
    drag.current = null;
    setMoving(false);
  }
  function nudge(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m || locked) return;
    e.preventDefault();
    onFocusChange({ x: clamp(focus.x + m[0]), y: clamp(focus.y + m[1]) });
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Elegí un archivo de imagen (JPG, PNG o WEBP).");
      return;
    }
    setError("");
    setUploading(true);
    onBusyChange(true);
    try {
      const body = new FormData();
      body.set("image", await shrink(file), "foto.jpg");
      const r = await fetch(`/api/businesses/${businessId}/menu/images`, {
        method: "POST",
        body,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No pudimos subir la foto.");
      onChange(d.url);
      onFocusChange({ x: 50, y: 50 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos subir la foto.");
    } finally {
      setUploading(false);
      onBusyChange(false);
      if (input.current) input.current.value = "";
    }
  }
  const image = value ? productImage(value) : null;
  const locked = disabled || uploading;
  return (
    <div className="photo-field">
      <div className="photo-field-label">
        Foto del producto <span className="optional-label">opcional</span>
      </div>
      <div
        className={`photo-drop ${image ? "has-photo" : ""} ${dragging ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          if (locked) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!locked) upload(e.dataTransfer.files[0]);
        }}
      >
        {image ? (
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes="(max-width: 600px) 100vw, 660px"
            alt="Vista previa de la foto del producto. Arrastrala o usá las flechas para acomodarla."
            referrerPolicy="no-referrer"
            draggable={false}
            tabIndex={locked ? -1 : 0}
            className={moving ? "is-moving" : ""}
            style={{ objectPosition: `${focus.x}% ${focus.y}%` }}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={nudge}
          />
        ) : (
          <button
            type="button"
            className="photo-empty"
            disabled={locked}
            onClick={() => input.current?.click()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h3l2-3h6l2 3h3v13H4z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <strong>Subí una foto que dé hambre</strong>
            <span>Arrastrala acá o tocá para elegirla</span>
          </button>
        )}
        {image && !uploading ? (
          <span className="photo-drag-hint" aria-hidden="true">
            Arrastrá para acomodar
          </span>
        ) : null}
        {uploading ? (
          <div className="photo-uploading" role="status">
            Subiendo foto…
          </div>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Elegir foto del producto"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      {image ? (
        <div className="photo-actions">
          <button
            type="button"
            className="secondary-button compact-button"
            disabled={locked}
            onClick={() => input.current?.click()}
          >
            Cambiar foto
          </button>
          <button
            type="button"
            className="quiet-button"
            disabled={locked || (focus.x === 50 && focus.y === 50)}
            onClick={() => onFocusChange({ x: 50, y: 50 })}
          >
            Centrar
          </button>
          <button
            type="button"
            className="quiet-button muted-action"
            disabled={locked}
            onClick={() => onChange("")}
          >
            Quitar
          </button>
        </div>
      ) : null}
      <p className="field-hint standalone-hint">
        {image
          ? "Lo que ves en el recuadro es lo que se ve en la tienda. Arrastrá la foto para que el producto quede bien encuadrado."
          : "Mejor horizontal, con buena luz y el plato centrado. En la tienda se muestra grande. Mínimo 600 px por lado."}
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {!image ? (
        <details className="photo-link">
          <summary>¿Ya la tenés publicada? Pegá el enlace</summary>
          <div>
            <input
              type="url"
              value={link}
              disabled={locked}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              aria-label="Enlace de la foto"
            />
            <button
              type="button"
              className="secondary-button compact-button"
              disabled={locked || !link.startsWith("https://")}
              onClick={() => {
                onChange(link.trim());
                setLink("");
              }}
            >
              Usar enlace
            </button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
