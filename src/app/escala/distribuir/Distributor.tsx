"use client";
import { useMemo, useState, useTransition } from "react";
import { distribute, INSTRUMENTO, INSTRUMENTOS, type Avail, type DPerson, type DService, type DSlot, type Template } from "@/lib/distribute";
import { dayName, ddmm } from "@/lib/format";
import { FUNCOES, serviceType } from "@/lib/roles";
import { applyDistribution } from "../../actions";

const byFuncao = (a: string, b: string) => (FUNCOES.indexOf(a) + 1 || 99) - (FUNCOES.indexOf(b) + 1 || 99);

/** Proposta de escala do mês: revisa, sorteia de novo, ajusta o modelo e só então lança. */
export default function Distributor({ month, services, people, existing, avail, template: learned, answered }: {
  month: string; services: DService[]; people: DPerson[]; existing: DSlot[];
  avail: Avail; template: Template; answered: number;
}) {
  const [seed, setSeed] = useState(1);
  // enquanto menos da metade respondeu, completa com quem não respondeu (marcado com ?)
  const [useNoAnswer, setUseNoAnswer] = useState(answered < people.length / 2);
  const [template, setTemplate] = useState(learned);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();

  const active = services.filter((s) => !skip.has(s.id));
  const { picks, gaps, load } = useMemo(
    () => distribute({ services: active, people, existing, avail, template, seed, useNoAnswer }),
    [skip, people, existing, avail, template, seed, useNoAnswer],
  );
  const name = new Map(people.map((p) => [p.id, p.name]));
  const maybe = picks.filter((p) => p.maybe).length;
  const missing = gaps.reduce((n, g) => n + g.missing, 0);
  const ready = new Set(existing.map((e) => e.service_id));
  const titles = [...new Set(services.filter((s) => !ready.has(s.id)).map((s) => s.title))];
  const roleName = (r: string) => (r === INSTRUMENTO ? `Instrumento (${INSTRUMENTOS.join(", ").toLowerCase()})` : r);
  const ranking = people.filter((p) => load.get(p.id)).sort((a, b) => (load.get(b.id) ?? 0) - (load.get(a.id) ?? 0) || a.name.localeCompare(b.name));
  const idle = people.filter((p) => !load.get(p.id) && services.some((s) => avail[`${p.id}:${s.id}`] === 1));

  const bump = (title: string, role: string, d: number) =>
    setTemplate((t) => ({ ...t, [title]: { ...t[title], [role]: Math.max(0, (t[title]?.[role] ?? 0) + d) } }));

  return (
    <div className="dist">
      <p className="edit-hint">
        A proposta usa quem marcou <b className="ok-t">posso</b> na Disponibilidade, divide as escalas por igual
        (quem tem menos escalas no mês vem primeiro) e evita a mesma pessoa duas vezes no mesmo dia.
        Cultos que já têm escala lançada <b>não são alterados</b>. Nada é gravado até você clicar em lançar.
      </p>

      <div className="dist-bar">
        <span className="muted">{answered} de {people.length} pessoas já marcaram a disponibilidade deste mês.</span>
        <label className="dist-opt">
          <input type="checkbox" checked={useNoAnswer} onChange={(e) => setUseNoAnswer(e.target.checked)} />
          Usar também quem ainda não respondeu <span className="chip miss">?</span>
        </label>
        <button type="button" className="btn" onClick={() => setSeed((s) => s + 1)}>↻ Sortear de novo</button>
      </div>

      <details className="dist-model">
        <summary>Quantas pessoas cada culto leva <span className="muted">(Domingo e Quinta: banda completa · Intercessão: ministro + 1 instrumento; ajuste se precisar)</span></summary>
        {titles.map((title) => (
          <div key={title} className="dist-tpl">
            <b>{title}</b>
            <span className="dist-steps">
              {[...FUNCOES, INSTRUMENTO].map((role) => {
                const n = template[title]?.[role] ?? 0;
                return (
                  <span key={role} className={`dist-step${n ? "" : " zero"}`}>
                    {roleName(role)}
                    <button type="button" aria-label={`menos ${role}`} onClick={() => bump(title, role, -1)}>−</button>
                    <b>{n}</b>
                    <button type="button" aria-label={`mais ${role}`} onClick={() => bump(title, role, 1)}>+</button>
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </details>

      <div className="dist-sum">
        <b>{picks.length}</b> vaga{picks.length === 1 ? "" : "s"} preenchida{picks.length === 1 ? "" : "s"}
        {maybe > 0 && <> · <span className="no-t">{maybe} com quem não respondeu (?)</span></>}
        {missing > 0 && <> · <span className="no-t">{missing} sem ninguém disponível</span></>}
        {ready.size > 0 && <> · <span className="muted">{ready.size} culto{ready.size === 1 ? "" : "s"} com escala pronta (não mexo)</span></>}
      </div>

      <div className="dist-grid">
        {services.map((s) => {
          const done = ready.has(s.id);
          const off = skip.has(s.id) && !done;
          const mine = existing.filter((e) => e.service_id === s.id);
          const news = picks.filter((p) => p.service_id === s.id);
          const holes = gaps.filter((g) => g.service_id === s.id);
          const roles = [...new Set([...mine.map((e) => e.role), ...news.map((p) => p.role), ...holes.map((g) => g.role)])].sort(byFuncao);
          return (
            <section key={s.id} className={`dcard${off ? " off" : ""}${done ? " done" : ""}`} style={{ "--tc": `var(--t-${serviceType(s.title)[0]})` } as React.CSSProperties}>
              <label className="dcard-h">
                {done ? <span className="ok-t" title="Escala pronta: a distribuição não altera este culto">✓</span> : <input type="checkbox" checked={!off} onChange={() => setSkip((k) => { const n = new Set(k); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} />}
                <span><b>{dayName(s.date)} {ddmm(s.date)}</b> · {s.title}</span>
              </label>
              {done && <p className="muted dcard-note">Escala pronta · não será alterada</p>}
              {off ? <p className="muted">fora da distribuição</p> : (
                <dl>
                  {roles.map((r) => (
                    <div key={r} style={{ display: "contents" }}>
                      <dt>{roleName(r)}</dt>
                      <dd>
                        {mine.filter((e) => e.role === r).map((e) => <span key={`e${e.member_id}`} className="was" title="Já estava na escala">{name.get(e.member_id)}</span>)}
                        {news.filter((p) => p.role === r).map((p) => (
                          <span key={`n${p.member_id}`} className={`new${p.maybe ? " maybe" : ""}`} title={p.maybe ? "Ainda não respondeu a disponibilidade" : "Marcou que pode"}>
                            {name.get(p.member_id)}{p.maybe && " ?"}
                          </span>
                        ))}
                        {holes.filter((g) => g.role === r).map((g) => <span key="gap" className="gap">falta {g.missing > 1 ? g.missing : ""}</span>)}
                      </dd>
                    </div>
                  ))}
                  {!roles.length && <dd className="muted">Sem modelo: ajuste acima quantas pessoas este culto leva.</dd>}
                </dl>
              )}
            </section>
          );
        })}
      </div>

      <div className="dist-load">
        <h3>Escalas por pessoa no mês</h3>
        <p>{ranking.map((p) => <span key={p.id} className="chip">{p.name} <b>{load.get(p.id)}</b></span>)}</p>
        {idle.length > 0 && <p className="muted">Disponíveis que ficaram sem escala: {idle.map((p) => p.name).join(", ")}</p>}
      </div>

      <div className="out-bar dist-go">
        <button type="button" className="btn primary" disabled={pending || !picks.length}
          onClick={() => start(() => applyDistribution(month, picks.map(({ service_id, member_id, role }) => ({ service_id, member_id, role }))))}>
          {pending ? "Lançando…" : `Lançar ${picks.length} pessoa${picks.length === 1 ? "" : "s"} na escala`}
        </button>
        <span className="muted">Depois dá para trocar qualquer nome em Escala → Editar escala.</span>
      </div>
    </div>
  );
}
