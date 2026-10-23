import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/auth";
import { one } from "@/lib/db";

/** Link pessoal de acesso: guarda o segredo no celular por 1 ano e abre o app. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await one<{ id: number }>("SELECT id FROM members WHERE token=? AND token<>'' AND active=1", [token]);
  if (!ok) return NextResponse.redirect(new URL("/sem-acesso?invalido=1", req.url));
  const res = NextResponse.redirect(new URL("/calendario", req.url));
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
