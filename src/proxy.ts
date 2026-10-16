import { getAuth } from "@/server/auth";
import type { NextRequest } from "next/server";

export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: "/ingresar" })(request);
}

export const config = { matcher: ["/panel/:path*", "/alta/:path*"] };
