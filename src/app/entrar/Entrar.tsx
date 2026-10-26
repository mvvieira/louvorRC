"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enterPin, enterTeam, pickMember } from "./actions";

type P = { id: number; name: string; roles: string; pin: boolean };

export default function Entrar({ team, people }: { team: boolean; people: P[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [pass, setPass] = useState("");
  const [q, setQ] = useState("");
  const [pinFor, setPinFor] = useState<{ id: number; name: string; mode: "create" | "enter" } | null>(null);
  const [pin, setPin] = useState("");

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

  if (pinFor) {
    return (
      <form className="sheet login" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await enterPin(pinFor.id, pin);
          if ("done" in r) go(); else { setErr(r.error); setPin(""); }
        });
      }}>
        <h2>{pinFor.name}</h2>
        <p className="muted">
          {pinFor.mode === "create"
            ? "Primeiro acesso: crie um PIN de 4 números. Ele protege o seu acesso de ministro/liderança."
            : "Digite o seu PIN de 4 números."}
        </p>
        <input className="pin" type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" aria-label="PIN" autoFocus />
        {err && <p className="no-t">{err}</p>}
        <button className="btn primary" disabled={pending || pin.length !== 4}>{pending ? "Conferindo…" : pinFor.mode === "create" ? "Criar PIN e entrar" : "Entrar"}</button>
        <button type="button" className="btn ghost small" onClick={() => { setPinFor(null); setPin(""); setErr(""); }}>Não sou {pinFor.name}</button>
        {pinFor.mode === "enter" && <p className="muted small">Esqueceu o PIN? Peça para a liderança zerar na aba Equipe.</p>}
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
              if ("done" in r) go();
              else if ("pin" in r) { setErr(""); setPinFor({ id: p.id, name: r.name, mode: r.pin }); }
              else { setErr(r.error); router.refresh(); }
            })}>
              <b>{p.name}</b>
              <span className="muted">{p.roles || "—"}</span>
              {p.pin && <span className="chip">🔒 PIN</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
