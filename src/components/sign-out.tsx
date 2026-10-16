"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOut() {
  const router = useRouter();
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
            router.replace("/ingresar");
            router.refresh();
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
