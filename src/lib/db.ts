import { createClient, type Client, type InValue } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { CIFRAS, VOZES, fileUrl, folderUrl } from "./seed-data";
import { normalize, parseDriveName } from "./text";

const url = process.env.DATABASE_URL || "file:data/louvor.db";

declare global {
  // eslint-disable-next-line no-var
  var __db: Promise<Client> | undefined;
}

async function init(): Promise<Client> {
  if (url.startsWith("file:")) {
    fs.mkdirSync(path.dirname(url.slice(5)), { recursive: true });
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        song_key TEXT NOT NULL DEFAULT '',
        version TEXT NOT NULL DEFAULT '',
        artist TEXT NOT NULL DEFAULT '',
        vozes_url TEXT NOT NULL DEFAULT '',
        cifra_url TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        roles TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'Culto',
        notes TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS service_songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS service_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS availability (
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        available INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (member_id, service_id)
      )`,
    ],
    "write",
  );
  await client.execute("PRAGMA foreign_keys = ON");
  const { rows } = await client.execute("SELECT COUNT(*) AS n FROM songs");
  if (Number(rows[0].n) === 0) await seed(client);
  return client;
}

async function seed(client: Client) {
  type S = { title: string; key: string; version: string; vozes: string; cifra: string };
  const songs: S[] = VOZES.map(([raw, id]) => ({ ...parseDriveName(raw), vozes: folderUrl(id), cifra: "" }));
  for (const [raw, id] of CIFRAS) {
    const c = parseDriveName(raw);
    const hit = songs.find((s) => normalize(s.title) === normalize(c.title) && !s.cifra);
    if (hit) hit.cifra = fileUrl(id);
    else songs.push({ ...c, vozes: "", cifra: fileUrl(id) });
  }
  await client.batch(
    songs.map((s) => ({
      sql: "INSERT INTO songs (title, song_key, version, vozes_url, cifra_url) VALUES (?, ?, ?, ?, ?)",
      args: [s.title, s.key, s.version, s.vozes, s.cifra],
    })),
    "write",
  );
}

export function db(): Promise<Client> {
  if (!globalThis.__db) globalThis.__db = init();
  return globalThis.__db;
}

export async function all<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const c = await db();
  const r = await c.execute({ sql, args });
  return r.rows.map((row) => ({ ...row }) as T);
}

export async function one<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: InValue[] = []) {
  const c = await db();
  return c.execute({ sql, args });
}

export type Song = {
  id: number;
  title: string;
  song_key: string;
  version: string;
  artist: string;
  vozes_url: string;
  cifra_url: string;
  notes: string;
};
export type Member = { id: number; name: string; roles: string; phone: string; active: number };
export type Service = { id: number; date: string; title: string; notes: string };
