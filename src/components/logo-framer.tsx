"use client";
import { useEffect, useRef, useState } from "react";

// Frames a logo in the square the sticker shows before uploading it: starts
// centered on the drawing (ignoring white or transparent margins), and lets
// the business drag it, resize it or center it again. The result is a square
// PNG, so the store, the share image and the ticket all show the same thing.
type Frame = { zoom: number; x: number; y: number };
const OUTPUT = 800;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const clampOffset = (n: number) => Math.min(1, Math.max(-1, n));

/** Box around what isn't white or transparent, in image pixels; null if it can't be read. */
function drawingBox(img: HTMLImageElement) {
  const scale = Math.min(
    1,
    256 / Math.max(img.naturalWidth, img.naturalHeight),
  );
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
  let left = w,
    top = h,
    right = -1,
    bottom = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const blank =
        data[i + 3] < 16 ||
        (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240);
      if (blank) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  if (right < 0) return null;
  return {
    x: left / scale,
    y: top / scale,
    width: (right - left + 1) / scale,
    height: (bottom - top + 1) / scale,
  };
}

/** Zoom and offset that put the drawing in the middle, with a small margin. */
function centered(img: HTMLImageElement): Frame {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const box = drawingBox(img) ?? { x: 0, y: 0, width: w, height: h };
  // Image size inside a 1×1 frame at zoom 1 (contained).
  const fit = 1 / Math.max(w, h);
  // A logo that already reaches its edges (a filled square) fills the
  // sticker; a drawing on a blank background keeps a small margin.
  const bleeds = box.width >= w * 0.97 && box.height >= h * 0.97;
  const zoom = clampZoom(
    (bleeds ? 1 : 0.92) / (Math.max(box.width, box.height) * fit),
  );
  return {
    zoom,
    x: clampOffset(-(box.x + box.width / 2 - w / 2) * fit * zoom),
    y: clampOffset(-(box.y + box.height / 2 - h / 2) * fit * zoom),
  };
}

/** Where the image goes in a square of `size` px for a frame. */
function placement(img: HTMLImageElement, frame: Frame, size: number) {
  const fit = size / Math.max(img.naturalWidth, img.naturalHeight);
  const width = img.naturalWidth * fit * frame.zoom;
  const height = img.naturalHeight * fit * frame.zoom;
  return {
    left: size / 2 + frame.x * size - width / 2,
    top: size / 2 + frame.y * size - height / 2,
    width,
    height,
  };
}

export function LogoFramer({
  src,
  onDone,
  onCancel,
}: {
  src: string;
  onDone: (logo: Blob) => void;
  onCancel: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [frame, setFrame] = useState<Frame>({ zoom: 1, x: 0, y: 0 });
  const [start, setStart] = useState<Frame | null>(null);
  const [error, setError] = useState("");
  const [moving, setMoving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    from: Frame;
    size: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    const image = new Image();
    // Uploaded logos may live in public storage; ask for pixels we can read.
    if (!src.startsWith("blob:")) image.crossOrigin = "anonymous";
    image.src = src;
    image
      .decode()
      .then(() => {
        if (!alive) return;
        const auto = centered(image);
        setImg(image);
        setFrame(auto);
        setStart(auto);
      })
      .catch(() => {
        if (alive)
          setError(
            "No pudimos abrir el logo para acomodarlo. Elegí el archivo de nuevo.",
          );
      });
    return () => {
      alive = false;
    };
  }, [src]);

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    const rect = box.current?.getBoundingClientRect();
    if (!img || !rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      from: frame,
      size: rect.width,
    };
    setMoving(true);
  }
  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setFrame({
      ...d.from,
      x: clampOffset(d.from.x + (e.clientX - d.x) / d.size),
      y: clampOffset(d.from.y + (e.clientY - d.y) / d.size),
    });
  }
  function endDrag() {
    drag.current = null;
    setMoving(false);
  }
  function nudge(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setFrame((f) => ({
      ...f,
      x: clampOffset(f.x + m[0]),
      y: clampOffset(f.y + m[1]),
    }));
  }
  function use() {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const p = placement(img, frame, OUTPUT);
    canvas.getContext("2d")?.drawImage(img, p.left, p.top, p.width, p.height);
    try {
      canvas.toBlob((blob) => {
        if (blob) onDone(blob);
        else setError("No pudimos preparar el logo. Probá de nuevo.");
      }, "image/png");
    } catch {
      setError(
        "No pudimos abrir el logo para acomodarlo. Elegí el archivo de nuevo.",
      );
    }
  }

  const p = img ? placement(img, frame, 100) : null;
  return (
    <div className="logo-framer">
      <div className="logo-framer-stage">
        <div
          ref={box}
          className={`logo-framer-box ${moving ? "is-moving" : ""}`}
          tabIndex={0}
          role="group"
          aria-label="Encuadre del logo. Arrastralo o usá las flechas para moverlo."
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={nudge}
        >
          {img && p ? (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: `${p.width}%`,
                height: `${p.height}%`,
              }}
            />
          ) : null}
        </div>
      </div>
      <div className="logo-framer-controls">
        <p className="field-hint">
          Lo que queda dentro del cuadro es lo que va en el sticker. Arrastralo
          para moverlo y usá el tamaño para acercarlo.
        </p>
        <label className="logo-framer-zoom">
          Tamaño
          <input
            type="range"
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
            step={1}
            value={Math.round(frame.zoom * 100)}
            disabled={!img}
            onChange={(e) =>
              setFrame((f) => ({
                ...f,
                zoom: clampZoom(Number(e.target.value) / 100),
              }))
            }
          />
        </label>
        <div className="photo-actions">
          <button
            type="button"
            className="primary-button compact-button"
            disabled={!img}
            onClick={use}
          >
            Usar este logo
          </button>
          <button
            type="button"
            className="quiet-button"
            disabled={
              !start ||
              (frame.zoom === start.zoom &&
                frame.x === start.x &&
                frame.y === start.y)
            }
            onClick={() => start && setFrame(start)}
          >
            Centrar
          </button>
          <button
            type="button"
            className="quiet-button muted-action"
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
