"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/calendario", "Calendário"],
  ["/cultos", "Cultos"],
  ["/escala", "Escala"],
  ["/disponibilidade", "Disponibilidade"],
  ["/musicas", "Músicas"],
  ["/equipe", "Equipe"],
];

export default function NavTabs() {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Seções">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href || path.startsWith(href + "/") ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
