import { notFound } from "next/navigation";
import { authorizeBusiness } from "@/server/http";
import { listOrders } from "@/server/orders";
import { getTicketConfig, productCategories } from "@/server/ticket";
import { storeUrl } from "@/lib/hosts";
import { OrderInbox } from "@/components/order-inbox";
export const metadata = { title: "Pedidos de tu tienda — Pedipue" };
export default async function OrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await authorizeBusiness(id, true).catch(() => null);
  if (!access) notFound();
  const [orders, ticket, categories] = await Promise.all([
    listOrders(id),
    getTicketConfig(id),
    productCategories(id),
  ]);
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">DE LA TIENDA A TU MOSTRADOR</p>
          <h1 className="panel-title">Pedidos.</h1>
          <p>
            Los pedidos nuevos entran solos. Aceptar registra la venta y
            descuenta los insumos con receta; después marcá cada paso para que
            el cliente lo vea en su link de seguimiento.
          </p>
        </div>
      </div>
      <OrderInbox
        businessId={id}
        businessName={access.business.name}
        storeBase={storeUrl(access.business.slug)}
        initialOrders={JSON.parse(JSON.stringify(orders))}
        initialTicket={ticket}
        initialCategories={categories}
      />
    </>
  );
}
