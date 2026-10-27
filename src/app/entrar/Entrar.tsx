"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enterPassword, enterTeam, pickMember, setFirstPassword } from "./actions";

type P = { id: number; name: string; roles: string };

export default function Entrar({ team, people }: { team: boolean; people: P[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [pass, setPass] = useState("");
  const [q, setQ] = useState("");
  const [locked, setLocked] = useState<{ id: number; name: string } | null>(null);
  const [secret, setSecret] = useState("");
  const [creating, setCreating] = useState(false);
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");

  const go = () => { router.replace("/calendario"); router.refresh(); };

  if (!team) {
    return (
      <form className="sheet login" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          if (await enterTeam(pass)) { setErr(""); router.refresh(); } else setErr("Senha errada. Confira a senha que a liderança mandou no grupo.");
        });
      }}>
        <h2>Louvor Rasgando os Céus</h2>
        <p className="muted">Digite a senha da equipe (a liderança manda no grupo do WhatsApp). O celular lembra depois.</p>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Senha da equipe" aria-label="Senha da equipe" autoFocus required />
        {err && <p className="no-t">{err}</p>}
        <button className="btn primary" disabled={pending || !pass}>{pending ? "Conferindo…" : "Entrar"}</button>
      </form>
    );
  }

  if (locked) {
    if (creating) {
      return (
        <form className="sheet login" onSubmit={(e) => {
          e.preventDefault();
          if (next !== again) { setErr("As duas senhas não estão iguais."); return; }
          start(async () => {
            const r = await setFirstPassword(locked.id, secret, next);
            if ("ok" in r) go(); else setErr(r.error);
          });
        }}>
          <h2>{locked.name}</h2>
          <p className="muted">Primeiro acesso: crie a sua senha. Ela é só sua; use-a nas próximas vezes.</p>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Nova senha (mín. 4 caracteres)" aria-label="Nova senha" autoComplete="new-password" autoFocus required />
          <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="Repita a nova senha" aria-label="Repita a nova senha" autoComplete="new-password" required />
          {err && <p className="no-t">{err}</p>}
          <button className="btn primary" disabled={pending || !next || !again}>{pending ? "Salvando…" : "Criar senha e entrar"}</button>
        </form>
      );
    }
    return (
      <form className="sheet login" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await enterPassword(locked.id, secret);
          if ("ok" in r) go();
          else if ("change" in r) { setErr(""); setCreating(true); }
          else { setErr(r.error); setSecret(""); }
        });
      }}>
        <h2>{locked.name}</h2>
        <p className="muted">Digite a sua senha. No primeiro acesso, use a senha inicial que a liderança passou.</p>
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Sua senha" aria-label="Sua senha" autoComplete="current-password" autoFocus required />
        {err && <p className="no-t">{err}</p>}
        <button className="btn primary" disabled={pending || !secret}>{pending ? "Conferindo…" : "Entrar"}</button>
        <button type="button" className="btn ghost small" onClick={() => { setLocked(null); setSecret(""); setErr(""); }}>Não sou {locked.name}</button>
        <p className="muted" style={{ fontSize: 13 }}>Esqueceu a senha? Peça para a liderança zerar.</p>
      </form>
    );
  }

  const nq = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const shown = people.filter((p) => !nq || p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(nq));
  return (
    <div className="sheet login wide">
      <h2>Quem é você?</h2>
      <p className="muted">Toque no seu nome. O celular lembra depois.</p>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar meu nome…" aria-label="Procurar nome" />
      {err && <p className="no-t">{err}</p>}
      <ul className="av-people">
        {shown.map((p) => (
          <li key={p.id}>
            <button type="button" className="who-btn" disabled={pending} onClick={() => start(async () => {
              const r = await pickMember(p.id);
              if (r === "in") go();
              else if (r === "password") { setErr(""); setLocked({ id: p.id, name: p.name }); }
              else { setErr("Digite a senha do grupo de novo."); router.refresh(); }
            })}>
              <b>{p.name}</b>
              <span className="muted">{p.roles || "—"}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
