import { getAuth } from "@/server/auth";
import { hostOrigin, rootDomain, routeHost } from "@/lib/hosts";
import { NextResponse, type NextRequest } from "next/server";

const authPaths = ["/panel", "/alta"];
const appPaths = [...authPaths, "/ingresar", "/registro"];
const storePath = /^\/t\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/.*)?$/;

const under = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export default function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const root = rootDomain();
  const route = routeHost(request.headers.get("host"), root);
  const moveTo = (host: string, path = pathname + search) =>
    NextResponse.redirect(new URL(path, hostOrigin(host)), 308);

  if (route.kind === "store") {
    if (pathname.startsWith("/api/")) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/t/${route.slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  if (route.kind === "unused") return moveTo(root, "/");

  const shop = pathname.match(storePath);
  const toShop = (slug: string, rest = "/") =>
    moveTo(`${slug}.${root}`, rest + search);

  if (route.kind === "site") {
    if (under(pathname, appPaths)) return moveTo(`app.${root}`);
    if (shop) return toShop(shop[1], shop[2]);
    return NextResponse.next();
  }
  if (route.kind === "app") {
    if (pathname === "/") return moveTo(`app.${root}`, "/panel");
    // La vista previa queda en app. porque necesita la sesión del panel.
    if (shop && searchParams.get("preview") !== "1")
      return toShop(shop[1], shop[2]);
  }

  return under(pathname, authPaths)
    ? getAuth().middleware({ loginUrl: "/ingresar" })(request)
    : NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico$|.*\\.[a-z0-9]+$).*)"],
};
