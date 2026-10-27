"use client";
import { useState, useTransition } from "react";
import { changeMyPassword } from "../actions";

export default function TrocarSenha({ name }: { name: string }) {
  const [pending, start] = useTransition();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <form className="sheet login" onSubmit={(e) => {
      e.preventDefault();
      if (next !== again) { setMsg({ ok: false, t: "As duas senhas novas não estão iguais." }); return; }
      start(async () => {
        const r = await changeMyPassword(cur, next);
        if ("ok" in r) { setMsg({ ok: true, t: "✓ Senha trocada. Use a nova na próxima vez que entrar." }); setCur(""); setNext(""); setAgain(""); }
        else setMsg({ ok: false, t: r.error });
      });
    }}>
      <h2>Trocar senha</h2>
      <p className="muted">{name}, digite a sua senha atual e a nova.</p>
      <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Senha atual" aria-label="Senha atual" autoComplete="current-password" required />
      <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Nova senha (mín. 4 caracteres)" aria-label="Nova senha" autoComplete="new-password" required />
      <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="Repita a nova senha" aria-label="Repita a nova senha" autoComplete="new-password" required />
      {msg && <p className={msg.ok ? "ok-t" : "no-t"}>{msg.t}</p>}
      <button className="btn primary" disabled={pending || !cur || !next || !again}>{pending ? "Salvando…" : "Trocar senha"}</button>
    </form>
  );
}
