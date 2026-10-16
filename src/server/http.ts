import "server-only";
import { z } from "zod";
import { currentUser } from "./auth";
import { findBusiness } from "./businesses";
import type { NextRequest } from "next/server";
import { HttpError } from "./errors";
export { HttpError } from "./errors";
export async function authorizeBusiness(id: string, edit = false) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Iniciá sesión para continuar.");
  if (!z.uuid().safeParse(id).success)
    throw new HttpError(404, "No encontramos el negocio.");
  const business = await findBusiness(user.id, id);
  if (!business)
    throw new HttpError(404, "No encontramos el negocio en tu cuenta.");
  if (edit && !["owner", "manager"].includes(business.role))
    throw new HttpError(
      403,
      "Tu rol no permite modificar la carta o la tienda.",
    );
  return { user, business };
}
export function sameOrigin(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    request.nextUrl.protocol.replace(":", "");
  if (!host || request.headers.get("origin") !== `${protocol}://${host}`)
    throw new HttpError(403, "Origen de solicitud no permitido.");
}
export async function readBody(
  request: Request,
  limit = 160_000,
): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(
        413,
        "El archivo o la solicitud supera el tamaño permitido.",
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function readJson(
  request: Request,
  limit = 160_000,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Enviá los datos como JSON.");
  try {
    return JSON.parse((await readBody(request, limit)).toString("utf8"));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "No pudimos leer la solicitud.");
  }
}
export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError)
    return json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .slice(0, 8)
          .join(" · "),
      },
      422,
    );
  return json(
    { error: "No pudimos completar la operación. Volvé a intentar." },
    503,
  );
}
