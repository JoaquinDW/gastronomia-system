import { DemoMenu } from "@/components/demo-panel";
export const metadata = { title: "Carta · Demo — Pedipue" };
export default function DemoMenuPage() {
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">LO QUE SALE DE TU COCINA</p>
          <h1 className="panel-title">Tu carta.</h1>
          <p>
            Productos, presentaciones y precios. Cambiá lo que quieras: en la
            demo no se guarda.
          </p>
        </div>
        <span className="workspace-number" aria-hidden="true">
          01
        </span>
      </div>
      <DemoMenu />
    </>
  );
}
