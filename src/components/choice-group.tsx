"use client";
import { formatMoney, groupRule, type OptionGroup } from "@/lib/menu";

export type ChoicePicks = Record<string, number>;
/** One id per unit picked, in carta order, as checkout and sales expect. */
export function choiceIdsOf(groups: OptionGroup[], picks: ChoicePicks) {
  return groups.flatMap((g) =>
    g.options.flatMap((o) => Array<string>(picks[o.id] ?? 0).fill(o.id)),
  );
}
export function ChoiceGroup({
  group,
  picks,
  onChange,
  inputName,
}: {
  group: OptionGroup;
  picks: ChoicePicks;
  onChange: (picks: ChoicePicks) => void;
  inputName: string;
}) {
  const total = group.options.reduce((n, o) => n + (picks[o.id] ?? 0), 0);
  const full = total >= group.max;
  const set = (id: string, count: number) => {
    const next = { ...picks };
    if (count > 0) next[id] = count;
    else delete next[id];
    onChange(next);
  };
  return (
    <fieldset className="shop-choice-group">
      <legend>
        <span>{group.name}</span>
        <small>
          {groupRule(group)}
          {group.min ? " · obligatorio" : ""}
          {group.max > 1 ? ` · ${total}/${group.max}` : ""}
        </small>
      </legend>
      {group.options.map((o) =>
        group.repeat ? (
          <div className="shop-choice-row" key={o.id}>
            <span>
              {o.name}
              {o.priceCents ? (
                <small>+ {formatMoney(o.priceCents)}</small>
              ) : null}
            </span>
            <div className="quantity-control">
              <button
                type="button"
                disabled={!picks[o.id]}
                aria-label={`Quitar una de ${o.name}`}
                onClick={() => set(o.id, (picks[o.id] ?? 0) - 1)}
              >
                −
              </button>
              <span aria-live="polite">{picks[o.id] ?? 0}</span>
              <button
                type="button"
                disabled={full}
                aria-label={`Sumar una de ${o.name}`}
                onClick={() => set(o.id, (picks[o.id] ?? 0) + 1)}
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <label className="checkbox-label" key={o.id}>
            <input
              type={group.max === 1 && group.min === 1 ? "radio" : "checkbox"}
              name={inputName}
              checked={!!picks[o.id]}
              disabled={!picks[o.id] && full && group.max > 1}
              onChange={() => {
                if (picks[o.id] && !(group.max === 1 && group.min === 1))
                  set(o.id, 0);
                else if (group.max === 1)
                  onChange(
                    Object.fromEntries([
                      ...Object.entries(picks).filter(
                        ([id]) => !group.options.some((x) => x.id === id),
                      ),
                      [o.id, 1],
                    ]),
                  );
                else set(o.id, 1);
              }}
            />
            {o.name}
            {o.priceCents ? <span>+ {formatMoney(o.priceCents)}</span> : null}
          </label>
        ),
      )}
    </fieldset>
  );
}
