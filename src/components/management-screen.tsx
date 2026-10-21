import Link from "next/link";
import type { ManagementData, Report } from "@/lib/management";
import type { Product } from "@/lib/menu";
import { ManagementReport } from "./management-report";
import { ManagementWorkspace } from "./management-workspace";

// Una sección de Gestión ya cargada. La usan el panel y la demo.
export const managementSections = {
  resultados: "Resultados",
  inventario: "Inventario",
  recetas: "Recetas y preparación",
  compras: "Compras",
  ventas: "Ventas",
  gastos: "Gastos",
  proveedores: "Proveedores",
} as const;

export function ManagementScreen({
  businessId,
  base,
  section,
  action,
  data,
  products,
  owner,
  report,
  reportError,
}: {
  businessId: string;
  base: string;
  section: string;
  action?: string;
  data: ManagementData;
  products: Product[];
  owner: boolean;
  report: Report | null;
  reportError: string;
}) {
  const root = `${base}/gestion`;
  return (
    <>
      <div className="mg-heading">
        <div>
          <h1 className="panel-title">
            {section === "resultados"
              ? "¿Cómo va tu negocio?"
              : managementSections[section as keyof typeof managementSections]}
          </h1>
          <p>
            {section === "resultados"
              ? "Lo que vendés, lo que cuesta y lo que queda. Todo conectado."
              : section === "inventario"
                ? "Lo que tenés, lo que usás y lo que hace falta reponer."
                : section === "recetas"
                  ? "Cada porción tiene su costo. Cada tanda, su registro."
                  : section === "ventas"
                    ? "La tienda se suma sola. El resto, lo anotás acá."
                    : section === "compras"
                      ? "Una compra registrada: stock y costos al día."
                      : section === "gastos"
                        ? "Los gastos también cuentan en el resultado."
                        : "Los contactos que abastecen tu negocio."}
          </p>
        </div>
        {section === "resultados" ? (
          <Link
            className="primary-button compact-button"
            href={`${root}/ventas`}
          >
            Registrar venta
          </Link>
        ) : null}
      </div>
      {reportError ? (
        <section className="mg-notice">
          <h2>Revisá el período</h2>
          <p role="alert">{reportError}</p>
          <Link href={root}>Volver al mes actual</Link>
        </section>
      ) : null}
      {report ? (
        <ManagementReport
          report={report}
          businessId={businessId}
          panel={base}
          today={data.today}
          items={data.items}
          cutoffHour={data.settings.cutoffHour}
          recipes={data.recipes}
          products={products}
        />
      ) : null}
      <ManagementWorkspace
        key={`${section}-${action ?? ""}`}
        businessId={businessId}
        section={section}
        initialData={data}
        products={products}
        owner={owner}
        initialAction={
          section === "recetas" && action === "recipe"
            ? "recipe"
            : section === "inventario" && action === "costs"
              ? "costs"
              : undefined
        }
      />
    </>
  );
}
