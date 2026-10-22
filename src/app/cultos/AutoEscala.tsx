"use client";
import { useMemo, useState, useTransition } from "react";
import { distribute, type Avail, type DPerson, type DService, type DSlot, type Template } from "@/lib/distribute";
import { FUNCOES } from "@/lib/roles";
import { applyDistribution } from "../actions";

/**
 * "Distribuir escala" de um culto: propõe as vagas que faltam com quem marcou que pode,
 * dividindo por igual com o resto do mês. Quem já está na escala não é trocado.
 */
export default function AutoEscala({ serviceId, month, services, people, existing, avail, template }: {
  serviceId: number; month: string; services: DService[]; people: DPerson[];
  existing: DSlot[]; avail: Avail; template: Template;
}) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState(1);
  const answered = people.filter((p) => avail[`${p.id}:${serviceId}`] !== undefined).length;
  const [useNoAnswer, setUseNoAnswer] = useState(answered < people.length / 2);
  const [pending, start] = useTransition();

  const { picks, gaps, load } = useMemo(
    () => distribute({ services, people, existing, avail, template, seed, useNoAnswer, targets: [serviceId], complete: true }),
    [services, people, existing, avail, template, seed, useNoAnswer, serviceId],
  );
  const name = new Map(people.map((p) => [p.id, p.name]));
  const order = (r: string) => (FUNCOES.indexOf(r) + 1 || 99);
  const started = existing.some((e) => e.service_id === serviceId);
  const yes = people.filter((p) => avail[`${p.id}:${serviceId}`] === 1).length;
  const no = people.filter((p) => avail[`${p.id}:${serviceId}`] === 0).length;

  // escala já completa pelo modelo: nada a distribuir
  if (!picks.length && !gaps.length) return null;

  if (!open) {
    return (
      <button type="button" className="btn primary auto-btn" onClick={() => setOpen(true)}>
        ✨ {started ? "Completar escala" : "Distribuir escala"} pela disponibilidade
      </button>
    );
  }

  return (
    <div className="auto-esc">
      <p className="muted auto-info">
        <b className="ok-t">{yes} podem</b> · <span className="no-t">{no} não podem</span> · {people.length - yes - no} sem resposta neste culto.
        {started && " Quem já está na escala continua; só as vagas que faltam são preenchidas."}
      </p>
      <ul className="auto-list">
        {[...picks].sort((a, b) => order(a.role) - order(b.role)).map((p) => (
          <li key={`${p.role}${p.member_id}`}>
            <span className="role-n">{p.role}</span>
            <b className={p.maybe ? "no-t" : undefined} title={p.maybe ? "Ainda não respondeu a disponibilidade" : "Marcou que pode"}>
              {name.get(p.member_id)}{p.maybe && " ?"}
            </b>
            <span className="muted">{load.get(p.member_id)}ª escala no mês</span>
          </li>
        ))}
        {gaps.map((g) => (
          <li key={`gap${g.role}`}>
            <span className="role-n">{g.role}</span>
            <span className="no-t">ninguém disponível{g.missing > 1 ? ` (faltam ${g.missing})` : ""}</span>
          </li>
        ))}
      </ul>
      <label className="dist-opt">
        <input type="checkbox" checked={useNoAnswer} onChange={(e) => setUseNoAnswer(e.target.checked)} />
        Usar também quem ainda não respondeu <span className="chip miss">?</span>
      </label>
      <div className="out-bar">
        <button type="button" className="btn primary" disabled={pending || !picks.length}
          onClick={() => start(async () => {
            await applyDistribution(month, picks.map(({ service_id, member_id, role }) => ({ service_id, member_id, role })), true);
            setOpen(false);
          })}>
          {pending ? "Lançando…" : `Lançar ${picks.length} na escala`}
        </button>
        <button type="button" className="btn" disabled={pending} onClick={() => setSeed((s) => s + 1)}>↻ Sortear de novo</button>
        <button type="button" className="btn ghost" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </div>
  );
}
