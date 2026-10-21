import { notFound } from "next/navigation";
import {
  managementSections,
  ManagementScreen,
} from "@/components/management-screen";
import { DEMO_ID } from "@/lib/demo/sandbox";
import { demoData, demoReport } from "@/server/demo";
import { HttpError } from "@/server/errors";
import "../../../panel/negocios/[id]/gestion/management.css";

export const metadata = { title: "Gestión · Demo — Pedipue" };
export default async function DemoManagementPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ from?: string; to?: string; action?: string }>;
}) {
  const { section: path } = await params,
    query = await searchParams;
  const section = path?.[0] ?? "resultados";
  if ((path?.length ?? 0) > 1 || !(section in managementSections)) notFound();
  const { management, state } = await demoData();
  let report = null,
    reportError = "";
  if (section === "resultados") {
    try {
      report = await demoReport(query.from, query.to);
    } catch (e) {
      if (e instanceof HttpError && e.status === 422) reportError = e.message;
      else throw e;
    }
  }
  return (
    <ManagementScreen
      businessId={DEMO_ID}
      base="/demo"
      section={section}
      action={query.action}
      data={management}
      products={state.products}
      owner
      report={report}
      reportError={reportError}
    />
  );
}
