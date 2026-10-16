import { NextRequest } from "next/server";
import { z } from "zod";
import {
  apiError,
  authorizeBusiness,
  HttpError,
  json,
  readBody,
  readJson,
  sameOrigin,
} from "@/server/http";
import { extractMenu, menuModel } from "@/server/menu-ai";
import {
  claimImport,
  commitImport,
  recentImports,
} from "@/server/menu-imports";
import { getPool } from "@/server/postgres";
import { productInput } from "@/lib/menu";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };
export async function GET(_r: Request, { params }: Context) {
  try {
    const { id } = await params;
    await authorizeBusiness(id, true);
    return json({ imports: await recentImports(id) });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(r: NextRequest, { params }: Context) {
  let importId: string | undefined;
  try {
    sameOrigin(r);
    const { id } = await params;
    const { user } = await authorizeBusiness(id, true);
    if (!process.env.OPENAI_API_KEY)
      throw new HttpError(
        503,
        "La importación con IA todavía no está configurada. Podés cargar productos manualmente.",
      );
    const type = r.headers.get("content-type") ?? "";
    if (!type.startsWith("multipart/form-data"))
      throw new HttpError(
        415,
        "Subí el archivo desde el formulario de importación.",
      );
    const bytes = await readBody(r, 12 * 1024 * 1024);
    const form = await new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": type },
    }).formData();
    const requestKey = z.uuid().parse(form.get("requestKey"));
    const text = z
      .string()
      .max(30000)
      .parse(form.get("text") ?? "");
    const files = form
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > 5)
      throw new HttpError(422, "Subí hasta cinco archivos por análisis.");
    const claim = await claimImport(id, user.id, requestKey, menuModel());
    if (!claim.fresh) {
      if (claim.status === "ready" || claim.status === "committed")
        return json({ id: claim.id, draft: claim.draft, status: claim.status });
      throw new HttpError(
        409,
        "Este análisis sigue en proceso o falló. Revisá las importaciones recientes o iniciá un intento nuevo.",
      );
    }
    importId = claim.id;
    const result = await extractMenu(files, text);
    await getPool().query(
      "UPDATE menu_imports SET status='ready',draft=$2,model=$3,input_tokens=$4,output_tokens=$5 WHERE id=$1",
      [
        importId,
        JSON.stringify(result.draft),
        result.model,
        result.inputTokens,
        result.outputTokens,
      ],
    );
    return json({ id: importId, draft: result.draft, status: "ready" });
  } catch (e) {
    if (importId)
      await getPool()
        .query("UPDATE menu_imports SET status='failed' WHERE id=$1", [
          importId,
        ])
        .catch(() => {});
    return apiError(e);
  }
}
export async function PUT(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id } = await params;
    await authorizeBusiness(id, true);
    const body = z
      .object({
        importId: z.uuid(),
        products: z.array(productInput).min(1).max(200),
        menuNote: z.string().max(2500).nullable(),
      })
      .strict()
      .parse(await readJson(r, 600000));
    return json({
      result: await commitImport(
        id,
        body.importId,
        body.products,
        body.menuNote,
      ),
    });
  } catch (e) {
    return apiError(e);
  }
}
