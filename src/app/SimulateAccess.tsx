"use client";
import { useTransition } from "react";
import { simulateAccess, stopSimulation } from "./actions";

type Person = { id: number; name: string; access: string };
const GRUPOS: [string, string][] = [["lider", "Liderança"], ["ministro", "Ministros"], ["banda", "Banda"]];

/** Simulador de acesso (só o administrador): escolhe alguém e o app passa a mostrar a visão dessa pessoa. */
export default function SimulateAccess({ people, realId, current }: { people: Person[]; realId: number; current?: number }) {
  const [pending, start] = useTransition();
  const pick = (id: string) => start(async () => {
    const f = new FormData();
    f.set("member", id);
    await simulateAccess(f);
  });
  return (
    <span className="sim-pick">
      <label htmlFor="sim-member">{current ? "Trocar:" : "Ver como"}</label>
      <select id="sim-member" value={current ?? ""} disabled={pending} onChange={(e) => pick(e.target.value)}>
        {!current && <option value="">escolha alguém…</option>}
        {GRUPOS.map(([level, label]) => (
          <optgroup key={level} label={label}>
            {people.filter((p) => p.access === level && p.id !== realId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
        ))}
      </select>
      {current && (
        <button type="button" className="btn small" disabled={pending} onClick={() => start(() => stopSimulation())}>Voltar para mim</button>
      )}
    </span>
  );
}
