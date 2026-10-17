import { notFound } from "next/navigation";
import Link from "next/link";
import { authorizeBusiness } from "@/server/http";
import { getProducts, getSettings } from "@/server/menu";
import { BusinessNav } from "@/components/business-nav";
import { MenuManager } from "@/components/menu-manager";
import { StoreLinkBar } from "@/components/store-link-bar";
import { panelBase } from "@/lib/hosts";
export const metadata = { title: "Tu carta — Pedipue" };
export default async function MenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await authorizeBusiness(id, true).catch(() => null);
  if (!access) notFound();
  const base = panelBase(id, access.business.slug);
  const [products, settings] = await Promise.all([
    getProducts(id),
    getSettings(id),
  ]);
  return (
    <>
      <Link href={base} className="back-link">
        ← {access.business.name}
      </Link>
      <BusinessNav base={base} active="menu" />
      <StoreLinkBar
        slug={access.business.slug}
        base={base}
        isPublished={settings.isPublished}
      />
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
