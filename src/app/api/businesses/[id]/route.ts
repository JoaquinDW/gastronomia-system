import type { NextRequest } from "next/server";
import { z } from "zod";
import { slugInput } from "@/lib/business-input";
import { currentUser } from "@/server/auth";
import { forgetBusinessHost } from "@/server/business-hosts";
import {
  BusinessConflict,
  changeBusinessSlug,
  findBusiness,
} from "@/server/businesses";
import {
  HttpError,
  apiError,
  authorizeBusiness,
  json,
  readJson,
  sameOrigin,
} from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    if (!user)
      return Response.json(
        { error: "Iniciá sesión para continuar." },
        { status: 401, headers },
      );
    const { id } = await context.params;
    const business = z.uuid().safeParse(id).success
      ? await findBusiness(user.id, id)
      : null;
    if (!business)
      return Response.json(
        { error: "No encontramos ese negocio en tu cuenta." },
        { status: 404, headers },
      );
    return Response.json({ business }, { headers });
  } catch {
    return Response.json(
      { error: "No pudimos cargar el negocio." },
      { status: 503, headers },
    );
  }
}

// Cambia la dirección de la tienda. Solo el propietario: también mueve la
// dirección del panel de todo el equipo.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const { id } = await context.params;
    const { business } = await authorizeBusiness(id);
    if (business.role !== "owner")
      throw new HttpError(
        403,
        "Solo el propietario puede cambiar la dirección de la tienda.",
      );
    const parsed = z
      .object({ slug: slugInput })
      .safeParse(await readJson(request, 2_048));
    if (!parsed.success)
      return json(
        {
          error: "Revisá la dirección.",
          fields: parsed.error.flatten().fieldErrors,
        },
        422,
      );
    const { slug } = parsed.data;
    const previous = await changeBusinessSlug(id, slug);
    if (previous) forgetBusinessHost(id, previous);
    return json({ slug, previous });
  } catch (error) {
    if (error instanceof BusinessConflict)
      return json(
        {
          error: "Esa dirección ya la usa otro negocio. Probá con otra.",
          fields: { slug: ["Esa dirección ya está en uso."] },
        },
        409,
      );
    return apiError(error);
  }
}
