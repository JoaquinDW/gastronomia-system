import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { findBusiness } from "@/server/businesses";
import { getProducts } from "@/server/menu";
import { getManagementData } from "@/server/management";
import { getManagementReport } from "@/server/management-reports";
import {
  managementSections,
  ManagementScreen,
} from "@/components/management-screen";
import { HttpError } from "@/server/errors";
import { z } from "zod";
import "../management.css";
import { panelBase } from "@/lib/hosts";

export const metadata = { title: "Gestión de tu negocio — Pedipue" };
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
    !(section in managementSections) ||
    (!owner && ["resultados", "gastos"].includes(section))
  )
    notFound();
  const base = panelBase(id, business.slug);
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
    <ManagementScreen
      businessId={id}
      base={base}
      section={section}
      action={query.action}
      data={data}
      products={products}
      owner={owner}
      report={report}
      reportError={reportError}
    />
  );
}
