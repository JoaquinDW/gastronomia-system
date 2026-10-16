import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { findBusiness } from "@/server/businesses";
import { getProducts } from "@/server/menu";
import { getManagementData } from "@/server/management";
import { getManagementReport } from "@/server/management-reports";
import { BusinessNav } from "@/components/business-nav";
import { ManagementReport } from "@/components/management-report";
import { ManagementWorkspace } from "@/components/management-workspace";
import { HttpError } from "@/server/errors";
import { z } from "zod";
import "../management.css";

export const metadata = { title: "Gestión de tu negocio — Pedipue" };
const sections = {
  resultados: "Resultados",
  inventario: "Inventario",
  recetas: "Recetas y preparación",
  compras: "Compras",
  ventas: "Ventas",
  gastos: "Gastos",
  proveedores: "Proveedores",
} as const;
export default async function ManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; section?: string[] }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    page?: string;
    action?: string;
  }>;
}) {
  const user = await requireUser(),
    { id, section: path } = await params,
    query = await searchParams;
  if (!z.uuid().safeParse(id).success || (path?.length ?? 0) > 1) notFound();
  const business = await findBusiness(user.id, id);
  if (!business || !["owner", "manager"].includes(business.role)) notFound();
  const owner = business.role === "owner",
    section = path?.[0] ?? (owner ? "resultados" : "inventario");
  if (
    !(section in sections) ||
    (!owner && ["resultados", "gastos"].includes(section))
  )
    notFound();
  const root = `/panel/negocios/${id}/gestion`;
  const [data, products] = await Promise.all([
    getManagementData(id, { owner }),
    getProducts(id),
  ]);
  let report = null,
    reportError = "";
  if (section === "resultados") {
    try {
      report = await getManagementReport(id, query.from, query.to);
    } catch (e) {
      if (e instanceof HttpError && e.status === 422) reportError = e.message;
      else throw e;
    }
  }
  return (
    <>
      <Link className="back-link" href={`/panel/negocios/${id}`}>
        ← {business.name}
      </Link>
      <BusinessNav id={id} active="management" />
      <div className="mg-heading">
        <div>
          <h1 className="panel-title">
            {section === "resultados"
              ? "¿Cómo va tu negocio?"
              : sections[section as keyof typeof sections]}
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
      <nav className="mg-nav" aria-label="Secciones de Gestión">
        {Object.entries(sections)
          .filter(([key]) => owner || !["resultados", "gastos"].includes(key))
          .map(([key, label]) => (
            <Link
              key={key}
              href={key === "resultados" ? root : `${root}/${key}`}
              aria-current={section === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
      </nav>
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
          businessId={id}
          today={data.today}
          items={data.items}
          cutoffHour={data.settings.cutoffHour}
        />
      ) : null}
      <ManagementWorkspace
        key={`${section}-${query.action ?? ""}`}
        businessId={id}
        section={section}
        initialData={data}
        products={products}
        owner={owner}
        initialAction={
          section === "recetas" && query.action === "recipe"
            ? "recipe"
            : section === "inventario" && query.action === "costs"
              ? "costs"
              : undefined
        }
      />
    </>
  );
}
