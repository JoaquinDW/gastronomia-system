import { notFound } from "next/navigation";
import { authorizeBusiness } from "@/server/http";
import { getProducts } from "@/server/menu";
import { MenuManager } from "@/components/menu-manager";
export const metadata = { title: "Tu carta — Pedipue" };
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
