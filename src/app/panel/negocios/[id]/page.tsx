import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { businessKinds } from "@/lib/business-input";
import { findBusiness } from "@/server/businesses";
import { requireUser } from "@/server/auth";

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
  return (
    <>
      <Link href="/panel" className="back-link">
        ← Mis negocios
      </Link>
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
            <li>
              <span aria-hidden="true">03</span>
              <div>
                Cargar tu carta<small>Disponible en la próxima entrega.</small>
              </div>
            </li>
            <li>
              <span aria-hidden="true">04</span>
              <div>
                Activar tu tienda
                <small>Después de configurar carta, horarios y entregas.</small>
              </div>
            </li>
          </ol>
          <p className="form-footnote">
            Tu tienda todavía no está publicada. El alta no habilita pedidos
            automáticamente.
          </p>
        </section>
      </div>
    </>
  );
}
