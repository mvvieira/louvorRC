import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "rc_acesso"; // mesmo nome de lib/auth (o proxy não carrega o banco)

/** Sem o cookie do link pessoal, só a tela "sem acesso" (a checagem de verdade fica em lib/auth). */
export function proxy(req: NextRequest) {
  if (!req.cookies.get(COOKIE)) return NextResponse.redirect(new URL("/sem-acesso", req.url));
}

export const config = {
  matcher: ["/((?!_next/|entrar/|sem-acesso|icon.svg|favicon.ico).*)"],
};
