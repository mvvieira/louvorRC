"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dayName, MESES } from "@/lib/format";
import type { AgendaItem } from "./layout";

export default function Agenda({ up, past, lider }: { up: AgendaItem[]; past: AgendaItem[]; lider: boolean }) {
  const path = usePathname();
  const item = (s: AgendaItem, isPast: boolean) => {
    const href = `/cultos/${s.id}`;
    const n = Number(s.n);
    return (
      <li key={s.id} className={[isPast && "past", s.mine && "mine"].filter(Boolean).join(" ") || undefined}>
        <Link href={href} aria-current={path === href ? "page" : undefined}>
          <span className="dday"><b>{s.date.slice(8, 10) || "–"}</b><span>{dayName(s.date)}</span></span>
          <span>
            <span className="t">{s.title || "Culto sem nome"}</span><br />
            {s.mine && <span className="ev-you">★ Você · {s.mine}</span>}
            <span className="s">{n} música{n === 1 ? "" : "s"}</span>
          </span>
        </Link>
      </li>
    );
  };
  // separa por mês, para "31 → 01" não parecer fora de ordem
  const byMonth = (list: AgendaItem[], isPast: boolean, prefix = "") =>
    list.flatMap((s, i) => {
      const m = s.date.slice(0, 7);
      const head = i === 0 || list[i - 1].date.slice(0, 7) !== m
        ? [<li key={`m${prefix}${m}`} className="sep">{prefix}{MESES[Number(m.slice(5, 7)) - 1]}{m.slice(0, 4) !== new Date().getFullYear().toString() ? ` ${m.slice(0, 4)}` : ""}</li>]
        : [];
      return [...head, item(s, isPast)];
    });
  return (
    <aside className="agenda">
      <div className="agenda-head"><h2>Agenda</h2>{lider && <Link className="btn small primary" href="/cultos">Novo culto</Link>}</div>
      <ul>
        {byMonth(up, false)}
        {byMonth(past, true, "Anteriores · ")}
        {up.length + past.length === 0 && (
          <li className="empty">Nenhum culto ainda. Crie o próximo culto para montar o repertório e a escala.</li>
        )}
      </ul>
    </aside>
  );
}
