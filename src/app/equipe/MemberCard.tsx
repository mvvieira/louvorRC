"use client";
import { useState, useTransition } from "react";
import type { Member } from "@/lib/db";

/** Só o que o cartão precisa (nunca mandar token ou hash de senha ao navegador). */
export type MemberRow = Pick<Member, "id" | "name" | "roles" | "phone"> & { must_change: number };
import { splitRoles } from "@/lib/roles";


export default function MemberCard({ member, funcoes, meta, save, remove, resetPassword }: {
  member: MemberRow;
  funcoes: string[];
  meta: string;
  save: (f: FormData) => Promise<void>;
  remove: (f: FormData) => Promise<void>;
  /** zerar a senha (volta para a inicial); só para quem pode */
  resetPassword?: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState(member.name);
  const [roles, setRoles] = useState(splitRoles(member.roles));
  const [, start] = useTransition();
  const all = [...new Set([...funcoes, ...roles])];

  const persist = (next: { name?: string; roles?: string[] } = {}) => {
    const f = new FormData();
    f.set("id", String(member.id));
    f.set("name", (next.name ?? name).trim() || member.name);
    f.set("phone", member.phone); // campo de WhatsApp oculto por enquanto: mantém o que já estava salvo
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
      <div className="meta">{meta}</div>
      {resetPassword && (
        <div className="pass-row">
          <span className="muted">{member.must_change ? "Senha inicial (ainda não trocou)" : "Senha própria criada"}</span>
          <button type="button" className="btn ghost small"
            onClick={() => { if (confirm(`Zerar a senha de ${member.name}? Volta para a senha inicial e a pessoa cria outra no próximo acesso.`)) start(() => resetPassword(member.id)); }}>
            Zerar senha
          </button>
        </div>
      )}
    </div>
  );
}
