import Link from "next/link";

const modules = [
  {
    number: "01",
    name: "Tu tienda, con tu nombre",
    detail:
      "Un link propio con tu carta, fotos, variantes y adicionales. Lo pegás en tu Instagram, lo mandás por WhatsApp o lo imprimís en un QR.",
    tag: "Ya disponible",
  },
  {
    number: "02",
    name: "Pedidos claros, sin idas y vueltas",
    detail:
      "Cada pedido te llega con número, detalle y total. Se terminó anotar pedidos de audios y chats sueltos.",
    tag: "Ya disponible",
  },
  {
    number: "03",
    name: "Cocina en orden",
    detail:
      "Los pedidos confirmados pasan a cocina como comandas, por estación.",
    tag: "Próximamente",
  },
  {
    number: "04",
    name: "Caja y stock",
    detail:
      "Cobros del día, recetas e insumos que se descuentan con cada venta.",
    tag: "Próximamente",
  },
];

const steps = [
  {
    number: "01",
    title: "Registrá tu local",
    detail: "Nombre, rubro y el WhatsApp donde querés recibir los pedidos.",
  },
  {
    number: "02",
    title: "Subí tu carta",
    detail:
      "Sacale una foto al menú o subí el PDF y te la armamos. Vos revisás precios y listo.",
  },
  {
    number: "03",
    title: "Compartí tu link",
    detail:
      "Poné tus horarios, elegí retiro o delivery y activá la tienda. Ya podés recibir pedidos.",
  },
];

const highlights = [
  "Te cargamos la carta desde una foto",
  "Retiro y delivery",
  "Sin instalar nada",
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
            Crear mi tienda <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <main id="contenido">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              PARA HAMBURGUESERÍAS, ROTISERÍAS Y CASAS DE PASTAS
            </p>
            <h1 id="hero-title">
              Tu tienda online.
              <br />
              Los pedidos, <em>directo.</em>
            </h1>
            <p className="hero-description">
              Tus clientes arman el pedido desde tu link y te lo mandan por
              WhatsApp, ordenado y con el total. Vos lo confirmás desde el
              panel. Sin pagarle comisión a las apps de delivery.
            </p>
            <div className="hero-actions">
              <Link className="primary-button compact-button" href="/registro">
                Crear mi tienda <span aria-hidden="true">→</span>
              </Link>
              <a className="text-link" href="#como-funciona">
                Cómo funciona <span aria-hidden="true">↓</span>
              </a>
            </div>
            <ul className="hero-points" aria-label="Lo que incluye">
              {highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
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
              Menos chats sueltos.
              <br /> Más pedidos en orden.
            </h2>
            <p>
              Hoy arrancás con la tienda y los pedidos. Cocina, caja y stock se
              suman a tu mismo panel.
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
            <h2 id="foundation-title">En marcha en tres pasos.</h2>
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
              Vos tenés la última palabra: que el cliente abra WhatsApp no
              significa que el pedido esté pago ni aceptado. Lo confirmás desde
              el panel y recién ahí se prepara.
            </p>
          </div>
          <aside className="start-card" aria-labelledby="start-card-title">
            <h2 id="start-card-title">Tu próximo pedido, por tu link.</h2>
            <p>
              Armá tu tienda hoy y empezá a recibir pedidos directo, con tu
              nombre y tu carta.
            </p>
            <Link className="primary-button" href="/registro">
              Crear mi tienda <span aria-hidden="true">→</span>
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
        <span>Hecho para el ritmo de tu local.</span>
      </footer>
    </div>
  );
}
