"use client";

import { useState } from "react";

type Status = "idle" | "checking" | "ok" | "error";

export function DatabaseCheck() {
  const [status, setStatus] = useState<Status>("idle");

  async function checkConnection() {
    setStatus("checking");
    try {
      const response = await fetch("/api/health/db", {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      const data: unknown = await response.json();
      const healthy =
        response.ok &&
        typeof data === "object" &&
        data !== null &&
        "status" in data &&
        data.status === "ok" &&
        "service" in data &&
        data.service === "postgres";
      setStatus(healthy ? "ok" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="connection" aria-labelledby="connection-title">
      <div className="connection-heading">
        <span className={`signal signal-${status}`} aria-hidden="true" />
        <h2 id="connection-title">La base de todo.</h2>
      </div>
      <p>Postgres en Neon. Una conexión real para empezar a construir.</p>
      <button
        type="button"
        onClick={checkConnection}
        disabled={status === "checking"}
      >
        {status === "checking" ? "Comprobando…" : "Comprobar conexión"}
        <span aria-hidden="true">↗</span>
      </button>
      <p className="connection-result" role="status" aria-live="polite">
        {status === "idle" ? "Todavía no comprobada en esta visita." : null}
        {status === "checking" ? "Consultando la base de datos…" : null}
        {status === "ok" ? "Conexión verificada con Postgres." : null}
        {status === "error"
          ? "No pudimos conectar. Revisá la configuración y volvé a intentar."
          : null}
      </p>
    </section>
  );
}
