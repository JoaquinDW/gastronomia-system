// Dominios de Pedipue. Con NEXT_PUBLIC_ROOT_DOMAIN (por ejemplo, pedipue.com)
// la landing vive en el dominio raíz, el panel en app.<raíz> y cada tienda en
// <slug>.<raíz>. Sin esa variable todo sigue en un solo host con /t/<slug>.

export const reservedSlugs = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "ayuda",
  "blog",
  "cdn",
  "dev",
  "docs",
  "help",
  "mail",
  "panel",
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
  const local = name === "localhost" || name.endsWith(".localhost");
  return `${local ? "http" : "https"}://${host}`;
}

export function storeUrl(slug: string): string {
  const root = rootDomain();
  return root ? hostOrigin(`${slug}.${root}`) : `/t/${slug}`;
}

export function appUrl(path: string): string {
  const root = rootDomain();
  return root ? `${hostOrigin(`app.${root}`)}${path}` : path;
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
