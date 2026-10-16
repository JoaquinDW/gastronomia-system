"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/menu";
import type { HistoricalOrder, Recipe, StockItem } from "@/lib/management";
import { historicalRecipeCost } from "@/lib/management-recipe-cost";
import { money } from "@/lib/management-math";
import { Field } from "./management-fields";
import { panelBase } from "@/lib/hosts";

export function HistoricalOrderCosts({
  order,
  products,
  recipes,
  items,
  businessId,
}: {
  order: HistoricalOrder;
  products: Product[];
  recipes: Recipe[];
  items: StockItem[];
  businessId: string;
}) {
  const router = useRouter();
  const [selections, setSelections] = useState(() =>
    order.items.map(() => ({ option: "", addOnIds: [] as string[] })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ body: string; key: string } | null>(null);
  const quotes = selections.map((s, i) => {
    const [productId, variantId] = s.option.split(":");
    return s.option
      ? historicalRecipeCost(
          { productId, variantId, addOnIds: s.addOnIds },
          order.items[i].quantity,
          recipes,
          items,
        )
      : null;
  });
  const complete = quotes.every(Boolean);
  const total = complete
    ? quotes.reduce((sum, q) => sum + BigInt(q!.costCents), 0n).toString()
    : null;
  const root = `${panelBase(businessId)}/gestion`;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!complete || busy) return;
    const command = {
      type: "historical_cost",
      orderId: order.id,
      lines: selections.map((s, lineIndex) => {
        const [productId, variantId] = s.option.split(":");
        return {
          lineIndex,
          productId,
          variantId,
          addOnIds: s.addOnIds,
          expectedCostCents: quotes[lineIndex]!.costCents,
        };
      }),
    };
    const body = JSON.stringify(command);
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/businesses/${businessId}/management`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...command, requestKey: pending.current.key }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos guardar. Volvé a intentar.",
      );
      setBusy(false);
    }
  }
  return (
    <details className="mg-historical-order">
      <summary>Completar costo del pedido #{order.number}</summary>
      <form className="mg-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <p>
            Elegí qué producto de tu carta corresponde a cada uno de los que
            vendiste. Las cantidades ya vienen del pedido.
          </p>
          {order.items.map((line, index) => {
            const s = selections[index];
            const product = products.find(
              (p) => p.id === s.option.split(":")[0],
            );
            return (
              <div className="mg-historical-line" key={index}>
                <h3>
                  {line.quantity} × {line.name} · {line.variant}
                </h3>
                {line.addOns.length ? (
                  <p>Adicionales vendidos: {line.addOns.join(", ")}</p>
                ) : null}
                <Field label={`Receta para ${line.name} (línea ${index + 1})`}>
                  <select
                    value={s.option}
                    required
                    onChange={(e) =>
                      setSelections((old) =>
                        old.map((v, i) =>
                          i === index
                            ? { option: e.target.value, addOnIds: [] }
                            : v,
                        ),
                      )
                    }
                  >
                    <option value="">Elegí el producto y su opción</option>
                    {products.flatMap((p) =>
                      p.variants.map((v) => (
                        <option
                          key={`${p.id}:${v.id}`}
                          value={`${p.id}:${v.id}`}
                        >
                          {p.name} · {v.name}
                        </option>
                      )),
                    )}
                  </select>
                </Field>
                {product?.addOns.length ? (
                  <div className="mg-recoveries">
                    {product.addOns.map((addon) => (
                      <label className="mg-checkbox" key={addon.id}>
                        <input
                          type="checkbox"
                          checked={s.addOnIds.includes(addon.id)}
                          onChange={(e) =>
                            setSelections((old) =>
                              old.map((v, i) =>
                                i === index
                                  ? {
                                      ...v,
                                      addOnIds: e.target.checked
                                        ? [...v.addOnIds, addon.id]
                                        : v.addOnIds.filter(
                                            (id) => id !== addon.id,
                                          ),
                                    }
                                  : v,
                              ),
                            )
                          }
                        />
                        {addon.name} · línea {index + 1}
                      </label>
                    ))}
                  </div>
                ) : null}
                <p>
                  Costo de estas {line.quantity} unidades:{" "}
                  <strong>{money(quotes[index]?.costCents ?? null)}</strong>
                </p>
                {s.option && !quotes[index] ? (
                  <p className="mg-notice">
                    A esta opción le faltan ingredientes o costos.{" "}
                    <Link href={`${root}/recetas?action=recipe`}>
                      Revisar ingredientes
                    </Link>
                    {" · "}
                    <Link href={`${root}/inventario?action=costs`}>
                      Cargar costos
                    </Link>
                  </p>
                ) : null}
              </div>
            );
          })}
          <p>
            <strong>Costo estimado del pedido: {money(total)}</strong>
          </p>
          <p className="mg-disclosure">
            Usaremos las recetas y costos actuales para este pedido anterior. El
            costo quedará guardado aunque después cambien las recetas. Tu stock
            no cambia.
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="secondary-button"
            type="submit"
            disabled={!complete || busy}
          >
            {busy ? "Guardando…" : "Confirmar costo estimado"}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
