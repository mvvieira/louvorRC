"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enterTeam, pickMember } from "./actions";

type P = { id: number; name: string; roles: string };

export default function Entrar({ team, people }: { team: boolean; people: P[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [pass, setPass] = useState("");
  const [q, setQ] = useState("");

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
              if (await pickMember(p.id)) go();
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
