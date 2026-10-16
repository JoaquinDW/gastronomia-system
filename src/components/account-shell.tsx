import Link from "next/link";
import { Brand } from "./brand";

export function AccountShell({
  children,
  step = 1,
  login = false,
}: {
  children: React.ReactNode;
  step?: 1 | 2;
  login?: boolean;
}) {
  return (
    <div className="site-shell account-shell">
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="site-header">
        <Brand />
        <Link
          className="quiet-link"
          href={login ? "/registro" : step === 2 ? "/panel" : "/ingresar"}
        >
          {login
            ? "Crear una cuenta"
            : step === 2
              ? "Mis negocios"
              : "Ya tengo cuenta"}
          <span aria-hidden="true"> ↗</span>
        </Link>
      </header>
      <main id="contenido" className="account-layout">
        <aside className="account-story">
          <p className="eyebrow">EL COMIENZO DE TU NEGOCIO ACÁ</p>
          <h2>
            Tu local.
            <br /> Tu equipo.
            <br /> <em>Todo en su lugar.</em>
          </h2>
          <p>
            De la hamburguesa del viernes a las pastas del domingo. Empezá con
            los datos de tu emprendimiento.
          </p>
          {!login ? (
            <ol className="setup-steps" aria-label="Pasos del alta">
              <li
                aria-current={step === 1 ? "step" : undefined}
                className={step === 2 ? "completed" : ""}
              >
                <span>{step === 2 ? "✓" : "01"}</span>
                <div>
                  Tu cuenta<small>Para entrar de forma segura.</small>
                </div>
              </li>
              <li aria-current={step === 2 ? "step" : undefined}>
                <span>02</span>
                <div>
                  Tu negocio<small>Sus datos y tu lugar como dueño.</small>
                </div>
              </li>
            </ol>
          ) : (
            <p className="story-note">
              Cada negocio tiene su propio espacio. Entrá con la cuenta con la
              que lo registraste.
            </p>
          )}
        </aside>
        <div className="account-form-area">{children}</div>
      </main>
      <footer>
        <span>gastronomía · nombre de trabajo</span>
        <span>El primer paso hacia una operación más simple.</span>
      </footer>
    </div>
  );
}
