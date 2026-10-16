import { NextRequest } from "next/server";
import { z } from "zod";
import {
  apiError,
  authorizeBusiness,
  HttpError,
  json,
  readJson,
  sameOrigin,
} from "@/server/http";
import { commandSchema } from "@/lib/management";
import {
  executeManagement,
  getManagementData,
  saleConsumptions,
} from "@/server/management";
import {
  csv,
  exportMovements,
  getManagementReport,
} from "@/server/management-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
function attachment(body: string, name: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
export async function GET(r: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    const { business } = await authorizeBusiness(id, true);
    const query = r.nextUrl.searchParams,
      view = query.get("view") ?? "data";
    const owner = business.role === "owner",
      from = query.get("from") ?? undefined,
      to = query.get("to") ?? undefined;
    if (["report", "export-results"].includes(view)) {
      if (!owner)
        throw new HttpError(
          403,
          "Solo el propietario puede ver resultados financieros.",
        );
      const report = await getManagementReport(id, from, to);
      if (view === "report") return json(report);
      return attachment(
        csv([
          ["Desde", report.from, "Hasta", report.to],
          ["Indicador", "Centavos / cantidad"],
          ["Total vendido", report.totals.revenue],
          ["Ingresos por envío", report.totals.delivery],
          ["Costo vendido conocido", report.totals.cost],
          ["Ventas menos su costo", report.totals.grossMargin],
          ["Gastos registrados", report.totals.expenses],
          ["Pérdidas registradas", report.totals.waste],
          ["Lo que te queda (estimado)", report.totals.result],
          ["Ventas registradas", report.totals.saleCount],
          ["Anulaciones", report.totals.cancelledCount],
          ["Ventas con costo completo", report.totals.completeCount],
          [
            "Pedidos anteriores con costo estimado",
            report.legacyEstimatedCount,
          ],
          ["Pedidos anteriores pendientes de costo", report.legacyPendingCount],
          ["Ticket promedio neto", report.totals.ticket],
          [
            "Costos de ventas incompletos",
            report.totals.costsIncomplete ? "Sí" : "No",
          ],
          [
            "Pérdidas sin costo cargado",
            report.totals.wasteIncomplete ? "Sí" : "No",
          ],
          [],
          [
            "Día",
            "Ventas (centavos)",
            "Costo conocido (centavos)",
            "Gastos (centavos)",
            "Pérdidas (centavos)",
            "Costos completos",
          ],
          ...report.days.map((d) => [
            d.date,
            d.revenue,
            d.cost,
            d.expenses,
            d.waste,
            d.complete ? "Sí" : "No",
          ]),
        ]),
        "resultados",
      );
    }
    if (view === "export-movements")
      return attachment(await exportMovements(id, from, to), "movimientos");
    if (view === "consumptions")
      return json(
        await saleConsumptions(id, z.uuid().parse(query.get("saleId"))),
      );
    if (view !== "data")
      throw new HttpError(404, "No encontramos esta vista de Gestión.");
    const offset = (key: string) =>
      z.coerce
        .number()
        .int()
        .min(0)
        .max(1_000_000)
        .parse(query.get(key) ?? 0);
    return json(
      await getManagementData(id, {
        owner,
        salesOffset: offset("salesOffset"),
        movementsOffset: offset("movementsOffset"),
        operationsOffset: offset("operationsOffset"),
      }),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id } = await params;
    const { user, business } = await authorizeBusiness(id, true);
    const command = commandSchema.parse(await readJson(r));
    return json(
      await executeManagement(id, user.id, command, business.role === "owner"),
      201,
    );
  } catch (e) {
    return apiError(e);
  }
}
