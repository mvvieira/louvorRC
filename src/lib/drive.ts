import { all, db, one, run } from "./db";
import { confidentCifra } from "./match";
import { normalize, parseDriveName } from "./text";

// Pastas do RC Louvor (somente leitura). São públicas por link, então a listagem
// funciona sem login via a visualização incorporada do Drive.
export const PASTA_VOZES = process.env.PASTA_VOZES || "1p7sPisOHxKHzOFEWaLB5TItTkufl-Sev";
export const PASTA_CIFRAS = process.env.PASTA_CIFRAS || "1AfcyQvmXELFZslMNODy4eg_Rze-lPqBI";

const SYNC_MAX_AGE_H = 6;

export type DriveEntry = { id: string; name: string; url: string; isFolder: boolean };
export type DriveItem = {
  id: string;
  kind: "vozes" | "cifra";
  name: string;
  url: string;
  title: string;
  song_key: string;
  version: string;
  folder: string;
};

/** Lê a listagem pública de uma pasta do Drive. */
export async function listFolder(folderId: string): Promise<DriveEntry[]> {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}`, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0 (RC Louvor)" },
  });
  if (!res.ok) throw new Error(`Drive respondeu ${res.status} para a pasta ${folderId}`);
  return parseFolderHtml(await res.text());
}

export function parseFolderHtml(html: string): DriveEntry[] {
  const out: DriveEntry[] = [];
  const re = /id="entry-([\w-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?class="flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, id, href, rawName] = m;
    const name = decodeEntities(rawName).trim();
    const isFolder = href.includes("/folders/");
    const url = isFolder
      ? `https://drive.google.com/drive/folders/${id}`
      : `https://drive.google.com/file/d/${id}/view`;
    out.push({ id, name, url, isFolder });
  }
  return out;
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function ensureTables() {
  const c = await db();
  await c.batch(
    [
      `CREATE TABLE IF NOT EXISTS drive_items (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT NOT NULL,
        title_norm TEXT NOT NULL,
        song_key TEXT NOT NULL DEFAULT '',
        version TEXT NOT NULL DEFAULT '',
        folder TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS drive_ignored (id TEXT PRIMARY KEY)`,
    ],
    "write",
  );
}

export async function lastSync(): Promise<{ at: string | null; vozes: number; cifras: number }> {
  await ensureTables();
  const m = await one<{ v: string }>("SELECT v FROM meta WHERE k='drive_synced_at'");
  const c = await one<{ v: number; c: number }>(
    "SELECT SUM(kind='vozes') AS v, SUM(kind='cifra') AS c FROM drive_items",
  );
  return { at: m?.v ?? null, vozes: Number(c?.v ?? 0), cifras: Number(c?.c ?? 0) };
}

/** Baixa as listagens das pastas e atualiza o índice + o catálogo de músicas. */
export async function syncDrive() {
  await ensureTables();
  const items: DriveItem[] = [];

  // Vozes: cada subpasta é uma música.
  for (const e of await listFolder(PASTA_VOZES)) {
    if (!e.isFolder) continue;
    items.push({ ...toItem(e, "vozes"), folder: "LETRAS E VOZES" });
  }

  // Cifras: arquivos na raiz + arquivos das subpastas (ex.: "VIRADA 2025").
  const root = await listFolder(PASTA_CIFRAS);
  for (const e of root) {
    if (!e.isFolder) items.push({ ...toItem(e, "cifra"), folder: "CIFRAS" });
  }
  for (const sub of root.filter((e) => e.isFolder)) {
    try {
      for (const e of await listFolder(sub.id)) {
        if (!e.isFolder) items.push({ ...toItem(e, "cifra"), folder: `CIFRAS / ${sub.name}` });
      }
    } catch {
      /* subpasta privada: ignora */
    }
  }

  if (!items.length) throw new Error("Nenhum item encontrado nas pastas do Drive.");

  const c = await db();
  await c.batch(
    [
      "DELETE FROM drive_items",
      ...items.map((i) => ({
        sql: `INSERT OR REPLACE INTO drive_items (id, kind, name, url, title, title_norm, song_key, version, folder)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [i.id, i.kind, i.name, i.url, i.title, normalize(i.title), i.song_key, i.version, i.folder],
      })),
      {
        sql: "INSERT OR REPLACE INTO meta (k, v) VALUES ('drive_synced_at', ?)",
        args: [new Date().toISOString()],
      },
    ],
    "write",
  );
  await fillMissingCifras(items);
  const news = await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM drive_items d WHERE d.id NOT IN (SELECT id FROM drive_ignored)
       AND ((d.kind='vozes' AND d.url NOT IN (SELECT vozes_url FROM songs))
         OR (d.kind='cifra' AND d.url NOT IN (SELECT cifra_url FROM songs)))`,
  );
  return { vozes: items.filter((i) => i.kind === "vozes").length, cifras: items.filter((i) => i.kind === "cifra").length, news: Number(news?.n ?? 0) };
}

/** Sincroniza se nunca sincronizou ou se o índice está velho. Falha silenciosa se já houver índice. */
export async function ensureFreshIndex() {
  const s = await lastSync();
  const age = s.at ? (Date.now() - new Date(s.at).getTime()) / 36e5 : Infinity;
  if (age < SYNC_MAX_AGE_H && s.vozes + s.cifras > 0) return { synced: false, error: null as string | null };
  try {
    await syncDrive();
    return { synced: true, error: null };
  } catch (e) {
    if (s.vozes + s.cifras > 0) return { synced: false, error: (e as Error).message };
    throw e;
  }
}

function toItem(e: DriveEntry, kind: "vozes" | "cifra") {
  const p = parseDriveName(e.name);
  return { id: e.id, kind, name: e.name, url: e.url, title: p.title, song_key: p.key, version: p.version };
}

/**
 * Completa a cifra de músicas que já estão no catálogo, só quando não há dúvida (ver lib/match.ts).
 * Músicas novas não entram sozinhas: passam pela revisão em Músicas › Importar do Drive.
 */
async function fillMissingCifras(items: DriveItem[]) {
  const songs = await all<{ id: number; title: string; song_key: string; cifra_url: string }>(
    "SELECT id, title, song_key, cifra_url FROM songs WHERE cifra_url=''",
  );
  const used = new Set((await all<{ u: string }>("SELECT cifra_url AS u FROM songs WHERE cifra_url<>''")).map((r) => r.u));
  const cifras = items.filter((i) => i.kind === "cifra");
  for (const s of songs) {
    const c = confidentCifra(s.title, s.song_key, cifras);
    if (c && !used.has(c.url)) {
      await run("UPDATE songs SET cifra_url=? WHERE id=? AND cifra_url=''", [c.url, s.id]);
      used.add(c.url);
    }
  }
}

export async function driveItems(): Promise<(DriveItem & { title_norm: string })[]> {
  await ensureTables();
  return all("SELECT * FROM drive_items");
}
