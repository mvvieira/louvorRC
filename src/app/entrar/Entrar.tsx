"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enterPassword, enterTeam, pickMember } from "./actions";

type P = { id: number; name: string; roles: string };

export default function Entrar({ team, people }: { team: boolean; people: P[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [pass, setPass] = useState("");
  const [q, setQ] = useState("");
  const [locked, setLocked] = useState<{ id: number; name: string } | null>(null);
  const [secret, setSecret] = useState("");

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
    return (
      <form className="sheet login" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await enterPassword(locked.id, secret);
          if ("ok" in r) go(); else { setErr(r.error); setSecret(""); }
        });
      }}>
        <h2>{locked.name}</h2>
        <p className="muted">Este perfil tem senha. Digite a sua senha para entrar.</p>
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Sua senha" aria-label="Sua senha" autoFocus required />
        {err && <p className="no-t">{err}</p>}
        <button className="btn primary" disabled={pending || !secret}>{pending ? "Conferindo…" : "Entrar"}</button>
        <button type="button" className="btn ghost small" onClick={() => { setLocked(null); setSecret(""); setErr(""); }}>Não sou {locked.name}</button>
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
