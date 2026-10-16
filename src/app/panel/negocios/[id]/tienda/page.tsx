import Link from "next/link";
import { notFound } from "next/navigation";
import { authorizeBusiness } from "@/server/http";
import { getProducts, getSettings } from "@/server/menu";
import { recentImports } from "@/server/menu-imports";
import { BusinessNav } from "@/components/business-nav";
import { StoreConfigurator } from "@/components/store-configurator";
import { hourSchema, hoursOverlap } from "@/lib/menu";
import { panelBase } from "@/lib/hosts";
export const metadata = { title: "Activar tu tienda — Pedipue" };
export default async function StorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await authorizeBusiness(id, true).catch(() => null);
  if (!access) notFound();
  const base = panelBase(id, access.business.slug);
  const [settings, products, imports] = await Promise.all([
    getSettings(id),
    getProducts(id),
    recentImports(id),
  ]);
  const parsed = hourSchema.array().safeParse(imports[0]?.draft?.hours);
  const suggestedHours =
    parsed.success &&
    !hoursOverlap(parsed.data) &&
    parsed.data.every((h) => h.opens !== h.closes)
      ? parsed.data
      : [];
  return (
    <>
      <Link className="back-link" href={base}>
        ← {access.business.name}
      </Link>
      <BusinessNav base={base} active="store" />
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">DE TU NEGOCIO A SUS CELULARES</p>
          <h1 className="panel-title">Tu tienda.</h1>
          <p>Configurá cómo atendés, revisá tu carta y activá tu enlace.</p>
        </div>
        <span className="workspace-number" aria-hidden="true">
          02
        </span>
      </div>
      <StoreConfigurator
        businessId={id}
        slug={access.business.slug}
        initialSettings={settings}
        productCount={products.filter((p) => p.isAvailable).length}
        suggestedHours={suggestedHours}
      />
    </>
  );
}
