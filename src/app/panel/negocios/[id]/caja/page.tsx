import { notFound } from "next/navigation";
import { authorizeBusiness } from "@/server/http";
import { businessTimezone, getCashState } from "@/server/cash";
import { CashRegister } from "@/components/cash-register";
export const metadata = { title: "Caja — Pedipue" };
export default async function CashPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await authorizeBusiness(id, true).catch(() => null);
  if (!access) notFound();
  const [state, timezone] = await Promise.all([
    getCashState(id, access.business.role === "owner"),
    businessTimezone(id),
  ]);
  return (
    <>
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">CONTROL DE CAJA</p>
          <h1 className="panel-title">Caja.</h1>
          <p>
            Abrí el turno con el cambio, cobrá los pedidos y cerrá contando el
            efectivo. Cuánto debería haber te lo mostramos recién después de
            que contás.
          </p>
        </div>
      </div>
      <CashRegister
        businessId={id}
        timezone={timezone}
        initialState={JSON.parse(JSON.stringify(state))}
      />
    </>
  );
}
