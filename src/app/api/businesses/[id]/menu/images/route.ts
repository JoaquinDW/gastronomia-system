import { NextRequest } from "next/server";
import {
  apiError,
  authorizeBusiness,
  HttpError,
  json,
  readBody,
  sameOrigin,
} from "@/server/http";
import { saveMenuImage } from "@/server/menu-images";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(r: NextRequest, { params }: Context) {
  try {
    sameOrigin(r);
    const { id } = await params;
    const { user } = await authorizeBusiness(id, true);
    const type = r.headers.get("content-type") ?? "";
    if (!type.startsWith("multipart/form-data"))
      throw new HttpError(415, "Subí la foto desde el editor de productos.");
    const bytes = await readBody(r, 12 * 1024 * 1024);
    const form = await new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": type },
    }).formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0)
      throw new HttpError(422, "Elegí una foto para subir.");
    return json(
      await saveMenuImage(
        id,
        user.id,
        Buffer.from(await file.arrayBuffer()),
        form.get("kind") === "logo" ? "logo" : "photo",
      ),
      201,
    );
  } catch (e) {
    return apiError(e);
  }
}
