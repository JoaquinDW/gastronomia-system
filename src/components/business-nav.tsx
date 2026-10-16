import Link from "next/link";
export function BusinessNav({
  base,
  active,
}: {
  base: string;
  active: "home" | "menu" | "store" | "orders" | "management";
}) {
  return (
    <nav className="business-nav" aria-label="Gestión del negocio">
      {[
        ["home", "Resumen", ""],
        ["menu", "Carta", "/carta"],
        ["store", "Tienda", "/tienda"],
        ["orders", "Pedidos", "/pedidos"],
        ["management", "Gestión", "/gestion"],
      ].map(([key, label, path]) => (
        <Link
          key={key}
          href={`${base}${path}`}
          aria-current={active === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
