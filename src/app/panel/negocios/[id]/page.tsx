import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { businessKinds } from "@/lib/business-input";
import { panelBase, storeUrl } from "@/lib/hosts";
import { guideCookie, setupSteps } from "@/lib/setup-guide";
import { findBusiness } from "@/server/businesses";
import { requireUser } from "@/server/auth";
import { getProducts, getSettings } from "@/server/menu";
import { hasOrders } from "@/server/orders";
import { SetupGuide } from "@/components/setup-guide";
import { StoreLinkBar } from "@/components/store-link-bar";

export const metadata = { title: "Mi negocio — Pedipue" };

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const business = await findBusiness(user.id, id);
  if (!business) notFound();
  const base = panelBase(id, business.slug);
  const editor = ["owner", "manager"].includes(business.role);
  const [products, settings, ordered, jar] = await Promise.all([
    getProducts(id),
    getSettings(id),
    hasOrders(id),
    cookies(),
  ]);
  const steps = setupSteps({
    base,
    products,
    settings,
    hasOrders: ordered,
    aiAvailable: Boolean(process.env.OPENAI_API_KEY),
  });
  const setupDone = steps.every((s) => s.done);
  return (
    <>
      <div className="business-welcome">
        <span className="welcome-check" aria-hidden="true">
          ✓
        </span>
        <div>
          <p className="eyebrow">
            {setupDone ? "TU LOCAL ESTÁ ANDANDO" : "ALTA COMPLETADA"}
          </p>
          <h1 className="panel-title">{business.name}</h1>
          <p>
            Tu negocio ya tiene su lugar.{" "}
            {business.role === "owner"
              ? "Sos su propietario y podés acceder con tu cuenta."
              : "Tenés acceso como parte de su equipo."}
          </p>
        </div>
      </div>
      {editor && !setupDone ? (
        <SetupGuide
          businessId={id}
          steps={steps}
          shareUrl={settings.isPublished ? storeUrl(business.slug) : null}
          initiallyHidden={Boolean(jar.get(guideCookie(id))?.value)}
        />
      ) : null}
      <StoreLinkBar
        slug={business.slug}
        base={base}
        isPublished={settings.isPublished}
      />
      {editor ? (
        <section className="business-data" style={{ marginBottom: 24 }}>
          <h2>Los números de tu negocio</h2>
          <p>
            Ventas, costos, stock y gastos, conectados para saber cómo te está
            yendo.
          </p>
          <Link className="secondary-button" href={`${base}/gestion`}>
            Abrir Gestión
          </Link>
        </section>
      ) : null}
      <div className="business-detail-grid">
        <section
          className="business-data"
          aria-labelledby="business-data-title"
        >
          <h2 id="business-data-title">Los datos de tu negocio</h2>
          <dl>
            <div>
              <dt>Rubro</dt>
              <dd>
                {
                  businessKinds.find((kind) => kind.value === business.kind)
                    ?.label
                }
              </dd>
            </div>
            <div>
              <dt>WhatsApp</dt>
              <dd>{business.whatsapp}</dd>
            </div>
            <div>
              <dt>Ciudad</dt>
              <dd>{business.city}</dd>
            </div>
            <div>
              <dt>Sucursal inicial</dt>
              <dd>
                Casa central{business.address ? ` · ${business.address}` : ""}
              </dd>
            </div>
            <div>
              <dt>Identificador reservado</dt>
              <dd className="slug-value">{business.slug}</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
