"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { driveItems, ensureFreshIndex, syncDrive } from "@/lib/drive";
import { findLinks, type Result } from "@/lib/finder";
import { one, run } from "@/lib/db";
import { syncRepertoire } from "@/lib/repertoire";

export async function searchLinks(text: string): Promise<{ results: Result[]; warning: string | null }> {
  let warning: string | null = null;
  try {
    const r = await ensureFreshIndex();
    warning = r.error ? `Não consegui atualizar com o Drive agora (${r.error}). Usei a última lista salva.` : null;
  } catch (e) {
    return { results: [], warning: `Não consegui ler as pastas do Drive: ${(e as Error).message}` };
  }
  return { results: findLinks(text, await driveItems()), warning };
}

export async function syncNow() {
  const r = await syncDrive();
  revalidatePath("/buscar");
  revalidatePath("/musicas");
  return r;
}

export type Pick = { title: string; key: string; version: string; vozes: string; cifra: string };

export async function saveAsService(date: string, title: string, picks: Pick[]) {
  const s = await run("INSERT INTO services (date, title) VALUES (?, ?)", [date, title || "Culto"]);
  const serviceId = Number(s.lastInsertRowid);
  let pos = 1;
  for (const p of picks) {
    let song =
      (p.vozes && (await one<{ id: number }>("SELECT id FROM songs WHERE vozes_url=?", [p.vozes]))) ||
      (!p.vozes && p.cifra && (await one<{ id: number }>("SELECT id FROM songs WHERE cifra_url=?", [p.cifra]))) ||
      undefined;
    if (!song) {
      const r = await run("INSERT INTO songs (title, song_key, version, vozes_url, cifra_url) VALUES (?,?,?,?,?)", [
        p.title, p.key, p.version, p.vozes, p.cifra,
      ]);
      song = { id: Number(r.lastInsertRowid) };
    } else if (p.cifra) {
      await run("UPDATE songs SET cifra_url=? WHERE id=? AND cifra_url=''", [p.cifra, song.id]);
    }
    await run("INSERT INTO service_songs (service_id, song_id, position) VALUES (?,?,?)", [serviceId, song.id, pos++]);
  }
  await syncRepertoire(serviceId);
  redirect(`/cultos/${serviceId}`);
}
