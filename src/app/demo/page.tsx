import Link from "next/link";
import { storeUrl } from "@/lib/hosts";
import { demoData } from "@/server/demo";

export const metadata = { title: "Probá el panel — Pedipue" };

const tour = [
  {
    title: "Pedidos en vivo",
    detail:
      "Los de la tienda entran solos, con aviso. Aceptá uno, mandalo a cocina y marcá cuando sale.",
    href: "/demo/pedidos",
  },
  {
    title: "Modo cocina",
    detail:
      "La pantalla para la tablet de la cocina, con semáforo según la demora que prometiste.",
    href: "/demo/pedidos?cocina=1",
  },
  {
    title: "Caja",
    detail:
      "Cobrá con vuelto, registrá un retiro y cerrá el turno contando el efectivo a ciegas.",
    href: "/demo/caja",
  },
  {
    title: "Carta",
    detail:
      "Cambiá un precio, sumá un adicional o pausá un producto que se terminó.",
    href: "/demo/carta",
  },
  {
    title: "Resultados",
    detail:
      "Lo que vendiste, lo que costó y lo que te queda, con dos semanas de ventas cargadas.",
    href: "/demo/gestion",
  },
  {
    title: "Inventario y recetas",
    detail:
      "Cada venta descuenta sus insumos. Mirá qué hay que reponer y cuánto cuesta cada plato.",
    href: "/demo/gestion/inventario",
  },
];

export default async function DemoHome() {
  const { state } = await demoData();
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">EL PANEL POR DENTRO</p>
          <h1 className="panel-title">{state.business.name}.</h1>
          <p>
            Así se ve Pedipue del lado del local. {state.business.name} es una
            hamburguesería de ejemplo en {state.business.city}, con pedidos de
            hoy y ventas de las últimas dos semanas. Recorrela en el orden que
            quieras.
          </p>
        </div>
      </div>
      <ol className="demo-tour">
        {tour.map((step, i) => (
          <li key={step.title}>
            <Link href={step.href}>
              <span className="demo-tour-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
              <span className="demo-tour-go" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <section className="business-data demo-tour-store">
        <h2>Y del lado del cliente</h2>
        <p>
          La carta pública de {state.business.name} es la que ven sus clientes
          en el celular. Recorrela como lo haría uno de ellos.
        </p>
        <a
          className="secondary-button"
          href={storeUrl(state.business.slug)}
          target="_blank"
          rel="noopener"
        >
          Abrir la tienda <span aria-hidden="true">↗</span>
        </a>
      </section>
    </>
  );
}
