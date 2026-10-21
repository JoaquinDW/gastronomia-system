import { DemoOrders } from "@/components/demo-panel";
export const metadata = { title: "Pedidos · Demo — Pedipue" };
export default function DemoOrdersPage() {
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">DE LA TIENDA A TU MOSTRADOR</p>
          <h1 className="panel-title">Pedidos.</h1>
          <p>
            Los pedidos nuevos entran solos: en esta demo cae uno cada tanto.
            Aceptalo, marcá cada paso y cobralo con la caja abierta. Probá
            también el modo cocina.
          </p>
        </div>
      </div>
      <DemoOrders />
    </>
  );
}
