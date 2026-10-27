"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const TABS = [
  ["/calendario", "Calendário"],
  ["/cultos", "Cultos"],
  ["/escala", "Escala"],
  ["/disponibilidade", "Disponibilidade"],
  ["/musicas", "Músicas"],
  ["/equipe", "Equipe"],
];

/** Abas do app; Equipe e Relatórios só para a liderança e Acessos só para quem vê o log de acesso. */
export default function NavTabs({ lider, admin }: { lider: boolean; admin: boolean }) {
  const path = usePathname();
  const nav = useRef<HTMLElement>(null);
  // no celular o menu é uma linha que rola para o lado: traz a aba aberta para a vista
  useEffect(() => {
    nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [path]);
  // "Escala" não fica marcada nas páginas de montar/distribuir
  const current = (href: string) =>
    href === "/escala" ? path === "/escala" : href === "/escala/montar" ? path.startsWith("/escala/") : path === href || path.startsWith(href + "/");
  return (
    <nav className="tabs" aria-label="Seções" ref={nav}>
      {[...TABS.slice(0, 3), ["/escala/montar", "Montar escala"], ...TABS.slice(3), ["/relatorios", "Relatórios"], ...(admin ? [["/acessos", "Acessos"]] : [])]
        .filter(([href]) => lider || !["/equipe", "/relatorios", "/escala/montar"].includes(href)).map(([href, label]) => (
        <Link key={href} href={href} aria-current={current(href) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
