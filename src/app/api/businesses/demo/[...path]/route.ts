import { NextRequest } from "next/server";
import { apiError, HttpError, json } from "@/server/http";
import { csv, resultsCsv } from "@/server/management-reports";
import { demoData, demoReport } from "@/server/demo";

// La demo pública del panel. Las pantallas de operación se atienden en el
// navegador (src/lib/demo/sandbox.ts); acá llega Gestión, de solo lectura, y
// cualquier pedido que se escape. Nunca consulta ni escribe datos de negocios.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const readOnly =
  "Esto es una demo: en Gestión podés mirar todo, pero los cambios no se guardan. Creá tu cuenta gratis para cargar los tuyos.";

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
    const { path } = await params;
    if (path.join("/") !== "management")
      throw new HttpError(404, "Esta parte no está disponible en la demo.");
    const query = r.nextUrl.searchParams,
      view = query.get("view") ?? "data",
      from = query.get("from") ?? undefined,
      to = query.get("to") ?? undefined;
    const { management, consumptions } = await demoData();
    if (view === "data") return json(management);
    if (view === "consumptions")
      return json(consumptions[query.get("saleId") ?? ""] ?? []);
    if (view === "report") return json(await demoReport(from, to));
    if (view === "export-results")
      return attachment(resultsCsv(await demoReport(from, to)), "resultados");
    if (view === "export-movements") {
      const items = new Map(management.items.map((i) => [i.id, i.unit]));
      return attachment(
        csv([
          [
            "Fecha",
            "Insumo",
            "Unidad",
            "Cantidad",
            "Movimiento",
            "Costo (centavos)",
            "Motivo",
          ],
          ...management.movements
            .filter(
              (m) =>
                (!from || m.createdAt >= from) &&
                (!to || m.createdAt.slice(0, 10) <= to),
            )
            .map((m) => [
              m.createdAt,
              m.itemName,
              items.get(m.itemId) ?? "",
              m.quantity,
              m.kind,
              m.costCents,
              m.reason,
            ]),
        ]),
        "movimientos",
      );
    }
    throw new HttpError(404, "No encontramos esta vista de Gestión.");
  } catch (e) {
    return apiError(e);
  }
}

const blocked = async () => json({ error: readOnly }, 403);
export const POST = blocked,
  PUT = blocked,
  DELETE = blocked;
