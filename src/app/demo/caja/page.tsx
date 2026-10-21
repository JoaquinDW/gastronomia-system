import { DemoCash } from "@/components/demo-panel";
export const metadata = { title: "Caja · Demo — Pedipue" };
export default function DemoCashPage() {
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">CONTROL DE CAJA</p>
          <h1 className="panel-title">Caja.</h1>
          <p>
            Abrí el turno con el cambio, cobrá los pedidos y cerrá contando el
            efectivo. Cuánto debería haber te lo mostramos recién después de que
            contás.
          </p>
        </div>
      </div>
      <DemoCash />
    </>
  );
}
