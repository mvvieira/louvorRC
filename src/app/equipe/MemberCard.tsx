"use client";
import { useState, useTransition } from "react";
import type { Access, Member } from "@/lib/db";
import CopyButton from "../CopyButton";
import { splitRoles } from "@/lib/roles";

const NIVEIS: [Access, string][] = [["lider", "Liderança"], ["ministro", "Ministro"], ["banda", "Banda"]];

/** WhatsApp com DDI 55 quando o número vem só com DDD. */
const wa = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length >= 10 ? (d.length <= 11 ? "55" + d : d) : "";
};

export default function MemberCard({ member, funcoes, meta, save, remove, self, link, setAccess, renew }: {
  member: Member;
  funcoes: string[];
  meta: string;
  save: (f: FormData) => Promise<void>;
  remove: (f: FormData) => Promise<void>;
  /** é quem está usando o app (não pode tirar a própria liderança) */
  self: boolean;
  /** link pessoal de acesso */
  link: string;
  setAccess: (id: number, a: Access) => Promise<void>;
  renew: (id: number) => Promise<void>;
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
        <CopyButton text={link} label="Copiar link" done="Link copiado" className="btn small" />
        {wa(phone) && (
          <a className="btn small" target="_blank" rel="noopener"
            href={`https://wa.me/${wa(phone)}?text=${encodeURIComponent(`Oi, ${member.name}! Este é o seu link do app do Louvor RC (é pessoal, não repasse): ${link}`)}`}>
            WhatsApp
          </a>
        )}
        <button type="button" className="btn ghost small"
          onClick={() => { if (confirm(`Gerar um link novo para ${member.name}? O link atual para de funcionar.`)) start(() => renew(member.id)); }}>
          Novo link
        </button>
      </div>
    </div>
  );
}
