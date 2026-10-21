"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { searchScore } from "@/lib/match";

type P = { id: number; name: string; roles: string; answered: number };
export const ME_KEY = "rc-louvor:eu";

/** Lista de nomes para cada integrante se identificar. Lembra a última escolha neste aparelho. */
export default function PickPerson({ month, total, people }: { month: string; total: number; people: P[] }) {
  const [q, setQ] = useState("");
  const [last, setLast] = useState<P | null>(null);
  useEffect(() => {
    try {
      const id = Number(localStorage.getItem(ME_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (id) setLast(people.find((p) => p.id === id) ?? null);
    } catch { /* sem armazenamento: só não lembra */ }
  }, [people]);

  const href = (p: P) => `/disponibilidade?m=${month}&p=${p.id}`;
  const shown = q.trim() ? people.filter((p) => searchScore(q, p.name) > 0) : people;
  const done = people.filter((p) => total && p.answered >= total).length;

  return (
    <>
      {last && (
        <Link className="av-last" href={href(last)}>
          Continuar como <b>{last.name}</b> →
        </Link>
      )}
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar meu nome…" aria-label="Procurar nome" className="av-search" />
      <ul className="av-people">
        {shown.map((p) => (
          <li key={p.id}>
            <Link href={href(p)}>
              <b>{p.name}</b>
              <span className="muted">{p.roles || "sem função marcada"}</span>
              <span className={`chip ${total && p.answered >= total ? "ok" : p.answered ? "" : "miss"}`}>
                {total === 0 ? "sem cultos" : p.answered >= total ? "respondeu" : p.answered ? `${p.answered} de ${total}` : "falta responder"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {total > 0 && <p className="muted" style={{ fontSize: 14 }}>{done} de {people.length} pessoas já responderam o mês todo.</p>}
    </>
  );
}
