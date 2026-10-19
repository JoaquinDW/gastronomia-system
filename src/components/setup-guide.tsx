"use client";

import Link from "next/link";
import { useState } from "react";
import { guideCookie, type SetupStep } from "@/lib/setup-guide";

// Guía "Primeros pasos" del resumen del local. No bloquea nada: se puede
// ocultar y volver a abrir, y cada paso se tilda solo con los datos reales.

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  );
}

export function SetupGuide({
  businessId,
  steps,
  shareUrl,
  initiallyHidden,
}: {
  businessId: string;
  steps: SetupStep[];
  // Enlace público de la tienda, solo cuando ya está publicada.
  shareUrl: string | null;
  initiallyHidden: boolean;
}) {
  const [hidden, setHidden] = useState(initiallyHidden);
  const [copied, setCopied] = useState(false);
  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (!next) return null;

  function toggle(hide: boolean) {
    document.cookie = `${guideCookie(businessId)}=${hide ? "oculta" : ""}; path=/; max-age=${hide ? 31_536_000 : 0}; samesite=lax`;
    setHidden(hide);
  }

  if (hidden)
    return (
      <div className="setup-guide-reopen">
        <button
          type="button"
          className="quiet-button"
          onClick={() => toggle(false)}
        >
          Ver primeros pasos · {doneCount} de {total}
        </button>
      </div>
    );

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(
        new URL(shareUrl, window.location.origin).href,
      );
      setCopied(true);
    } catch {
      window.open(shareUrl, "_blank");
    }
  }

  return (
    <section className="setup-guide" aria-labelledby="setup-guide-title">
      <div className="setup-guide-head">
        <div>
          <p className="eyebrow">
            Primeros pasos · {doneCount} de {total}
          </p>
          <h2 id="setup-guide-title">Dejá tu tienda lista para vender.</h2>
          <p>
            Seguí el orden y en un rato estás recibiendo pedidos. Cada paso se
            tilda solo cuando lo terminás.
          </p>
        </div>
        <button
          type="button"
          className="quiet-button"
          onClick={() => toggle(true)}
        >
          Ocultar
        </button>
      </div>
      <div
        className="setup-progress"
        role="progressbar"
        aria-label="Avance de los primeros pasos"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={doneCount}
      >
        <span style={{ width: `${(doneCount / total) * 100}%` }} />
      </div>
      <ol>
        {steps.map((step, i) => {
          const isNext = step === next;
          return (
            <li
              key={step.key}
              className={step.done ? "done" : isNext ? "next" : undefined}
              aria-current={isNext ? "step" : undefined}
            >
              <span className="setup-mark">
                {step.done ? <Check /> : String(i + 1).padStart(2, "0")}
              </span>
              <div className="setup-body">
                <strong>{step.title}</strong>
                {step.done ? null : <p>{step.why}</p>}
                {step.detail ? <small>{step.detail}</small> : null}
              </div>
              {step.done ? (
                <Link className="setup-link" href={step.href}>
                  Ver
                </Link>
              ) : isNext && step.key === "share" && shareUrl ? (
                <div className="setup-actions">
                  <button
                    type="button"
                    className="primary-button compact-button"
                    onClick={copy}
                  >
                    {copied ? "Link copiado" : "Copiar link"}
                  </button>
                  <Link className="setup-link" href={step.href}>
                    {step.action} →
                  </Link>
                </div>
              ) : isNext ? (
                <Link
                  className="primary-button compact-button"
                  href={step.href}
                >
                  {step.action} <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <Link className="setup-link" href={step.href}>
                  {step.action} →
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
