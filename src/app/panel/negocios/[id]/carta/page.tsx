import { notFound } from "next/navigation";
import Link from "next/link";
import { authorizeBusiness } from "@/server/http";
import { getProducts } from "@/server/menu";
import { BusinessNav } from "@/components/business-nav";
import { MenuManager } from "@/components/menu-manager";
export const metadata = { title: "Tu carta — Gastronomía" };
export default async function MenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await authorizeBusiness(id, true).catch(() => null);
  if (!access) notFound();
  const products = await getProducts(id);
  return (
    <>
      <Link href={`/panel/negocios/${id}`} className="back-link">
        ← {access.business.name}
      </Link>
      <BusinessNav id={id} active="menu" />
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">LO QUE SALE DE TU COCINA</p>
          <h1 className="panel-title">Tu carta.</h1>
          <p>
            Productos, presentaciones y precios. Cargalos a mano o empezá desde
            una foto.
          </p>
        </div>
        <span className="workspace-number" aria-hidden="true">
          01
        </span>
      </div>
      <MenuManager
        businessId={id}
        initialProducts={products}
        aiAvailable={Boolean(process.env.OPENAI_API_KEY)}
      />
    </>
  );
}
