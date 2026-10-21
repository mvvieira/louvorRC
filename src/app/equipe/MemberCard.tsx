"use client";
import { useState, useTransition } from "react";
import type { Member } from "@/lib/db";
import { splitRoles } from "@/lib/roles";

export default function MemberCard({ member, funcoes, meta, save, remove }: {
  member: Member;
  funcoes: string[];
  meta: string;
  save: (f: FormData) => Promise<void>;
  remove: (f: FormData) => Promise<void>;
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
    </div>
  );
}
