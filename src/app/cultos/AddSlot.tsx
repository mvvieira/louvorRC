"use client";
import { useState } from "react";
import SlotSelect, { type SlotPerson } from "../SlotSelect";

/** Linha "escalar mais alguém": escolhe a função e aparecem só as pessoas que a cumprem. */
export default function AddSlot({ serviceId, roles, people, busy, away, add }: {
  serviceId: number; roles: string[]; people: SlotPerson[]; busy: number[]; away: number[]; add: (f: FormData) => Promise<void>;
}) {
  const [role, setRole] = useState("");
  return (
    <div className="esc-row add">
      <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Função">
        <option value="">+ Escalar função…</option>
        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {role
        ? <SlotSelect key={role} serviceId={serviceId} role={role} people={people} busy={busy} away={away} change={add} add={add} />
        : <span className="muted" style={{ fontSize: 14 }}>escolha a função para ver quem pode</span>}
      <span />
    </div>
  );
}
