import { getAuth } from "@/server/auth";
import { businessIdForSlug, businessSlugForId } from "@/server/business-hosts";
import {
  appUrl,
  hostOrigin,
  reservedSlugs,
  rootDomain,
  routeHost,
} from "@/lib/hosts";
import { NextResponse, type NextRequest } from "next/server";

const authPaths = ["/panel", "/alta"];
const appPaths = [...authPaths, "/ingresar", "/registro"];
const storePath = /^\/t\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/.*)?$/;
const businessPanelPath = /^\/panel\/negocios\/([0-9a-f-]{36})(\/.*)?$/i;
const slugPath = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)(\/.*)?$/;

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
    // La gestión estuvo un tiempo en <slug>.<raíz>/panel; ahora vive en app.
    if (under(pathname, ["/panel"]))
      return moveTo(
        `app.${root}`,
        `/${route.slug}${pathname.slice("/panel".length)}${search}`,
      );
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
    // La demo del panel no necesita sesión: vive en la raíz, junto a la landing.
    if (under(pathname, ["/demo"])) return moveTo(root);
    // La vista previa queda en app. porque necesita la sesión del panel.
    if (shop && searchParams.get("preview") !== "1")
      return toShop(shop[1], shop[2]);
    const panel = pathname.match(businessPanelPath);
    if (panel) {
      const slug = await businessSlugForId(panel[1].toLowerCase()).catch(
        () => null,
      );
      if (slug)
        return moveTo(`app.${root}`, `/${slug}${panel[2] ?? ""}${search}`, 307);
    }
    const local = pathname.match(slugPath);
    if (local && !reservedSlugs.has(local[1]) && !under(pathname, ["/t"]))
      return businessPanel(request, local[1], local[2] ?? "");
  }

  return under(pathname, authPaths)
    ? getAuth().middleware({ loginUrl: appUrl("/ingresar") })(request)
    : NextResponse.next();
}

// app.<raíz>/<slug>/... se sirve desde /panel/negocios/<id>/...
async function businessPanel(request: NextRequest, slug: string, rest: string) {
  const { pathname, search } = request.nextUrl;
  const here = appUrl(`${pathname}${search}`);
  const auth = await getAuth().middleware({
    loginUrl: appUrl(`/ingresar?next=${encodeURIComponent(here)}`),
  })(request);
  if (auth.headers.has("location")) return auth;

  const id = await businessIdForSlug(slug);
  if (!id) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/panel/negocios/${id}${rest}`;
  const response = NextResponse.rewrite(url);
  for (const cookie of auth.headers.getSetCookie())
    response.headers.append("Set-Cookie", cookie);
  return response;
}

export const config = {
  matcher: ["/((?!_next/|ingest/|favicon\\.ico$|.*\\.[a-z0-9]+$).*)"],
};
