"use client";
import { useOptimistic, useTransition } from "react";
import { setAvailability, setMonthAvailability } from "../actions";

export type AvailItem = {
  id: number; date: string; title: string; kind: string;
  /** 1 = posso, 0 = não posso, null = não respondeu */
  state: 0 | 1 | null;
  /** funções em que já está escalado nesse culto */
  roles: string;
  past: boolean;
};

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const LABEL = { 1: "✓ Posso", 0: "✕ Não posso", null: "Toque para responder" } as const;
const next = (s: 0 | 1 | null): 0 | 1 => (s === 1 ? 0 : 1);
const wd = (d: string) => new Date(d + "T12:00:00Z").getUTCDay();

type Op = { id: number; state: 0 | 1 | null } | { all: 0 | 1 | null };

/** Calendário do mês em que cada integrante liga e desliga sua disponibilidade por culto. */
export default function AvailCalendar({ memberId, name, month, mes, today, days, items }: {
  memberId: number; name: string; month: string; mes: string; today: string; days: string[]; items: AvailItem[];
}) {
  const [list, apply] = useOptimistic(items, (cur: AvailItem[], op: Op) =>
    cur.map((x) => ("all" in op ? (x.past ? x : { ...x, state: op.all }) : x.id === op.id ? { ...x, state: op.state } : x)),
  );
  const [pending, start] = useTransition();

  const toggle = (it: AvailItem) => {
    if (it.past) return;
    const s = next(it.state);
    start(async () => {
      apply({ id: it.id, state: s });
      await setAvailability(memberId, it.id, s);
    });
  };
  const setAll = (s: 0 | 1 | null) => start(async () => {
    apply({ all: s });
    await setMonthAvailability(memberId, month, s, today);
  });

  const open = list.filter((x) => !x.past);
  const yes = open.filter((x) => x.state === 1).length;
  const no = open.filter((x) => x.state === 0).length;
  const left = open.length - yes - no;
  const byDay = new Map<string, AvailItem[]>();
  for (const it of list) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);

  const chip = (it: AvailItem) => (
    <button
      key={it.id}
      type="button"
      className={`av-ev s${it.state ?? "n"}${it.past ? " past" : ""}`}
      style={{ "--tc": `var(--t-${it.kind})` } as React.CSSProperties}
      onClick={() => toggle(it)}
      disabled={it.past}
      aria-pressed={it.state === 1}
      title={it.past ? "Culto já passou" : "Tocar para mudar"}
    >
      <span className="ev-t">{it.title}</span>
      <span className="av-s">{it.past ? (it.state === null ? "—" : LABEL[it.state]) : LABEL[it.state ?? "null"]}</span>
      {it.roles && <span className="av-esc">escalado: {it.roles}</span>}
    </button>
  );

  return (
    <>
      <div className="av-head">
        <div>
          <h3>{name}</h3>
          <p className="muted">
            Toque em cada culto de {mes} para marcar se você <b className="ok-t">pode</b> ou <b className="no-t">não pode</b> servir.
            Tudo salva na hora.
          </p>
        </div>
        <div className="av-count" aria-live="polite">
          <span className="chip ok">{yes} posso</span>
          <span className="chip no">{no} não posso</span>
          {left > 0 && <span className="chip miss">{left} sem resposta</span>}
        </div>
      </div>

      {open.length > 0 && (
        <div className="av-bulk">
          <button type="button" className="btn small" disabled={pending} onClick={() => setAll(1)}>Posso em todos</button>
          <button type="button" className="btn small" disabled={pending} onClick={() => setAll(0)}>Não posso em nenhum</button>
          <button type="button" className="btn ghost small" disabled={pending}
            onClick={() => confirm("Apagar suas respostas dos próximos cultos do mês?") && setAll(null)}>Limpar</button>
        </div>
      )}

      {list.length === 0 ? (
        <p className="empty-month">Nenhum culto cadastrado em {mes} ainda.</p>
      ) : (
        <>
          <div className="cal av-cal">
            {SEMANA.map((d) => <div key={d} className="cal-h">{d}</div>)}
            {days.map((d) => (
              <div key={d} className={`cal-d${d.startsWith(month) ? "" : " out"}${d === today ? " today" : ""}${d < today ? " past" : ""}`}>
                <div className="cal-n"><b>{Number(d.slice(8, 10))}</b>{d === today && <span className="hoje">Hoje</span>}</div>
                {(byDay.get(d) ?? []).map(chip)}
              </div>
            ))}
          </div>
          <ol className="cal-list av-list">
            {[...byDay.keys()].map((d) => (
              <li key={d} className={`${d === today ? "today" : ""}${d < today ? " past" : ""}`}>
                <span className="dday"><b>{d.slice(8, 10)}</b><span>{SEMANA[wd(d)]}</span></span>
                <div className="cal-list-evs">{byDay.get(d)!.map(chip)}</div>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
