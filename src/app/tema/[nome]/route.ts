import { NextResponse, type NextRequest } from "next/server";

/** Prévia de tema neste aparelho: /tema/sereno, /tema/noite; /tema/oficial volta ao visual oficial. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ nome: string }> }) {
  const { nome } = await params;
  const res = NextResponse.redirect(new URL("/calendario", req.url));
  if (nome === "sereno" || nome === "noite") res.cookies.set("rc_tema", nome, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  else res.cookies.delete("rc_tema");
  return res;
}
