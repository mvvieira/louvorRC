"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { logEntry } from "@/lib/access";
import { checkSecret, COOKIE, normPass, TEAM_COOKIE, teamKey, teamOk, teamPassword, YEAR } from "@/lib/auth";
import { one, run } from "@/lib/db";

type Who = { id: number; name: string; token: string; pin_hash: string; pin_fails: number; pin_until: string };
const LOCK_AFTER = 5, LOCK_MIN = 15;

async function setCookie(name: string, value: string) {
  (await cookies()).set(name, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: YEAR });
}

/** Registra a entrada no log de acesso (depois de responder). */
async function logged(id: number) {
  const ua = (await headers()).get("user-agent") ?? "";
  after(() => logEntry(id, ua).catch(() => {}));
}

async function who(id: number): Promise<Who | undefined> {
  if (!(await teamOk())) return undefined;
  return one<Who>("SELECT id, name, token, pin_hash, pin_fails, pin_until FROM members WHERE id=? AND active=1", [id]);
}

/** Passo 1: senha do grupo. */
export async function enterTeam(pass: string): Promise<boolean> {
  const real = await teamPassword();
  if (!real || normPass(pass) !== normPass(real)) return false;
  await setCookie(TEAM_COOKIE, teamKey(real));
  return true;
}

/** Passo 2: tocou no próprio nome. Entra direto, a não ser que a pessoa tenha senha pessoal (o administrador). */
export async function pickMember(id: number): Promise<"in" | "password" | "again"> {
  const m = await who(id);
  if (!m) return "again";
  if (m.pin_hash) return "password";
  await setCookie(COOKIE, m.token);
  await logged(m.id);
  return "in";
}

/** Passo 3 (só quem tem senha pessoal): confere, com bloqueio de 15 min depois de 5 erros. */
export async function enterPassword(id: number, pass: string): Promise<{ ok: true } | { error: string }> {
  const m = await who(id);
  if (!m?.pin_hash) return { error: "Toque no seu nome de novo." };
  if (m.pin_until && m.pin_until > new Date().toISOString()) return { error: `Muitas tentativas. Espere ${LOCK_MIN} minutos.` };
  if (!checkSecret(pass, m.pin_hash)) {
    const fails = Number(m.pin_fails) + 1;
    const lock = fails >= LOCK_AFTER;
    await run("UPDATE members SET pin_fails=?, pin_until=? WHERE id=?", [
      lock ? 0 : fails, lock ? new Date(Date.now() + LOCK_MIN * 60000).toISOString() : "", m.id,
    ]);
    return { error: lock ? `Senha errada ${LOCK_AFTER} vezes: espere ${LOCK_MIN} minutos.` : `Senha errada. Restam ${LOCK_AFTER - fails} tentativa${LOCK_AFTER - fails === 1 ? "" : "s"}.` };
  }
  await run("UPDATE members SET pin_fails=0, pin_until='' WHERE id=?", [m.id]);
  await setCookie(COOKIE, m.token);
  await logged(m.id);
  return { ok: true };
}
