import { z } from "zod";
import { currentUser } from "@/server/auth";
import { findBusiness } from "@/server/businesses";

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
