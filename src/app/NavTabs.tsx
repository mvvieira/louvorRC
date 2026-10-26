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

/** Abas do app; Equipe e Relatórios só para a liderança e Acessos só para o administrador. */
export default function NavTabs({ lider, admin }: { lider: boolean; admin: boolean }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label="Seções">
      {[...TABS, ["/relatorios", "Relatórios"], ...(admin ? [["/acessos", "Acessos"]] : [])].filter(([href]) => lider || (href !== "/equipe" && href !== "/relatorios")).map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href || path.startsWith(href + "/") ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
