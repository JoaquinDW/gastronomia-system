import Link from "next/link";
import { appUrl } from "@/lib/hosts";

// Tienda real de ejemplo en producción. Las fotos se piden a esa misma tienda
// como fondo, así si no cargan queda el color de base y no un ícono roto.
const demoUrl = "https://brasa-club.pedipue.com/";
const demoMedia = (id: string) =>
  `https://brasa-club.pedipue.com/api/media/${id}?size=small`;

const demoProducts = [
  {
    name: "Clásica",
    detail: "Pan de papa, medallón, queso, lechuga, tomate y papas.",
    price: "$ 6.500",
    image: demoMedia("e24edc2d-cea6-4f22-b2e4-975eabb1de9a"),
  },
  {
    name: "Cheddar & bacon",
    detail: "Doble cheddar, panceta ahumada y huevo frito.",
    price: "$ 9.000",
    image: demoMedia("fb097de8-c456-4e30-a8c2-98c12b2e307a"),
    inOrder: true,
  },
  {
    name: "Doble Brasa",
    detail: "Dos medallones, doble queso, jamón y huevo.",
    price: "$ 11.000",
    image: demoMedia("5431e0a4-8947-4fed-8316-251c12b423fb"),
  },
];

const flow = [
  {
    who: "Tu cliente",
    title: "Elige de tu carta",
    detail:
      "Con fotos y precios a la vista. Si un producto pide elegir gustos, salsa o tamaño, no lo puede agregar sin elegir.",
  },
  {
    who: "Tu cliente",
    title: "Pone la dirección y ve el total",
    detail:
      "La dirección se completa sola mientras escribe. El envío se calcula por distancia y el total aparece al final, sin sorpresas.",
  },
  {
    who: "Vos",
    title: "Te llega en vivo",
    detail:
      "Suena en tu panel con todo el detalle. Lo aceptás, imprimís la comanda y lo pasás de en preparación a listo.",
  },
  {
    who: "Tu cliente",
    title: "Sigue su pedido",
    detail:
      "Le mandás el link de seguimiento por WhatsApp y ve cuándo está listo o en camino. Menos mensajes de “¿falta mucho?”.",
  },
];

const modules = [
  {
    name: "Tu tienda, con tu nombre",
    detail:
      "Un link propio con foto de portada, tu carta con fotos y tu horario. Cuando lo compartís en WhatsApp o Instagram se ve con su imagen, no como un link pelado.",
  },
  {
    name: "Opciones como en el mostrador",
    detail:
      "Gustos de empanadas, salsa de las pastas, punto de la carne o adicionales. Vos decidís qué es obligatorio y qué suma precio.",
    isNew: true,
  },
  {
    name: "Delivery con costo automático",
    detail:
      "Marcás tu local en el mapa y armás radios: hasta 2 km, hasta 4 km. El cliente ve si llegás y cuánto sale el envío.",
    isNew: true,
  },
  {
    name: "Pedidos en vivo, con comanda",
    detail:
      "Los pedidos entran solos y con aviso sonoro. Cada uno avanza por sus estados, se imprime en comanda y el cliente lo sigue desde su celular.",
    isNew: true,
  },
  {
    name: "Stock, costos y resultados",
    detail:
      "Cargá recetas, compras y gastos. Cada pedido aceptado descuenta insumos y ves cuánto vendiste y cuánto te quedó.",
  },
  {
    name: "Te guiamos al arrancar",
    detail:
      "Una guía de primeros pasos en tu panel te marca qué falta para abrir: carta, fotos, portada, horarios, entregas y link.",
    isNew: true,
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
      "Sacale una foto al menú o subí el PDF y te la armamos. Vos revisás precios y fotos.",
  },
  {
    number: "03",
    title: "Compartí tu link",
    detail:
      "La guía del panel te lleva por horarios, retiro y delivery. Activás la tienda y ya podés recibir pedidos.",
  },
];

const questions = [
  {
    q: "¿Tengo que instalar algo?",
    a: "No. Tus clientes piden desde el navegador del celular y vos manejás todo desde el panel, en la compu o en el teléfono.",
  },
  {
    q: "¿Cómo cobro los pedidos?",
    a: "El cliente elige efectivo o transferencia. Que abra WhatsApp no significa que pagó: vos confirmás el pedido desde el panel y recién ahí se prepara.",
  },
  {
    q: "¿Ustedes hacen el reparto?",
    a: "No. El delivery es tuyo. Pedipue calcula si llegás a la dirección y cuánto cobrar de envío, y le pasa al cliente el seguimiento.",
  },
  {
    q: "¿Tengo que cargar la carta a mano?",
    a: "No hace falta. Subí una foto o el PDF de tu menú y te armamos la carta para que la revises.",
  },
];

const highlights = [
  "Carta desde una foto",
  "Delivery con costo por distancia",
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
          <a
            className="quiet-link header-demo"
            href={demoUrl}
            target="_blank"
            rel="noopener"
          >
            Ver ejemplo
          </a>
          <Link className="quiet-link" href={appUrl("/ingresar")}>
            Ingresar
          </Link>
          <Link
            className="primary-button compact-button"
            href={appUrl("/registro")}
          >
            Crear mi tienda <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      <main id="contenido">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              PARA HAMBURGUESERÍAS, PIZZERÍAS, ROTISERÍAS Y MÁS
            </p>
            <h1 id="hero-title">
              Tu tienda online.
              <br />
              Los pedidos, <em>directo.</em>
            </h1>
            <p className="hero-description">
              Tus clientes arman el pedido desde tu link, con el envío calculado
              y el total a la vista, y te lo mandan por WhatsApp. A vos te entra
              en vivo al panel. Sin pagarle comisión a las apps de delivery.
            </p>
            <div className="hero-actions">
              <Link
                className="primary-button compact-button"
                href={appUrl("/registro")}
              >
                Crear mi tienda <span aria-hidden="true">→</span>
              </Link>
              <a
                className="ghost-button"
                href={demoUrl}
                target="_blank"
                rel="noopener"
              >
                Ver una tienda de ejemplo <span aria-hidden="true">↗</span>
              </a>
            </div>
            <ul className="hero-points" aria-label="Lo que incluye">
              {highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <figure className="demo-preview">
            <a
              className="demo-phone"
              href={demoUrl}
              target="_blank"
              rel="noopener"
              aria-label="Abrir Brasa Club, la tienda de ejemplo, en otra pestaña"
            >
              <div className="demo-screen" aria-hidden="true">
                <div className="demo-cover">
                  <span
                    className="demo-photo"
                    style={{
                      backgroundImage: `url(${demoMedia("7f51cd7b-92fb-470e-8b49-ba1f2377f55b")})`,
                    }}
                  />
                  <span className="demo-status">ABIERTO AHORA</span>
                  <strong>Brasa Club</strong>
                </div>
                <span className="demo-logo">B</span>
                <p className="demo-tagline">
                  Hamburguesas con todas las letras
                </p>
                <div className="demo-chips">
                  <span data-active>Hamburguesas</span>
                  <span>Sándwiches</span>
                  <span>Combos</span>
                </div>
                <ul className="demo-products">
                  {demoProducts.map((p) => (
                    <li key={p.name} data-in-order={p.inOrder || undefined}>
                      <div>
                        <b>{p.name}</b>
                        <small>{p.detail}</small>
                        <span>{p.price}</span>
                      </div>
                      <figure>
                        <span
                          className="demo-photo"
                          style={{ backgroundImage: `url(${p.image})` }}
                        />
                        <i>{p.inOrder ? "1" : "+"}</i>
                      </figure>
                    </li>
                  ))}
                </ul>
                <div className="demo-bar">
                  <span>1</span>
                  Ver mi pedido · $ 9.000
                </div>
              </div>
            </a>
            <figcaption>
              <span className="demo-sticker">TIENDA DE EJEMPLO</span>
              <a href={demoUrl} target="_blank" rel="noopener">
                brasa-club.pedipue.com <span aria-hidden="true">↗</span>
              </a>
            </figcaption>
          </figure>
        </section>

        <section className="flow" aria-labelledby="flow-title">
          <div className="section-intro">
            <p className="eyebrow">UN PEDIDO, DE PUNTA A PUNTA</p>
            <h2 id="flow-title">Del link a la puerta, sin un solo audio.</h2>
          </div>
          <ol className="flow-steps">
            {flow.map((step, i) => (
              <li key={step.title}>
                <span className="flow-meta">
                  {String(i + 1).padStart(2, "0")} · {step.who}
                </span>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
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
              Todo esto ya funciona hoy, en el mismo panel. Lo marcado como nuevo
              se sumó esta semana.
            </p>
          </div>
          <div className="module-list">
            {modules.map((module, i) => (
              <article className="module-row" key={module.name}>
                <span className="module-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{module.name}</h3>
                  <p>{module.detail}</p>
                </div>
                {module.isNew ? (
                  <span className="module-tag">NUEVO</span>
                ) : (
                  <span />
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="demo-band" aria-labelledby="demo-title">
          <div>
            <p className="eyebrow">ANTES DE REGISTRARTE</p>
            <h2 id="demo-title">Mirá cómo quedaría tu carta.</h2>
            <p>
              Brasa Club es una hamburguesería de ejemplo armada con Pedipue.
              Abrila en el celular y recorrela como lo haría tu cliente: fotos,
              opciones, envío y total.
            </p>
          </div>
          <a
            className="primary-button"
            href={demoUrl}
            target="_blank"
            rel="noopener"
          >
            Abrir Brasa Club <span aria-hidden="true">↗</span>
          </a>
        </section>

        <section
          id="como-funciona"
          className="foundation"
          aria-labelledby="foundation-title"
        >
          <div>
            <p className="eyebrow">CÓMO ARRANCAR</p>
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
          </div>
          <aside className="start-card" aria-labelledby="start-card-title">
            <h2 id="start-card-title">Tu próximo pedido, por tu link.</h2>
            <p>
              Armá tu tienda hoy y empezá a recibir pedidos directo, con tu
              nombre y tu carta.
            </p>
            <Link className="primary-button" href={appUrl("/registro")}>
              Crear mi tienda <span aria-hidden="true">→</span>
            </Link>
            <Link className="text-link" href={appUrl("/ingresar")}>
              Ya tengo cuenta, ingresar
            </Link>
          </aside>
        </section>

        <section className="faq" aria-labelledby="faq-title">
          <h2 id="faq-title">Preguntas que nos hacen.</h2>
          <div>
            {questions.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
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
