// Dominios de Pedipue. Con NEXT_PUBLIC_ROOT_DOMAIN (por ejemplo, pedipue.com)
// la landing vive en el dominio raíz, cada tienda en <slug>.<raíz> y el panel
// en app.<raíz>: login, la lista de negocios en /panel y la gestión de cada
// local en /<slug>. Sin esa variable todo sigue en un solo host con /t/<slug>
// y /panel/negocios/<id>.

export const reservedSlugs = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "alta",
  "auth",
  "ayuda",
  "blog",
  "cdn",
  "dev",
  "docs",
  "help",
  "ingresar",
  "mail",
  "negocios",
  "panel",
  "registro",
  "soporte",
  "staging",
  "static",
  "status",
  "www",
]);

export function rootDomain(): string {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").trim().toLowerCase();
}

export function hostOrigin(host: string): string {
  const name = host.split(":")[0];
  const local = ["localhost", "lvh.me"].some(
    (dev) => name === dev || name.endsWith(`.${dev}`),
  );
  return `${local ? "http" : "https"}://${host}`;
}

export function storeUrl(slug: string): string {
  const root = rootDomain();
  return root ? hostOrigin(`${slug}.${root}`) : `/t/${slug}`;
}

export function storePreviewUrl(slug: string): string {
  return `${storeUrl(slug)}${rootDomain() ? "/" : ""}?preview=1`;
}

export function appUrl(path: string): string {
  const root = rootDomain();
  return root ? `${hostOrigin(`app.${root}`)}${path}` : path;
}

// Base de los links internos de la gestión de un local (en app.).
export function panelBase(id: string, slug: string): string {
  return rootDomain() ? `/${slug}` : `/panel/negocios/${id}`;
}

export function businessPanelUrl(id: string, slug: string): string {
  return rootDomain() ? appUrl(`/${slug}`) : `/panel/negocios/${id}`;
}

// Dominio de la cookie de sesión: compartida entre app. y las tiendas, para
// la vista previa privada de la tienda.
export function sessionCookieDomain(): string | undefined {
  const name = rootDomain().split(":")[0];
  return name && name !== "localhost" ? `.${name}` : undefined;
}

// Destino después de ingresar: solo panel o locales propios de Pedipue.
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const route = routeHost(url.host);
    if (url.origin !== hostOrigin(url.host)) return null;
    return route.kind === "app" || route.kind === "store" ? url.href : null;
  } catch {
    return null;
  }
}

export type HostRoute =
  | { kind: "site" }
  | { kind: "app" }
  | { kind: "store"; slug: string }
  | { kind: "unused" }
  | { kind: "other" };

export function routeHost(host: string | null, root = rootDomain()): HostRoute {
  const value = (host ?? "").trim().toLowerCase();
  if (!root || !value) return { kind: "other" };
  if (value === root || value === `www.${root}`) return { kind: "site" };
  if (value === `app.${root}`) return { kind: "app" };
  if (!value.endsWith(`.${root}`)) return { kind: "other" };
  const label = value.slice(0, -root.length - 1);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label) || reservedSlugs.has(label))
    return { kind: "unused" };
  return { kind: "store", slug: label };
}
