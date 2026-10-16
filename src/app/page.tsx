import Link from "next/link";

const modules = [
  {
    number: "01",
    name: "Tu tienda online",
    detail:
      "Tu carta con fotos, variantes y adicionales en un link propio. El cliente arma el pedido y te lo manda por WhatsApp.",
    tag: "Ya disponible",
  },
  {
    number: "02",
    name: "Pedidos en un solo lugar",
    detail:
      "Cada pedido entra a tu panel con número, detalle y total. Lo confirmás vos antes de que pase a cocina.",
    tag: "Ya disponible",
  },
  {
    number: "03",
    name: "Cocina",
    detail: "Comandas por estación y despacho coordinado, sin papelitos.",
    tag: "Próximamente",
  },
  {
    number: "04",
    name: "Caja y stock",
    detail: "Cobros, recetas, stock y los números del día, claros.",
    tag: "Próximamente",
  },
];

const steps = [
  {
    number: "01",
    title: "Creá tu cuenta",
    detail:
      "Nombre del local, rubro y el WhatsApp donde querés recibir pedidos.",
  },
  {
    number: "02",
    title: "Cargá tu carta",
    detail:
      "A mano, o subí una foto o un PDF del menú y te armamos un borrador para revisar.",
  },
  {
    number: "03",
    title: "Compartí tu link",
    detail:
      "Definí horarios, retiro o delivery, activá la tienda y pasala por Instagram, WhatsApp o un QR en el mostrador.",
  },
];

export default function Home() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="Pedipue, inicio">
          <span className="brand-mark" aria-hidden="true">
            p
          </span>
          <span>
            pedipue<span className="wordmark-dot">.</span>
          </span>
        </a>
        <nav className="header-actions" aria-label="Acceso al sistema">
          <Link className="quiet-link" href="/ingresar">
            Ingresar
          </Link>
          <Link className="primary-button compact-button" href="/registro">
            Registrar mi negocio <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <main id="contenido">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">HECHO PARA EL RITMO DE TU LOCAL</p>
            <h1 id="hero-title">
              De la primera orden
              <br />
              al último <em>despacho.</em>
            </h1>
            <p className="hero-description">
              Tu tienda online con link propio para que te pidan directo, sin
              depender de las apps de delivery. Para hamburgueserías, rotiserías
              y casas de pastas.
            </p>
            <div className="hero-actions">
              <Link className="primary-button compact-button" href="/registro">
                Dar de alta mi negocio <span aria-hidden="true">→</span>
              </Link>
              <a className="text-link" href="#como-funciona">
                Mirá cómo funciona <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <aside className="order-slip" aria-label="Cómo llega un pedido">
            <div className="slip-header">
              <span>PEDIDO</span>
              <span>#0142</span>
            </div>
            <h2>
              Así te llega
              <br />
              cada pedido.
            </h2>
            <ol>
              <li>
                <span>01</span>
                <div>
                  El cliente elige
                  <small>Arma el pedido desde tu carta online.</small>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  Te escribe por WhatsApp
                  <small>Con el resumen listo, sin idas y vueltas.</small>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  Vos confirmás
                  <small>Desde tu panel, antes de empezar a preparar.</small>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  Sale para la mesa o la puerta
                  <small>Retiro en el local o delivery, como trabajes.</small>
                </div>
              </li>
            </ol>
            <div className="slip-footer">
              PEDIDO DIRECTO. SIN INTERMEDIARIOS.
            </div>
          </aside>
        </section>

        <section
          id="que-incluye"
          className="scope"
          aria-labelledby="scope-title"
        >
          <div className="section-intro">
            <p className="eyebrow">QUÉ INCLUYE</p>
            <h2 id="scope-title">
              Vender, preparar
              <br /> y controlar.
            </h2>
            <p>
              Arrancás con la tienda y los pedidos. Lo demás se suma a medida
              que crece tu operación.
            </p>
          </div>
          <div className="module-list">
            {modules.map((module) => (
              <article className="module-row" key={module.number}>
                <span className="module-number">{module.number}</span>
                <div>
                  <h3>{module.name}</h3>
                  <p>{module.detail}</p>
                </div>
                <span className="module-tag">{module.tag}</span>
              </article>
            ))}
          </div>
        </section>

        <section
          id="como-funciona"
          className="foundation"
          aria-labelledby="foundation-title"
        >
          <div>
            <p className="eyebrow">CÓMO FUNCIONA</p>
            <h2 id="foundation-title">Tu tienda, lista en una tarde.</h2>
            <ol className="start-steps">
              {steps.map((step) => (
                <li key={step.number}>
                  <span>{step.number}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="foundation-note">
              Abrir WhatsApp no significa que el pedido esté pago ni aceptado.
              Vos lo confirmás desde el panel y recién ahí entra a cocina.
            </p>
          </div>
          <aside className="start-card" aria-labelledby="start-card-title">
            <h2 id="start-card-title">¿Arrancamos?</h2>
            <p>
              Creá tu cuenta, cargá la carta y compartí el link. Si ya tenés
              cuenta, entrá a tu panel.
            </p>
            <Link className="primary-button" href="/registro">
              Registrar mi negocio <span aria-hidden="true">→</span>
            </Link>
            <Link className="text-link" href="/ingresar">
              Ya tengo cuenta, ingresar
            </Link>
          </aside>
        </section>
      </main>
      <footer>
        <span>
          pedipue.com <span className="footer-dot">·</span> pedí directo
        </span>
        <span>Para locales que cocinan en serio.</span>
      </footer>
    </div>
  );
}
