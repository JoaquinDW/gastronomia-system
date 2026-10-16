import { getAuth } from "@/server/auth";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

function handle(request: NextRequest, context: RouteContext) {
  const handler = getAuth().handler();
  const method = request.method as keyof typeof handler;
  return handler[method](request, context);
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as DELETE,
  handle as PATCH,
};
