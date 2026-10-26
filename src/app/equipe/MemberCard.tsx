"use client";
import { useState, useTransition } from "react";
import type { Access, Member } from "@/lib/db";
import { splitRoles } from "@/lib/roles";

const NIVEIS: [Access, string][] = [["lider", "Liderança"], ["ministro", "Ministro"], ["banda", "Banda"]];

export default function MemberCard({ member, funcoes, meta, save, remove, self, hasPin, setAccess, resetPin }: {
  member: Member;
  funcoes: string[];
  meta: string;
  save: (f: FormData) => Promise<void>;
  remove: (f: FormData) => Promise<void>;
  /** é quem está usando o app (não pode tirar a própria liderança) */
  self: boolean;
  /** já criou o PIN (ministro/liderança) */
  hasPin: boolean;
  setAccess: (id: number, a: Access) => Promise<void>;
  resetPin: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [roles, setRoles] = useState(splitRoles(member.roles));
  const [, start] = useTransition();
  const all = [...new Set([...funcoes, ...roles])];

  const persist = (next: { name?: string; phone?: string; roles?: string[] } = {}) => {
    const f = new FormData();
    f.set("id", String(member.id));
    f.set("name", (next.name ?? name).trim() || member.name);
    f.set("phone", next.phone ?? phone);
    f.set("roles", (next.roles ?? roles).join(", "));
    start(() => save(f));
  };

  return (
    <div className="member">
      <div className="nm">
        <input type="text" value={name} placeholder="Nome" aria-label="Nome"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== member.name && persist()} />
        <button type="button" className="btn ghost icon" aria-label="Remover integrante"
          onClick={() => {
            if (!confirm(`Remover ${member.name} da equipe?`)) return;
            const f = new FormData();
            f.set("id", String(member.id));
            start(() => remove(f));
          }}>✕</button>
      </div>
      <div className="roles">
        {all.map((r) => (
          <button type="button" key={r} className="role" aria-pressed={roles.includes(r)}
            onClick={() => {
              const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
              setRoles(next);
              persist({ roles: next });
            }}>{r}</button>
        ))}
      </div>
      <input type="tel" className="phone" value={phone} placeholder="WhatsApp" aria-label="WhatsApp"
        onChange={(e) => setPhone(e.target.value)}
        onBlur={() => phone !== member.phone && persist()} />
      <div className="meta">{meta}</div>
      <div className="access">
        <select value={member.access} disabled={self} aria-label={`Nível de ${member.name}`}
          title={self ? "Você não pode mudar o próprio nível" : undefined}
          onChange={(e) => start(() => setAccess(member.id, e.target.value as Access))}>
          {NIVEIS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {member.access !== "banda" && (hasPin ? (
          <button type="button" className="btn ghost small"
            onClick={() => { if (confirm(`Zerar o PIN de ${member.name}? No próximo acesso a pessoa cria um novo.`)) start(() => resetPin(member.id)); }}>
            Zerar PIN
          </button>
        ) : <span className="muted small-note">PIN ainda não criado</span>)}
      </div>
    </div>
  );
}
