"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/menu";
import { pesosToCents } from "@/lib/cart";
import {
  cashTotals,
  countTotal,
  denominations,
  differenceLabel,
  movementLabels,
  paymentLabels,
  type CashMovement,
  type CashState,
  type ClosedSession,
  type UnpaidOrder,
} from "@/lib/cash";
import { ChargeDialog } from "./charge-dialog";
import { usePanelBase } from "./panel-base";

const POLL_MS = 15000;
const orderNumber = (n: number) => `#${n.toString().padStart(3, "0")}`;

export function CashRegister({
  businessId,
  timezone,
  initialState,
}: {
  businessId: string;
  timezone: string;
  initialState: CashState;
}) {
  const panel = usePanelBase();
  const [state, setState] = useState(initialState);
  const [closed, setClosed] = useState<ClosedSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [charging, setCharging] = useState<UnpaidOrder | null>(null);
  const [moving, setMoving] = useState<"deposit" | "withdrawal" | null>(null);
  const [closing, setClosing] = useState(false);
  const base = `/api/businesses/${businessId}/cash`;
  const time = new Intl.DateTimeFormat("es-AR", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const dayTime = new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const refresh = useCallback(async () => {
    const r = await fetch(base, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setState(d);
  }, [base]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  async function command(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await refresh().catch(() => {});
      return d;
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No pudimos guardar. Volvé a intentar.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const session = state.session;

  return (
    <>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="field-hint standalone-hint" role="status">
          {notice}
        </p>
      ) : null}

      {closed ? (
        <CloseResult result={closed} onDone={() => setClosed(null)} />
      ) : !session ? (
        <OpenForm busy={busy} onOpen={(openingCents, requestKey) => void command({ type: "open", requestKey, openingCents })} />
      ) : closing ? (
        <BlindCount
          busy={busy}
          sessionNumber={session.number}
          onBack={() => setClosing(false)}
          onClose={async (declaredCents, note, requestKey) => {
            const d = await command({ type: "close", requestKey, sessionId: session.id, declaredCents, note });
            if (d?.closed) {
              setClosing(false);
              setClosed(d.closed);
            }
          }}
        />
      ) : (
        <>
          <section className="cash-shift" aria-label="Turno abierto">
            <div>
              <p className="cash-shift-label">
                <span className="live-dot" aria-hidden="true" />
                Turno {session.number} · abierto {time.format(new Date(session.openedAt))}
              </p>
              <p className="cash-shift-meta">
                Cambio inicial <strong>{formatMoney(session.openingCents)}</strong> ·{" "}
                {cashTotals(session.openingCents, session.movements).payments} cobros
              </p>
            </div>
            <div className="cash-shift-actions">
              <button type="button" className="secondary-button compact-button" aria-expanded={moving === "deposit"} onClick={() => setMoving(moving === "deposit" ? null : "deposit")}>
                Ingreso
              </button>
              <button type="button" className="secondary-button compact-button" aria-expanded={moving === "withdrawal"} onClick={() => setMoving(moving === "withdrawal" ? null : "withdrawal")}>
                Retiro
              </button>
              <button type="button" className="primary-button compact-button" onClick={() => setClosing(true)}>
                Cerrar caja
              </button>
            </div>
          </section>
          {moving ? (
            <MovementForm
              key={moving}
              kind={moving}
              busy={busy}
              onCancel={() => setMoving(null)}
              onSave={async (amountCents, note, requestKey) => {
                const d = await command({ type: "movement", requestKey, kind: moving, amountCents, note });
                if (d) {
                  setMoving(null);
                  setNotice(`${movementLabels[moving]} de ${formatMoney(amountCents)} registrado.`);
                }
              }}
            />
          ) : null}
          <div className="cash-columns">
            <section className="cash-panel" aria-labelledby="unpaid-title">
              <h2 id="unpaid-title">
                Por cobrar <span>{state.unpaid.length}</span>
              </h2>
              {!state.unpaid.length ? (
                <p className="field-hint">
                  No hay pedidos aceptados sin cobrar. Los que aceptes en{" "}
                  <Link href={`${panel}/pedidos`}>Pedidos</Link> aparecen acá.
                </p>
              ) : (
                <ul className="cash-list">
                  {state.unpaid.map((o) => (
                    <li key={o.id}>
                      <div>
                        <strong>
                          {orderNumber(o.number)} · {o.customerName}
                        </strong>
                        <span>
                          {o.paidCents ? `Cobrado ${formatMoney(o.paidCents)} · ` : ""}
                          Dice que paga con {o.paymentMethod === "cash" ? "efectivo" : "transferencia"}
                        </span>
                      </div>
                      <span className="cash-amount">{formatMoney(o.totalCents - o.paidCents)}</span>
                      <button type="button" className="secondary-button compact-button" onClick={() => setCharging(o)}>
                        Cobrar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="cash-panel" aria-labelledby="movements-title">
              <h2 id="movements-title">
                Movimientos <span>{session.movements.length}</span>
              </h2>
              {!session.movements.length ? (
                <p className="field-hint">Todavía no hay cobros en este turno.</p>
              ) : (
                <ul className="cash-list">
                  {session.movements.map((m) => (
                    <MovementRow
                      key={m.id}
                      movement={m}
                      time={time.format(new Date(m.createdAt))}
                      busy={busy}
                      onVoid={async (reason) => {
                        const d = await command({ type: "void", movementId: m.id, reason });
                        if (d) setNotice(`${movementLabels[m.kind]} anulado. No cuenta para el cierre.`);
                        return Boolean(d);
                      }}
                    />
                  ))}
                </ul>
              )}
              <p className="field-hint cash-blind-hint">
                Lo que debería haber en efectivo te lo mostramos al cerrar, después de contar.
              </p>
            </section>
          </div>
        </>
      )}

      {state.history?.length ? (
        <section className="cash-panel cash-history" aria-labelledby="history-title">
          <h2 id="history-title">Turnos cerrados</h2>
          <div className="cash-table-wrap">
            <table className="cash-table">
              <thead>
                <tr>
                  <th scope="col">Turno</th>
                  <th scope="col">Cerró</th>
                  <th scope="col">Cobrado</th>
                  <th scope="col">Debía haber</th>
                  <th scope="col">Contaron</th>
                  <th scope="col">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {state.history.map((s) => {
                  const diff = s.declaredCents - s.expectedCents;
                  const total = Object.values(s.totals.byMethod).reduce((n, v) => n + v, 0);
                  return (
                    <tr key={s.id}>
                      <td>{s.number}</td>
                      <td>{dayTime.format(new Date(s.closedAt))}</td>
                      <td>{formatMoney(total)}</td>
                      <td>{formatMoney(s.expectedCents)}</td>
                      <td>{formatMoney(s.declaredCents)}</td>
                      <td data-diff={Math.sign(diff)}>{diff === 0 ? "Cuadra" : `${diff > 0 ? "+" : "−"} ${formatMoney(Math.abs(diff))}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {charging ? (
        <ChargeDialog
          businessId={businessId}
          order={charging}
          cashOpen={Boolean(session)}
          onClose={() => setCharging(null)}
          onCharged={(message) => {
            setCharging(null);
            setError("");
            setNotice(message);
            void refresh().catch(() => {});
          }}
        />
      ) : null}
    </>
  );
}

function OpenForm({ busy, onOpen }: { busy: boolean; onOpen: (cents: number, requestKey: string) => void }) {
  const [value, setValue] = useState("");
  const requestKey = useRef(crypto.randomUUID());
  const cents = pesosToCents(value);
  return (
    <section className="cash-open" aria-labelledby="open-title">
      <p className="small-badge cash-sticker">CAJA CERRADA</p>
      <h2 id="open-title">Abrí la caja para empezar a cobrar.</h2>
      <p className="section-description">
        Contá el cambio con el que arrancás. Cada cobro, ingreso y retiro queda en el turno hasta que lo cerrás.
      </p>
      <form
        className="app-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (cents !== null) onOpen(cents, requestKey.current);
        }}
      >
        <label>
          Cambio inicial ($)
          <input
            inputMode="decimal"
            value={value}
            placeholder="0"
            aria-invalid={cents === null || undefined}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <button className="primary-button" disabled={busy || cents === null}>
          {busy ? "Abriendo…" : "Abrir caja"}
        </button>
      </form>
    </section>
  );
}

function MovementForm({
  kind,
  busy,
  onCancel,
  onSave,
}: {
  kind: "deposit" | "withdrawal";
  busy: boolean;
  onCancel: () => void;
  onSave: (cents: number, note: string, requestKey: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const requestKey = useRef(crypto.randomUUID());
  const cents = pesosToCents(amount);
  const valid = cents !== null && cents > 0 && note.trim().length >= 3;
  return (
    <section className="print-settings" aria-labelledby="movement-title">
      <div className="print-settings-heading">
        <h2 id="movement-title">{kind === "deposit" ? "Ingreso de efectivo" : "Retiro de efectivo"}</h2>
        <button type="button" className="text-button" onClick={onCancel}>
          Cerrar
        </button>
      </div>
      <p className="section-description">
        {kind === "deposit"
          ? "Plata que entra a la caja sin ser un cobro, como más cambio."
          : "Plata que sale de la caja: un pago al cadete, una compra chica o lo que te llevás."}
      </p>
      <form
        className="app-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave(cents!, note, requestKey.current);
        }}
      >
        <div className="form-grid">
          <label>
            Monto ($)
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            Motivo
            <input
              value={note}
              maxLength={200}
              placeholder={kind === "deposit" ? "Más cambio" : "Pago al cadete"}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>
        <button className="primary-button" disabled={busy || !valid}>
          {kind === "deposit" ? "Registrar ingreso" : "Registrar retiro"}
        </button>
      </form>
    </section>
  );
}

function MovementRow({
  movement: m,
  time,
  busy,
  onVoid,
}: {
  movement: CashMovement;
  time: string;
  busy: boolean;
  onVoid: (reason: string) => Promise<boolean>;
}) {
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const label =
    m.kind === "payment"
      ? `${paymentLabels[m.method]} · pedido ${orderNumber(m.orderNumber ?? 0)}`
      : `${movementLabels[m.kind]} · ${m.note}`;
  const change = m.tenderedCents ? m.tenderedCents - m.amountCents : 0;
  return (
    <li data-voided={m.voidedAt ? "" : undefined}>
      <div>
        <strong>{label}</strong>
        <span>
          {time}
          {change ? ` · pagó con ${formatMoney(m.tenderedCents!)}, vuelto ${formatMoney(change)}` : ""}
          {m.voidedAt ? ` · anulado: ${m.voidReason}` : ""}
          {!m.voidedAt && m.kind === "payment" && m.orderStatus !== "accepted" ? " · el pedido se anuló" : ""}
        </span>
      </div>
      <span className="cash-amount">
        {m.kind === "withdrawal" ? "− " : ""}
        {formatMoney(m.amountCents)}
      </span>
      {!m.voidedAt ? (
        <button type="button" className="text-button" aria-expanded={voiding} onClick={() => setVoiding((v) => !v)}>
          Anular
        </button>
      ) : (
        <span />
      )}
      {voiding ? (
        <form
          className="app-form cash-void"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await onVoid(reason)) setVoiding(false);
          }}
        >
          <label>
            ¿Por qué lo anulás?
            <input value={reason} maxLength={200} placeholder="Me equivoqué de medio" onChange={(e) => setReason(e.target.value)} />
          </label>
          <button className="secondary-button compact-button" disabled={busy || reason.trim().length < 3}>
            Anular {movementLabels[m.kind].toLowerCase()}
          </button>
        </form>
      ) : null}
    </li>
  );
}

// Blind count: the expected cash is not on this screen and not in the data
// the page has, so the number typed is what's really in the drawer.
function BlindCount({
  busy,
  sessionNumber,
  onBack,
  onClose,
}: {
  busy: boolean;
  sessionNumber: number;
  onBack: () => void;
  onClose: (declaredCents: number, note: string, requestKey: string) => void;
}) {
  const [byBill, setByBill] = useState(false);
  const [total, setTotal] = useState("");
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [coins, setCoins] = useState("");
  const [note, setNote] = useState("");
  const requestKey = useRef(crypto.randomUUID());
  const coinCents = pesosToCents(coins);
  const declared = byBill ? (coinCents === null ? null : countTotal(counts, coinCents)) : total.trim() ? pesosToCents(total) : null;
  return (
    <section className="cash-count" aria-labelledby="count-title">
      <p className="eyebrow">CIERRE DEL TURNO {sessionNumber} · ARQUEO CIEGO</p>
      <h2 id="count-title">Contá el efectivo de la caja.</h2>
      <p className="section-description">
        Todo lo que hay, con el cambio inicial incluido. Recién cuando confirmes te mostramos cuánto debería haber y la diferencia.
      </p>
      <div className="order-filters" role="group" aria-label="Cómo contar">
        <button type="button" aria-pressed={!byBill} onClick={() => setByBill(false)}>
          Total
        </button>
        <button type="button" aria-pressed={byBill} onClick={() => setByBill(true)}>
          Por billete
        </button>
      </div>
      <form
        className="app-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (declared !== null) onClose(declared, note, requestKey.current);
        }}
      >
        {byBill ? (
          <div className="cash-bills">
            {denominations.map((d) => (
              <label key={d}>
                {formatMoney(d)}
                <input
                  type="number"
                  min={0}
                  max={9999}
                  inputMode="numeric"
                  value={counts[d] ?? ""}
                  placeholder="0"
                  onChange={(e) =>
                    setCounts((c) => ({ ...c, [d]: Math.max(0, Math.min(9999, Math.floor(Number(e.target.value) || 0))) }))
                  }
                />
              </label>
            ))}
            <label>
              Monedas ($)
              <input inputMode="decimal" value={coins} placeholder="0" onChange={(e) => setCoins(e.target.value)} />
            </label>
          </div>
        ) : (
          <label>
            Efectivo contado ($)
            <input inputMode="decimal" value={total} placeholder="0" onChange={(e) => setTotal(e.target.value)} />
          </label>
        )}
        <label>
          Nota del cierre
          <input value={note} maxLength={300} placeholder="Opcional" onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="cart-total">
          <span>Contaste</span>
          <strong>{declared === null ? "—" : formatMoney(declared)}</strong>
        </div>
        <div className="dialog-actions">
          <button type="button" className="ghost-button" onClick={onBack} disabled={busy}>
            Volver al turno
          </button>
          <button className="primary-button" disabled={busy || declared === null}>
            {busy ? "Cerrando…" : "Cerrar turno"}
          </button>
        </div>
        <p className="field-hint">Un turno cerrado no se puede reabrir.</p>
      </form>
    </section>
  );
}

function CloseResult({ result, onDone }: { result: ClosedSession; onDone: () => void }) {
  const diff = result.declaredCents - result.expectedCents;
  const t = result.totals;
  const charged = Object.values(t.byMethod).reduce((n, v) => n + v, 0);
  return (
    <section className="cash-result" aria-labelledby="result-title" data-diff={Math.sign(diff)}>
      <p className="eyebrow">TURNO {result.number} CERRADO</p>
      <h2 id="result-title" className="cash-verdict">
        {differenceLabel(diff, formatMoney)}
      </h2>
      <dl className="cash-figures">
        <div>
          <dt>Contaste</dt>
          <dd>{formatMoney(result.declaredCents)}</dd>
        </div>
        <div>
          <dt>Debería haber</dt>
          <dd>{formatMoney(result.expectedCents)}</dd>
        </div>
      </dl>
      <div className="cash-breakdown">
        <h3>Efectivo</h3>
        <dl>
          <div>
            <dt>Cambio inicial</dt>
            <dd>{formatMoney(t.openingCents)}</dd>
          </div>
          <div>
            <dt>Cobros en efectivo</dt>
            <dd>+ {formatMoney(t.cashPaymentsCents)}</dd>
          </div>
          {t.depositsCents ? (
            <div>
              <dt>Ingresos</dt>
              <dd>+ {formatMoney(t.depositsCents)}</dd>
            </div>
          ) : null}
          {t.withdrawalsCents ? (
            <div>
              <dt>Retiros</dt>
              <dd>− {formatMoney(t.withdrawalsCents)}</dd>
            </div>
          ) : null}
        </dl>
        <h3>Cobrado en el turno</h3>
        <dl>
          {(["cash", "transfer", "qr", "card"] as const).map((m) => (
            <div key={m}>
              <dt>{paymentLabels[m]}</dt>
              <dd>{formatMoney(t.byMethod[m])}</dd>
            </div>
          ))}
          <div className="cash-breakdown-total">
            <dt>Total · {t.payments} cobros</dt>
            <dd>{formatMoney(charged)}</dd>
          </div>
        </dl>
        {result.unpaid?.count ? (
          <p className="charge-status" data-state="warn">
            Quedaron {result.unpaid.count} pedidos del turno sin cobrar por {formatMoney(result.unpaid.cents)}.
          </p>
        ) : null}
        {result.note ? <p className="ticket-note">{result.note}</p> : null}
      </div>
      <button type="button" className="primary-button" onClick={onDone}>
        Listo
      </button>
    </section>
  );
}
