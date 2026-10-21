import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { BusinessNav } from "@/components/business-nav";
import { DemoBanner, DemoProvider } from "@/components/demo-panel";
import { PanelBaseProvider } from "@/components/panel-base";
import { DEMO_ID } from "@/lib/demo/sandbox";
import { appUrl, storeUrl } from "@/lib/hosts";
import { demoData } from "@/server/demo";

// Demo pública del panel, sin cuenta: Brasa Club con datos de ejemplo.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Probá el panel — Pedipue",
  description:
    "Recorré el panel de Pedipue con un local de ejemplo: pedidos en vivo, cocina, caja, carta y resultados. Sin registrarte.",
};

export default async function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state } = await demoData();
  return (
    <div className="site-shell panel-shell">
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>
      <header className="site-header">
        <Brand href="/" />
        <div className="panel-account">
          <a className="quiet-link" href={appUrl("/ingresar")}>
            Ingresar
          </a>
        </div>
      </header>
      <main id="contenido" className="panel-main">
        <DemoProvider initial={state}>
          <PanelBaseProvider base="/demo">
            <DemoBanner />
            <div className="biz-shell">
              <BusinessNav
                id={DEMO_ID}
                base="/demo"
                name={state.business.name}
                role="owner"
                isPublished={state.settings.isPublished}
                storeHref={storeUrl(state.business.slug)}
                businessesHref="/"
                businessesLabel="Volver a pedipue.com"
              />
              <div className="biz-content">{children}</div>
            </div>
          </PanelBaseProvider>
        </DemoProvider>
      </main>
      <footer>
        <span>pedipue · demo del panel</span>
        <span>Brasa Club es un local de ejemplo.</span>
      </footer>
    </div>
  );
}
