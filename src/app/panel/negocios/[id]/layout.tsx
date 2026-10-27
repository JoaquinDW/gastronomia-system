import { z } from "zod";
import {
  appUrl,
  panelBase,
  rootDomain,
  storePreviewUrl,
  storeUrl,
} from "@/lib/hosts";
import { BusinessNav } from "@/components/business-nav";
import { PanelBaseProvider } from "@/components/panel-base";
import { PlanNotice } from "@/components/plan-notice";
import { supportWhatsapp } from "@/lib/support";
import { requireUser } from "@/server/auth";
import { businessSlugForId } from "@/server/business-hosts";
import { findBusiness } from "@/server/businesses";
import { getSettings } from "@/server/menu";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slug = rootDomain() ? ((await businessSlugForId(id)) ?? "") : "";
  const base = panelBase(id, slug);
  const user = await requireUser();
  const business = z.uuid().safeParse(id).success
    ? await findBusiness(user.id, id)
    : null;
  // Sin acceso al negocio, la página responde su propio 404 sin navegación.
  if (!business)
    return <PanelBaseProvider base={base}>{children}</PanelBaseProvider>;
  const settings = await getSettings(id);
  return (
    <PanelBaseProvider base={base}>
      <div className="biz-shell">
        <BusinessNav
          id={id}
          base={base}
          name={business.name}
          role={business.role}
          isPublished={settings.isPublished}
          storeHref={
            settings.isPublished
              ? storeUrl(business.slug)
              : storePreviewUrl(business.slug)
          }
          businessesHref={appUrl("/panel")}
          supportHref={supportWhatsapp(business)}
        />
        <div className="biz-content">
          {["owner", "manager"].includes(business.role) ? (
            <PlanNotice
              businessName={business.name}
              fields={business}
              now={Date.now()}
            />
          ) : null}
          {children}
        </div>
      </div>
    </PanelBaseProvider>
  );
}
