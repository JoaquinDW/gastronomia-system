import { NextRequest } from "next/server";
import { businessInput } from "@/lib/business-input";
import { currentUser } from "@/server/auth";
import {
  BusinessConflict,
  createBusiness,
  listBusinesses,
} from "@/server/businesses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const user = await currentUser();
    if (!user)
      return Response.json(
        { error: "Iniciá sesión para continuar." },
        { status: 401, headers },
      );
    return Response.json(
      { businesses: await listBusinesses(user.id) },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "No pudimos cargar tus negocios. Volvé a intentar." },
      { status: 503, headers },
    );
  }
}

export async function POST(request: NextRequest) {
  // Next may normalize nextUrl to localhost even when the browser uses another loopback address.
  // Match the actual request host (or the host supplied by the hosting proxy).
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    request.nextUrl.protocol.replace(":", "");
  if (!host || request.headers.get("origin") !== `${protocol}://${host}`) {
    return Response.json(
      { error: "Origen de solicitud no permitido." },
      { status: 403, headers },
    );
  }
  try {
    const user = await currentUser();
    if (!user)
      return Response.json(
        { error: "Iniciá sesión para continuar." },
        { status: 401, headers },
      );
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return Response.json(
        { error: "Enviá los datos como JSON." },
        { status: 415, headers },
      );
    }
    // Bound the streamed body, including requests without Content-Length.
    const reader = request.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8_192) {
          await reader.cancel();
          return Response.json(
            { error: "La solicitud es demasiado grande." },
            { status: 413, headers },
          );
        }
        chunks.push(value);
      }
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return Response.json(
        { error: "Revisá los datos enviados." },
        { status: 400, headers },
      );
    }
    const parsed = businessInput.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: "Revisá los campos marcados.",
          fields: parsed.error.flatten().fieldErrors,
        },
        { status: 422, headers },
      );
    }
    const id = await createBusiness(user.id, parsed.data);
    return Response.json({ id }, { status: 201, headers });
  } catch (error) {
    if (error instanceof BusinessConflict) {
      return Response.json(
        {
          error:
            error.code === "slug_taken"
              ? "Ese identificador ya está reservado. Elegí otro para tu negocio."
              : "La solicitud cambió. Recargá la página antes de continuar.",
          ...(error.code === "slug_taken"
            ? { fields: { slug: ["Este identificador ya está en uso."] } }
            : {}),
        },
        { status: 409, headers },
      );
    }
    return Response.json(
      {
        error:
          "No pudimos dar de alta el negocio. Tus datos siguen en el formulario; volvé a intentar.",
      },
      { status: 503, headers },
    );
  }
}
