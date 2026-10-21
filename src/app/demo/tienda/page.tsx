import { DemoStore } from "@/components/demo-panel";
export const metadata = { title: "Tienda · Demo — Pedipue" };
export default function DemoStorePage() {
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">DE TU NEGOCIO A SUS CELULARES</p>
          <h1 className="panel-title">Tu tienda.</h1>
          <p>Configurá cómo atendés, revisá tu carta y activá tu enlace.</p>
        </div>
        <span className="workspace-number" aria-hidden="true">
          02
        </span>
      </div>
      <DemoStore />
    </>
  );
}
