import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { logPage } from "./access";
import { cache } from "react";
import { one, type Access } from "./db";

/*
 * Entrada: a pessoa toca no próprio nome e digita a própria senha.
 * Depois disso o cookie rc_acesso guarda o segredo de sessão da pessoa; o nível vem da pessoa na Equipe.
 */

export const COOKIE = "rc_acesso";
export const YEAR = 60 * 60 * 24 * 365;
export type User = { id: number; name: string; access: Access; roles: string };

const RANK: Record<Access, number> = { banda: 1, ministro: 2, lider: 3 };

/** Quem está usando o app (uma consulta por requisição). */
export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const u = await one<User>("SELECT id, name, access, roles FROM members WHERE token=? AND token<>'' AND active=1", [token]);
  return u ? { id: Number(u.id), name: u.name, access: u.access, roles: u.roles ?? "" } : null;
});

/** O usuário tem pelo menos este nível? */
export const can = (u: User | null, level: Access) => !!u && RANK[u.access] >= RANK[level];

/** Para server actions: barra quem não tem o nível (a tela esconde, mas a regra vale aqui). */
export async function requireLevel(level: Access): Promise<User> {
  const u = await currentUser();
  if (!can(u, level)) throw new Error("Sem permissão para esta ação.");
  return u!;
}

/** Só a própria pessoa mexe na disponibilidade dela. */
export async function requireSelf(memberId: number): Promise<User> {
  const u = await currentUser();
  if (!u || u.id !== memberId) throw new Error("Sem permissão para esta ação.");
  return u;
}

/** Para páginas: exige alguém conectado (senão, tela de entrada); com `level`, volta ao calendário quem não tem o nível. */
export async function pageUser(level: Access = "banda", log = true): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/entrar");
  if (!can(u, level)) redirect("/calendario");
  const h = await headers();
  const path = h.get("x-path") ?? "", ua = h.get("user-agent") ?? "";
  // grava depois de entregar a página (não deixa o app mais lento; erro no log não derruba a página)
  if (log && path) after(() => logPage(u.id, path, ua).catch(() => {}));
  return u;
}

/* ---------- Senha individual (members.pin_hash); a inicial obriga a criar outra no 1º acesso ---------- */

export const INITIAL_PASSWORD = "123mudar";

/** Regras de uma senha nova. */
export function badPassword(p: string): string | null {
  if (p.length < 4) return "A senha precisa ter pelo menos 4 caracteres.";
  if (p === INITIAL_PASSWORD) return "Escolha uma senha diferente da inicial.";
  return null;
}

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(secret, salt, 32).toString("hex")}`;
}

export function checkSecret(secret: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), crypto.scryptSync(secret, salt, 32));
}

/** O dono do app (settings.admin_id). */
export async function isAdmin(u: User | null): Promise<boolean> {
  if (!u) return false;
  const id = (await one<{ value: string }>("SELECT value FROM settings WHERE key='admin_id'"))?.value;
  return !!id && Number(id) === u.id;
}

/** Quem vê o log de acesso (aba Acessos): o administrador e quem estiver em settings.access_viewers ("37,…"). */
export async function seesAccessLog(u: User | null): Promise<boolean> {
  if (!u) return false;
  if (await isAdmin(u)) return true;
  const ids = (await one<{ value: string }>("SELECT value FROM settings WHERE key='access_viewers'"))?.value ?? "";
  return ids.split(",").map(Number).includes(u.id);
}

