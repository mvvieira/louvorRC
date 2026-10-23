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

/** Abas do app; Equipe (níveis e links de acesso) só aparece para a liderança. */
export default function NavTabs({ lider }: { lider: boolean }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Seções">
      {TABS.filter(([href]) => lider || href !== "/equipe").map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href || path.startsWith(href + "/") ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
