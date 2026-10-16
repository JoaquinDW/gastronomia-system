import { getAuth } from "@/server/auth";
import { businessIdForSlug, businessSlugForId } from "@/server/business-hosts";
import { appUrl, hostOrigin, rootDomain, routeHost } from "@/lib/hosts";
import { NextResponse, type NextRequest } from "next/server";

const authPaths = ["/panel", "/alta"];
const appPaths = [...authPaths, "/ingresar", "/registro"];
const storePath = /^\/t\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/.*)?$/;
const businessPanelPath = /^\/panel\/negocios\/([0-9a-f-]{36})(\/.*)?$/i;

const under = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export default async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const root = rootDomain();
  const route = routeHost(request.headers.get("host"), root);
  const moveTo = (host: string, path = pathname + search, status = 308) =>
    NextResponse.redirect(new URL(path, hostOrigin(host)), status);

  if (route.kind === "store") {
    if (pathname.startsWith("/api/")) return NextResponse.next();
    if (under(pathname, ["/panel"])) return storePanel(request, route.slug);
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
    if (shop && searchParams.get("preview") !== "1")
      return toShop(shop[1], shop[2]);
    // La gestión de cada local vive en su subdominio.
    const panel = pathname.match(businessPanelPath);
    const slug =
      panel &&
      (await businessSlugForId(panel[1].toLowerCase()).catch(() => null));
    if (panel && slug)
      return moveTo(`${slug}.${root}`, `/panel${panel[2] ?? ""}${search}`, 307);
  }

  return under(pathname, authPaths)
    ? getAuth().middleware({ loginUrl: appUrl("/ingresar") })(request)
    : NextResponse.next();
}

// mitienda.<raíz>/panel/... se sirve desde /panel/negocios/<id>/... con la
// sesión compartida; sin sesión, se ingresa en app. y se vuelve acá.
async function storePanel(request: NextRequest, slug: string) {
  const { pathname, search } = request.nextUrl;
  const here = `${hostOrigin(request.headers.get("host") ?? "")}${pathname}${search}`;
  const auth = await getAuth().middleware({
    loginUrl: appUrl(`/ingresar?next=${encodeURIComponent(here)}`),
  })(request);
  if (auth.headers.has("location")) return auth;

  const id = await businessIdForSlug(slug);
  const url = request.nextUrl.clone();
  url.pathname = id
    ? `/panel/negocios/${id}${pathname.slice("/panel".length)}`
    : `/t/${slug}${pathname}`;
  const response = NextResponse.rewrite(url);
  for (const cookie of auth.headers.getSetCookie())
    response.headers.append("Set-Cookie", cookie);
  return response;
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico$|.*\\.[a-z0-9]+$).*)"],
};
