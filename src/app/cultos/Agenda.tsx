"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { dayName } from "@/lib/format";
import type { AgendaItem } from "./layout";

export default function Agenda({ up, past }: { up: AgendaItem[]; past: AgendaItem[] }) {
  const path = usePathname();
  const item = (s: AgendaItem, isPast: boolean) => {
    const href = `/cultos/${s.id}`;
    const n = Number(s.n);
    return (
      <li key={s.id} className={isPast ? "past" : undefined}>
        <Link href={href} aria-current={path === href ? "page" : undefined}>
          <span className="dday"><b>{s.date.slice(8, 10) || "–"}</b><span>{dayName(s.date)}</span></span>
          <span>
            <span className="t">{s.title || "Culto sem nome"}</span><br />
            <span className="s">{n} música{n === 1 ? "" : "s"}</span>
          </span>
        </Link>
      </li>
    );
  };
  return (
    <aside className="agenda">
      <div className="agenda-head"><h2>Agenda</h2><Link className="btn small primary" href="/cultos">Novo culto</Link></div>
      <ul>
        {up.map((s) => item(s, false))}
        {past.length > 0 && <li className="sep">Anteriores</li>}
        {past.map((s) => item(s, true))}
        {up.length + past.length === 0 && (
          <li className="empty">Nenhum culto ainda. Crie o próximo culto para montar o repertório e a escala.</li>
        )}
      </ul>
    </aside>
  );
}
