import { BillingControls } from "@/components/billing-controls";
import { billingState } from "@/lib/billing";
import { businessKinds } from "@/lib/business-input";
import { storeUrl } from "@/lib/hosts";
import { formatMoney } from "@/lib/menu";
import type { AdminBusiness, AdminOverview } from "@/server/admin-overview";

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Argentina/Cordoba",
});

const signInFormat = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Cordoba",
});

function ago(value: Date | string | null, now: number): string {
  if (!value) return "Sin pedidos";
  const minutes = Math.max(0, (now - new Date(value).getTime()) / 60_000);
  if (minutes < 60) return `Hace ${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 24) return `Hace ${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Ayer" : `Hace ${days} días`;
}

const count = (value: number) => value.toLocaleString("es-AR");

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="admin-stat">
      <span className="admin-stat-label">{label}</span>
      <strong>{value}</strong>
      <span className="admin-stat-detail">{detail}</span>
    </div>
  );
}

function BusinessRow({
  business,
  now,
}: {
  business: AdminBusiness;
  now: number;
}) {
  const kind = businessKinds.find((item) => item.value === business.kind);
  const phone = business.whatsapp?.replace(/\D/g, "");
  const contactHref = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hola, soy Balthasar de Pedipue. ¿Cómo les está yendo con ${business.name}? ¿Necesitan ayuda con algo?`)}`
    : null;
  return (
    <tr>
      <td>
        <div className="admin-business">
          <span className="business-initial" aria-hidden="true">
            {business.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{business.name}</strong>
            <span>
              {kind?.label ?? business.kind}
              {business.city ? ` · ${business.city}` : ""}
            </span>
            <a
              className="admin-store-link"
              href={storeUrl(business.slug)}
              target="_blank"
              rel="noreferrer"
            >
              Ver menú público <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </td>
      <td data-label="Contacto">
        <span className="admin-owner">
          {business.ownerName || "Sin nombre"}
          <small>{business.ownerEmail ?? business.ownerId ?? "—"}</small>
          {contactHref ? (
            <a
              className="admin-whatsapp"
              href={contactHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Contactar a ${business.name} por WhatsApp: ${business.whatsapp}`}
            >
              <span className="admin-mono">{business.whatsapp}</span>
              <small>Abrir WhatsApp ↗</small>
            </a>
          ) : (
            <small>Sin WhatsApp registrado</small>
          )}
        </span>
      </td>
      <td data-label="Estado">
        <div className="admin-cell">
          <span
            className={`admin-badge ${business.published ? "is-live" : ""}`}
          >
            {business.published ? "Publicada" : "Sin publicar"}
          </span>
          <small className="admin-sub">
            {business.products} productos
            {business.pending ? ` · ${business.pending} por confirmar` : ""}
          </small>
        </div>
      </td>
      <td data-label="Plan">
        <BillingControls
          businessId={business.id}
          name={business.name}
          fields={business}
          now={now}
        />
      </td>
      <td data-label="Alta" className="admin-mono admin-nowrap">
        {dateFormat.format(new Date(business.createdAt))}
      </td>
      <td data-label="Último ingreso">
        {business.ownerLastSignInAt ? (
          <div className="admin-cell admin-nowrap">
            {ago(business.ownerLastSignInAt, now)}
            <time
              className="admin-sub"
              dateTime={new Date(business.ownerLastSignInAt).toISOString()}
            >
              {signInFormat.format(new Date(business.ownerLastSignInAt))}
            </time>
          </div>
        ) : (
          <span className="admin-sub">Sin registro disponible</span>
        )}
      </td>
      <td data-label="Último pedido" className="admin-nowrap">
        {ago(business.lastOrderAt, now)}
      </td>
      <td data-label="Pedidos 7 / 30 d" className="admin-mono admin-num">
        {count(business.orders7)} / {count(business.orders30)}
      </td>
      <td data-label="Ventas 30 d" className="admin-mono admin-num">
        <div className="admin-cell">
          {formatMoney(business.sales30)}
          <small className="admin-sub">
            7 d: {formatMoney(business.sales7)}
          </small>
        </div>
      </td>
    </tr>
  );
}

export function SuperadminOverview({
  overview,
  query,
  now,
}: {
  overview: AdminOverview;
  query: string;
  now: number;
}) {
  const { totals } = overview;
  const plans = overview.businesses.map(
    (business) => billingState(business, now).kind,
  );
  const planCount = (kind: string) =>
    plans.filter((plan) => plan === kind).length;
  const needle = query.trim().toLowerCase();
  const businesses = needle
    ? overview.businesses.filter((business) =>
        [
          business.name,
          business.slug,
          business.city,
          business.ownerName,
          business.ownerEmail,
          business.whatsapp,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle)),
      )
    : overview.businesses;
  return (
    <>
      <div className="panel-page-header">
        <div>
          <p className="eyebrow">SUPERADMIN</p>
          <h1 className="panel-title">Todo Pedipue.</h1>
          <p>
            Todos los negocios, sus pedidos y ventas. Se actualiza solo cada
            minuto.
          </p>
        </div>
      </div>
      <section className="admin-stats" aria-label="Resumen">
        <Stat
          label="Negocios"
          value={count(totals.businesses)}
          detail={`${count(totals.newBusinesses30)} nuevos en 30 días`}
        />
        <Stat
          label="Tiendas publicadas"
          value={count(totals.published)}
          detail={`de ${count(totals.businesses)} negocios`}
        />
        <Stat
          label="Pagando"
          value={count(planCount("paid"))}
          detail={`${count(planCount("trial"))} en prueba · ${count(planCount("expired"))} vencidos`}
        />
        <Stat
          label="Pedidos 7 días"
          value={count(totals.orders7)}
          detail={`${count(totals.ordersToday)} en las últimas 24 h`}
        />
        <Stat
          label="Pedidos 30 días"
          value={count(totals.orders30)}
          detail="Sin contar rechazados"
        />
        <Stat
          label="Ventas 7 días"
          value={formatMoney(totals.sales7)}
          detail="Pedidos aceptados"
        />
        <Stat
          label="Ventas 30 días"
          value={formatMoney(totals.sales30)}
          detail="Pedidos aceptados"
        />
      </section>
      <div className="admin-list-header">
        <h2>
          Negocios <span className="admin-mono">{businesses.length}</span>
        </h2>
        <form className="admin-search" role="search">
          <input
            aria-label="Buscar negocio"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Negocio, email o WhatsApp"
          />
          <button className="ghost-button" type="submit">
            Buscar
          </button>
        </form>
      </div>
      <p className="admin-session-note">
        Último ingreso: inicio de la sesión más reciente del dueño que sigue
        registrada. Las sesiones cerradas o eliminadas pueden no aparecer. No
        indica su última actividad en el panel. Horarios de Argentina.
      </p>
      {businesses.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Negocio</th>
                <th scope="col">Dueño y contacto</th>
                <th scope="col">Estado</th>
                <th scope="col">Plan</th>
                <th scope="col">Alta</th>
                <th scope="col">Último ingreso</th>
                <th scope="col">Último pedido</th>
                <th scope="col" className="admin-num">
                  Pedidos 7 / 30 d
                </th>
                <th scope="col" className="admin-num">
                  Ventas 30 d
                </th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((business) => (
                <BusinessRow key={business.id} business={business} now={now} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="admin-empty">
          {needle
            ? "Ningún negocio coincide con esa búsqueda."
            : "Todavía no hay negocios registrados."}
        </p>
      )}
    </>
  );
}
