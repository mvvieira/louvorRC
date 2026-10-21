"use client";
import { useRef, useTransition } from "react";
import { canServe } from "@/lib/roles";

export type SlotPerson = { id: number; name: string; roles: string[] };

/**
 * Seletor de uma posição da escala. Com `slotId`, troca/tira quem está lá;
 * sem `slotId`, acrescenta alguém na função.
 */
export default function SlotSelect({ serviceId, role, slotId, current, people, busy, away = [], change, add }: {
  serviceId: number;
  role: string;
  slotId?: number;
  current?: number;
  people: SlotPerson[];
  /** pessoas já escaladas nesse culto (para avisar repetição) */
  busy: number[];
  /** quem marcou "indisponível" para esse culto */
  away?: number[];
  change: (f: FormData) => Promise<void>;
  add: (f: FormData) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const ref = useRef<HTMLSelectElement>(null);
  // só quem cumpre a função e está disponível; quem já está na posição continua aparecendo mesmo assim
  const fit = people.filter((p) => canServe(p, role, away) || p.id === current);
  const label = (p: SlotPerson) =>
    (away.includes(p.id) ? "⚠ " : "") + p.name +
    (away.includes(p.id) ? " · indisponível" : p.id !== current && busy.includes(p.id) ? " · já escalado" : "");
  const warn = current !== undefined && away.includes(current);

  return (
    <select
      ref={ref}
      className={`slot${slotId ? "" : " slot-add"}${pending ? " saving" : ""}${warn ? " away" : ""}`}
      title={warn ? "Esta pessoa marcou que não pode neste culto" : undefined}
      value={current ? String(current) : ""}
      disabled={pending}
      aria-label={slotId ? `${role}: trocar pessoa` : `${role}: acrescentar pessoa`}
      onChange={(e) => {
        const v = e.target.value;
        if (slotId && !v && !confirm(`Tirar esta pessoa de ${role}?`)) { e.target.value = String(current ?? ""); return; }
        const f = new FormData();
        f.set("service_id", String(serviceId));
        f.set("member_id", v);
        f.set("role", role);
        if (slotId) f.set("id", String(slotId));
        start(() => (slotId ? change(f) : add(f)));
      }}
    >
      <option value="">{slotId ? "✕ Tirar da escala" : fit.length ? "+ acrescentar" : `ninguém faz ${role}`}</option>
      {fit.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
    </select>
  );
}
