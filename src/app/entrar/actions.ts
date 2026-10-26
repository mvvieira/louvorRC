"use server";

import { cookies } from "next/headers";
import { checkPin, COOKIE, hashPin, normPass, TEAM_COOKIE, teamKey, teamOk, teamPassword, YEAR } from "@/lib/auth";
import { one, run, type Access } from "@/lib/db";

type Who = { id: number; name: string; access: Access; token: string; pin_hash: string; pin_fails: number; pin_until: string };
const LOCK_AFTER = 5, LOCK_MIN = 15;

async function setCookie(name: string, value: string) {
  (await cookies()).set(name, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: YEAR });
}

async function who(id: number): Promise<Who | undefined> {
  if (!(await teamOk())) return undefined;
  return one<Who>("SELECT id, name, access, token, pin_hash, pin_fails, pin_until FROM members WHERE id=? AND active=1", [id]);
}

/** Passo 1: senha do grupo. */
export async function enterTeam(pass: string): Promise<boolean> {
  const real = await teamPassword();
  if (!real || normPass(pass) !== normPass(real)) return false;
  await setCookie(TEAM_COOKIE, teamKey(real));
  return true;
}

/** Passo 2: tocou no nome. Banda entra direto; ministro e liderança vão para o PIN. */
export async function pickMember(id: number): Promise<{ done: true } | { pin: "create" | "enter"; name: string } | { error: string }> {
  const m = await who(id);
  if (!m) return { error: "Digite a senha do grupo de novo." };
  if (m.access === "banda") {
    await setCookie(COOKIE, m.token);
    return { done: true };
  }
  return { pin: m.pin_hash ? "enter" : "create", name: m.name };
}

/** Passo 3: PIN de 4 dígitos (cria na primeira vez; bloqueia 15 min depois de 5 erros). */
export async function enterPin(id: number, pin: string): Promise<{ done: true } | { error: string }> {
  const m = await who(id);
  if (!m) return { error: "Digite a senha do grupo de novo." };
  if (m.access === "banda") return { error: "Toque no seu nome de novo." };
  if (!/^\d{4}$/.test(pin)) return { error: "O PIN tem 4 números." };
  if (m.pin_until && m.pin_until > new Date().toISOString()) {
    return { error: `Muitas tentativas. Espere alguns minutos ou peça à liderança para zerar seu PIN.` };
  }
  if (!m.pin_hash) {
    await run("UPDATE members SET pin_hash=?, pin_fails=0, pin_until='' WHERE id=?", [hashPin(pin), m.id]);
  } else if (!checkPin(pin, m.pin_hash)) {
    const fails = Number(m.pin_fails) + 1;
    const lock = fails >= LOCK_AFTER;
    await run("UPDATE members SET pin_fails=?, pin_until=? WHERE id=?", [
      lock ? 0 : fails, lock ? new Date(Date.now() + LOCK_MIN * 60000).toISOString() : "", m.id,
    ]);
    return { error: lock ? `PIN errado ${LOCK_AFTER} vezes: espere ${LOCK_MIN} minutos.` : `PIN errado. Restam ${LOCK_AFTER - fails} tentativa${LOCK_AFTER - fails === 1 ? "" : "s"}.` };
  } else {
    await run("UPDATE members SET pin_fails=0, pin_until='' WHERE id=?", [m.id]);
  }
  await setCookie(COOKIE, m.token);
  return { done: true };
}
