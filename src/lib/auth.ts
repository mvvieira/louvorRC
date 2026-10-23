import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { one, type Access } from "./db";

/* Acesso por link pessoal: o cookie guarda o segredo do link; o nível vem da pessoa na Equipe. */

export const COOKIE = "rc_acesso";
export type User = { id: number; name: string; access: Access };

const RANK: Record<Access, number> = { banda: 1, ministro: 2, lider: 3 };
export const ACCESS_NAME: Record<Access, string> = { lider: "Liderança", ministro: "Ministro", banda: "Banda" };

/** Quem está usando o app (uma consulta por requisição). */
export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const u = await one<User>("SELECT id, name, access FROM members WHERE token=? AND token<>'' AND active=1", [token]);
  return u ? { id: Number(u.id), name: u.name, access: u.access } : null;
});

/** O usuário tem pelo menos este nível? */
export const can = (u: User | null, level: Access) => !!u && RANK[u.access] >= RANK[level];

/** Para server actions: barra quem não tem o nível (a tela esconde, mas a regra vale aqui). */
export async function requireLevel(level: Access): Promise<User> {
  const u = await currentUser();
  if (!can(u, level)) throw new Error("Sem permissão para esta ação.");
  return u!;
}

/** A própria pessoa, ou a liderança, pode mexer na disponibilidade dela. */
export async function requireSelf(memberId: number): Promise<User> {
  const u = await currentUser();
  if (!u || (u.id !== memberId && u.access !== "lider")) throw new Error("Sem permissão para esta ação.");
  return u;
}

/** Para páginas: exige alguém logado (link revogado → tela "sem acesso"); com `level`, volta ao calendário quem não tem o nível. */
export async function pageUser(level: Access = "banda"): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/sem-acesso?invalido=1");
  if (!can(u, level)) redirect("/calendario");
  return u;
}
