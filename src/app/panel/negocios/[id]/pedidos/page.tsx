import Link from "next/link";
import { notFound } from "next/navigation";
import { authorizeBusiness } from "@/server/http";
import { listOrders } from "@/server/orders";
import { BusinessNav } from "@/components/business-nav";
import { OrderInbox } from "@/components/order-inbox";
import { panelBase } from "@/lib/hosts";
export const metadata = { title: "Pedidos de tu tienda — Pedipue" };
export default async function OrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await authorizeBusiness(id, true).catch(() => null);
  if (!access) notFound();
  const orders = await listOrders(id);
  return (
    <>
      <Link className="back-link" href={`${panelBase(id)}`}>
        ← {access.business.name}
      </Link>
      <BusinessNav id={id} active="orders" />
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">DE LA TIENDA A TU MOSTRADOR</p>
          <h1 className="panel-title">Pedidos.</h1>
          <p>
            Revisá los pendientes y confirmá con el cliente. Aceptar registra la
            venta y descuenta los insumos que tengan receta configurada.
          </p>
        </div>
      </div>
      <OrderInbox
        businessId={id}
        initialOrders={JSON.parse(JSON.stringify(orders))}
      />
    </>
  );
}
