import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "rc_acesso"; // mesmo nome de lib/auth (o proxy não carrega o banco)

/** Sem o cookie de quem entrou, vai para a tela de entrada (a checagem de verdade fica em lib/auth). */
export function proxy(req: NextRequest) {
  if (!req.cookies.get(COOKIE)) return NextResponse.redirect(new URL("/entrar", req.url));
  // as páginas leem o caminho para o log de acesso
  const headers = new Headers(req.headers);
  headers.set("x-path", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|entrar|icon.svg|favicon.ico).*)"],
};
