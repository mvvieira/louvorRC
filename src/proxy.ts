import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "rc_acesso"; // mesmo nome de lib/auth (o proxy não carrega o banco)

/** Sem o cookie de quem entrou, vai para a tela de entrada (a checagem de verdade fica em lib/auth). */
export function proxy(req: NextRequest) {
  if (!req.cookies.get(COOKIE)) return NextResponse.redirect(new URL("/entrar", req.url));
}

export const config = {
  matcher: ["/((?!_next/|entrar|icon.svg|favicon.ico).*)"],
};
