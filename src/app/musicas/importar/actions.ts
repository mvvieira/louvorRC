"use server";

import { revalidatePath } from "next/cache";
import { requireLevel } from "@/lib/auth";
import { one, run } from "@/lib/db";
import { syncDrive } from "@/lib/drive";

const done = () => revalidatePath("/", "layout");

/** Lê as pastas do Drive de novo (não mexe no catálogo). */
export async function readDrive(): Promise<string> {
  await requireLevel("lider");
  try {
    const r = await syncDrive();
    done();
    return `Drive lido: ${r.vozes} pastas de vozes e ${r.cifras} cifras.`;
  } catch (e) {
    return `Não consegui ler o Drive: ${(e as Error).message}`;
  }
}

type DI = { url: string; title: string; song_key: string; version: string };

/** Cria as músicas a partir das pastas de vozes escolhidas, cada uma com a cifra escolhida (ou nenhuma). */
export async function importVozes(picks: { id: string; cifra: string }[]): Promise<number> {
  await requireLevel("lider");
  let n = 0;
  for (const p of picks) {
    const v = await one<DI>("SELECT url, title, song_key, version FROM drive_items WHERE id=? AND kind='vozes'", [p.id]);
    if (!v || (await one("SELECT id FROM songs WHERE vozes_url=?", [v.url]))) continue;
    await run("INSERT INTO songs (title, song_key, version, vozes_url, cifra_url) VALUES (?,?,?,?,?)", [
      v.title, v.song_key, v.version, v.url, p.cifra,
    ]);
    n++;
  }
  done();
  return n;
}

/** Cifra solta: liga a uma música que está sem cifra, ou vira uma música nova só com a cifra. */
export async function importCifra(id: string, songId?: number) {
  await requireLevel("lider");
  const c = await one<DI>("SELECT url, title, song_key, version FROM drive_items WHERE id=? AND kind='cifra'", [id]);
  if (!c) return;
  if (songId) await run("UPDATE songs SET cifra_url=? WHERE id=? AND cifra_url=''", [c.url, songId]);
  else await run("INSERT INTO songs (title, song_key, version, cifra_url) VALUES (?,?,?,?)", [c.title, c.song_key, c.version, c.url]);
  done();
}

/** Tira itens da lista de novidades (ex.: pastas de teste, arquivos duplicados). */
export async function ignoreItems(ids: string[]) {
  await requireLevel("lider");
  for (const id of ids) await run("INSERT OR IGNORE INTO drive_ignored (id) VALUES (?)", [id]);
  done();
}

export async function restoreIgnored() {
  await requireLevel("lider");
  await run("DELETE FROM drive_ignored");
  done();
}
