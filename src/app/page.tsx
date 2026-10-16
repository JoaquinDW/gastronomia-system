import { DatabaseCheck } from "@/components/database-check";
import Link from "next/link";

const modules = [
  {
    number: "01",
    name: "Tu tienda",
    detail: "Carta, variantes, adicionales y checkout por WhatsApp.",
    tag: "Vender",
  },
  {
    number: "02",
    name: "Pedidos y ventas",
    detail: "Mostrador y tienda juntos. Cada pedido, en su lugar.",
    tag: "Organizar",
  },
  {
    number: "03",
    name: "Cocina",
    detail: "Comandas por estación y expedición coordinada.",
    tag: "Preparar",
  },
  {
    number: "04",
    name: "Gestión",
    detail: "Caja, cobros, recetas, stock y números claros.",
    tag: "Controlar",
  },
];

export default function Home() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="Gastronomía, inicio">
          <span className="brand-mark" aria-hidden="true">
            g.
          </span>{" "}
          gastronomía
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
              Un sistema para vender, preparar y gestionar. Pensado desde el
              comienzo para hamburgueserías, rotiserías y casas de pastas.
            </p>
            <div className="hero-actions">
              <Link className="primary-button compact-button" href="/registro">
                Dar de alta mi negocio <span aria-hidden="true">→</span>
              </Link>
              <a className="text-link" href="#alcance">
                Conocé el alcance de la V1 <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
          <aside className="order-slip" aria-label="Flujo propuesto del pedido">
            <div className="slip-header">
              <span>EL RECORRIDO</span>
              <span>V.01</span>
            </div>
            <h2>
              Todo empieza
              <br />
              con un pedido.
            </h2>
            <ol>
              <li>
                <span>01</span>
                <div>
                  El cliente elige
                  <small>Su pedido se guarda en la tienda.</small>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  Abre WhatsApp<small>Envía el resumen al negocio.</small>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  El local confirma
                  <small>Recién entonces entra a cocina.</small>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  Se prepara y entrega
                  <small>Cobros y stock acompañan el proceso.</small>
                </div>
              </li>
            </ol>
            <div className="slip-footer">UN PEDIDO. UNA SOLA OPERACIÓN.</div>
          </aside>
        </section>

        <section id="alcance" className="scope" aria-labelledby="scope-title">
          <div className="section-intro">
            <p className="eyebrow">UNA V1 CON AMBICIÓN</p>
            <h2 id="scope-title">
              Cuatro partes.
              <br /> El mismo negocio.
            </h2>
            <p>
              Cada emprendimiento con su marca, su equipo y sus datos separados.
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

        <section className="foundation" aria-labelledby="foundation-title">
          <div>
            <p className="eyebrow">PUNTO DE PARTIDA</p>
            <h2 id="foundation-title">Primero, buenos cimientos.</h2>
            <p>
              Ya podés crear tu cuenta y dar de alta tu negocio. La tienda, las
              ventas y la cocina se construirán en las próximas entregas.
            </p>
            <p className="foundation-note">
              El checkout acordado guarda el pedido y abre WhatsApp. La
              confirmación siempre la hace el negocio desde su panel.
            </p>
          </div>
          <DatabaseCheck />
        </section>
      </main>
      <footer>
        <span>
          gastronomía <span className="footer-dot">·</span> nombre de trabajo
        </span>
        <span>Negocios chicos. Una operación bien pensada.</span>
      </footer>
    </div>
  );
}
