import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listBusinesses } from "@/server/businesses";
import { businessKinds } from "@/lib/business-input";
import { businessPanelUrl } from "@/lib/hosts";

export const metadata = { title: "Mis negocios — Pedipue" };

export default async function PanelPage() {
  const user = await requireUser();
  const businesses = await listBusinesses(user.id);
  return (
    <>
      <div className="panel-page-header">
        <div>
          <p className="eyebrow">TU ESPACIO</p>
          <h1 className="panel-title">Mis negocios.</h1>
          <p>Elegí el emprendimiento que querés administrar.</p>
        </div>
        <Link className="primary-button compact-button" href="/alta">
          Dar de alta un negocio <span aria-hidden="true">+</span>
        </Link>
      </div>
      {businesses.length ? (
        <div className="business-list">
          {businesses.map((business) => (
            <Link
              key={business.id}
              href={businessPanelUrl(business.id, business.slug)}
              className="business-list-item"
            >
              <span className="business-initial" aria-hidden="true">
                {business.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h2>{business.name}</h2>
                <p>
                  {
                    businessKinds.find((kind) => kind.value === business.kind)
                      ?.label
                  }{" "}
                  · {business.city}
                </p>
              </div>
              <span className="business-role">
                {business.role === "owner" ? "Propietario" : "Equipo"}
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      ) : (
        <section className="empty-businesses">
          <span className="empty-symbol" aria-hidden="true">
            ↗
          </span>
          <h2>Tu primer negocio empieza acá.</h2>
          <p>
            Tu cuenta ya está lista. Agregá los datos de tu emprendimiento para
            crear su espacio.
          </p>
          <Link className="text-link" href="/alta">
            Registrar mi negocio <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}
    </>
  );
}
