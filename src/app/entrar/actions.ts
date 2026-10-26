"use server";

import { cookies } from "next/headers";
import { COOKIE, normPass, TEAM_COOKIE, teamKey, teamOk, teamPassword, YEAR } from "@/lib/auth";
import { one } from "@/lib/db";

async function setCookie(name: string, value: string) {
  (await cookies()).set(name, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: YEAR });
}

/** Passo 1: senha do grupo. */
export async function enterTeam(pass: string): Promise<boolean> {
  const real = await teamPassword();
  if (!real || normPass(pass) !== normPass(real)) return false;
  await setCookie(TEAM_COOKIE, teamKey(real));
  return true;
}

/** Passo 2: tocou no próprio nome e entra (o nível vem da pessoa na Equipe). */
export async function pickMember(id: number): Promise<boolean> {
  if (!(await teamOk())) return false;
  const m = await one<{ token: string }>("SELECT token FROM members WHERE id=? AND active=1", [id]);
  if (!m) return false;
  await setCookie(COOKIE, m.token);
  return true;
}
