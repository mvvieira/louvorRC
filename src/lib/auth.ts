import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { one, type Access } from "./db";

/*
 * Entrada: senha do grupo (cookie rc_equipe) → a pessoa toca no próprio nome.
 * Depois disso o cookie rc_acesso guarda o segredo de sessão da pessoa; o nível vem da pessoa na Equipe.
 */

export const COOKIE = "rc_acesso";
export const TEAM_COOKIE = "rc_equipe";
export const YEAR = 60 * 60 * 24 * 365;
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

/** Para páginas: exige alguém conectado (senão, tela de entrada); com `level`, volta ao calendário quem não tem o nível. */
export async function pageUser(level: Access = "banda"): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/entrar");
  if (!can(u, level)) redirect("/calendario");
  return u;
}

/* ---------- Senha do grupo ---------- */

export async function teamPassword(): Promise<string> {
  return (await one<{ value: string }>("SELECT value FROM settings WHERE key='team_password'"))?.value ?? "";
}

/** Sem diferença de maiúsculas e espaços, para ninguém errar no celular. */
export const normPass = (p: string) => p.trim().toLowerCase();

/** O que fica no cookie depois de acertar a senha (troca de senha derruba os cookies antigos). */
export const teamKey = (pass: string) => crypto.createHash("sha256").update(`rc-louvor:${normPass(pass)}`).digest("hex");

/** Este aparelho já passou pela senha do grupo (a atual)? */
export async function teamOk(): Promise<boolean> {
  const c = (await cookies()).get(TEAM_COOKIE)?.value;
  return !!c && c === teamKey(await teamPassword());
}
