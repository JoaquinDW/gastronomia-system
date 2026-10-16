"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="site-shell error-page">
      <p className="eyebrow">NO PUDIMOS CARGAR ESTA PÁGINA</p>
      <h1 className="form-title">Vamos a intentarlo de nuevo.</h1>
      <p>
        Hubo un problema de conexión. Si estabas completando un alta, revisá tus
        negocios antes de volver a crearla.
      </p>
      <button className="primary-button compact-button" onClick={reset}>
        Volver a intentar <span aria-hidden="true">↻</span>
      </button>
      <Link href="/panel" className="text-link">
        Ir a mis negocios
      </Link>
    </main>
  );
}
