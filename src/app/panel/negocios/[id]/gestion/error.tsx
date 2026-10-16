"use client";
export default function ManagementError({ reset }: { reset: () => void }) {
  return (
    <section className="mg-notice" role="alert">
      <h2>No pudimos cargar Gestión.</h2>
      <p>
        Revisá tu conexión y volvé a intentar. Las operaciones confirmadas
        siguen guardadas.
      </p>
      <button className="secondary-button" onClick={reset}>
        Volver a intentar
      </button>
    </section>
  );
}
