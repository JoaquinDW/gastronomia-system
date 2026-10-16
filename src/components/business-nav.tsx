import Link from "next/link";
export function BusinessNav({
  id,
  active,
}: {
  id: string;
  active: "home" | "menu" | "store" | "orders";
}) {
  return (
    <nav className="business-nav" aria-label="Gestión del negocio">
      {[
        ["home", "Resumen", ""],
        ["menu", "Carta", "/carta"],
        ["store", "Tienda", "/tienda"],
        ["orders", "Pedidos", "/pedidos"],
      ].map(([key, label, path]) => (
        <Link
          key={key}
          href={`/panel/negocios/${id}${path}`}
          aria-current={active === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
