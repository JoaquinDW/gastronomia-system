"use client";

import { useState } from "react";
import { resetAnalytics } from "@/lib/analytics";
import { authClient } from "@/lib/auth-client";
import { appUrl } from "@/lib/hosts";

export function SignOut() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="sign-out">
      <button
        className="quiet-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            const result = await authClient.signOut();
            if (result.error) throw new Error("Sign out failed");
            resetAnalytics();
            window.location.assign(appUrl("/ingresar"));
          } catch {
            setError(true);
            setBusy(false);
          }
        }}
      >
        {busy ? "Saliendo…" : "Cerrar sesión"}
      </button>
      {error ? (
        <span role="alert">No pudimos cerrar la sesión. Reintentá.</span>
      ) : null}
    </div>
  );
}
