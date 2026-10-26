import type { Metadata } from "next";
import Link from "next/link";
import { currentUser, isAdmin } from "@/lib/auth";
import { logout } from "./actions";
import NavTabs from "./NavTabs";
import "./globals.css";

export const metadata: Metadata = { title: "Louvor Rasgando os Céus", description: "Repertório, cifras, vozes e escala do Louvor Rasgando os Céus" };

/** Marca da igreja (como na foto do perfil): sol amarelo "rasgado" por duas formas de céu azul, dentro de um anel claro. */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <clipPath id="logo-in"><circle cx="20" cy="20" r="15.5" /></clipPath>
        <radialGradient id="logo-sky" cx=".4" cy=".35" r=".8">
          <stop offset="0" stopColor="#8FD3F5" /><stop offset="1" stopColor="#2F9BD8" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="#ECECEC" />
      <circle cx="20" cy="20" r="15.5" fill="#FDEF08" />
      <g clipPath="url(#logo-in)" fill="url(#logo-sky)">
        <path d="M2 17 C 8 10, 16 9, 23.5 11.5 C 17 15, 14.5 22, 16.5 36 L 2 36 Z" />
        <circle cx="26" cy="27" r="13" />
      </g>
    </svg>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  const admin = await isAdmin(me);
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <header className="top">
          <div className="wrap">
            <Link href="/" className="brand">
              <Logo />
              <h1><small>LOUVOR</small>Rasgando os Céus</h1>
            </Link>
            {me && <NavTabs lider={me.access === "lider"} admin={admin} />}
          </div>
        </header>
        {me && (
          <div className="wrap me-bar">
            <span><b>{me.name}</b>{me.roles && <> · {me.roles}</>}</span>
            <form action={logout}><button className="btn ghost small">Trocar de pessoa</button></form>
          </div>
        )}
        <main className="wrap">{children}</main>
        <footer className="site-foot">
          <span className="irc" aria-hidden="true"><i>I</i><i>R</i><i>C</i></span>
          Na Rasgando os Céus
        </footer>
      </body>
    </html>
  );
}
