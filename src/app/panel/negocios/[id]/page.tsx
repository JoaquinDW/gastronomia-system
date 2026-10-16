import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { businessKinds } from "@/lib/business-input";
import { findBusiness } from "@/server/businesses";
import { requireUser } from "@/server/auth";
import { getProducts, getSettings } from "@/server/menu";
import { BusinessNav } from "@/components/business-nav";

export const metadata = { title: "Mi negocio — Gastronomía" };

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
  const [products, settings] = await Promise.all([
    getProducts(id),
    getSettings(id),
  ]);
  return (
    <>
      <Link href="/panel" className="back-link">
        ← Mis negocios
      </Link>
      <BusinessNav id={id} active="home" />
      <div className="business-welcome">
        <span className="welcome-check" aria-hidden="true">
          ✓
        </span>
        <div>
          <p className="eyebrow">ALTA COMPLETADA</p>
          <h1 className="panel-title">{business.name}</h1>
          <p>
            Tu negocio ya tiene su lugar.{" "}
            {business.role === "owner"
              ? "Sos su propietario y podés acceder con tu cuenta."
              : "Tenés acceso como parte de su equipo."}
          </p>
        </div>
      </div>
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
        <section className="setup-checklist" aria-labelledby="checklist-title">
          <p className="eyebrow">EL CAMINO A TU PRIMER PEDIDO</p>
          <h2 id="checklist-title">Un buen comienzo.</h2>
          <ol>
            <li className="done">
              <span aria-hidden="true">✓</span>
              <div>
                Cuenta creada<small>Tu acceso personal y protegido.</small>
              </div>
            </li>
            <li className="done">
              <span aria-hidden="true">✓</span>
              <div>
                Negocio registrado
                <small>Datos guardados y propietario asignado.</small>
              </div>
            </li>
            <li className={products.length ? "done" : ""}>
              <span aria-hidden="true">{products.length ? "✓" : "03"}</span>
              <div>
                <Link href={`/panel/negocios/${id}/carta`}>
                  {products.length ? "Administrar tu carta" : "Cargar tu carta"}{" "}
                  →
                </Link>
                <small>
                  {products.length
                    ? `${products.length} productos cargados. Podés editarlos o importar más.`
                    : "Carga manual, desde una foto, PDF o texto con IA."}
                </small>
              </div>
            </li>
            <li className={settings.isPublished ? "done" : ""}>
              <span aria-hidden="true">
                {settings.isPublished ? "✓" : "04"}
              </span>
              <div>
                <Link href={`/panel/negocios/${id}/tienda`}>
                  {settings.isPublished
                    ? "Administrar tu tienda"
                    : "Activar tu tienda"}{" "}
                  →
                </Link>
                <small>
                  {settings.isPublished
                    ? "Tu enlace está activo para recibir pedidos."
                    : "Configurá horarios, retiro y delivery para publicar tu enlace."}
                </small>
              </div>
            </li>
          </ol>
          <p className="form-footnote">
            {settings.isPublished ? (
              <Link href={`/t/${business.slug}`} target="_blank">
                Ver mi tienda pública ↗
              </Link>
            ) : (
              "La tienda se activa cuando revisás y confirmás su configuración."
            )}
          </p>
        </section>
      </div>
    </>
  );
}
