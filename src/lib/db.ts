import { createClient, type Client, type InValue } from "@libsql/client";
import crypto from "node:crypto";
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
  await migrateAccess(client);
  const { rows } = await client.execute("SELECT COUNT(*) AS n FROM songs");
  if (Number(rows[0].n) === 0) await seed(client);
  return client;
}

/**
 * Níveis de acesso (liderança, ministro, banda), senha do grupo
 * e o segredo de sessão de cada pessoa (`token`, guardado no cookie depois de entrar).
 * Na primeira vez: ministro = quem já foi escalado como Ministro; liderança definida pela equipe.
 */
async function migrateAccess(client: Client) {
  const cols = await client.execute("PRAGMA table_info(members)");
  if (!cols.rows.some((r) => r.name === "access")) {
    await client.batch(
      [
        "ALTER TABLE members ADD COLUMN access TEXT NOT NULL DEFAULT 'banda'",
        "ALTER TABLE members ADD COLUMN token TEXT NOT NULL DEFAULT ''",
        "UPDATE members SET access='ministro' WHERE roles LIKE '%Ministro%' OR id IN (SELECT member_id FROM service_members WHERE role='Ministro')",
        "UPDATE members SET access='lider' WHERE name IN ('Gui Cavalcante', 'Miro', 'Marcus')",
      ],
      "write",
    );
  }
  await client.batch(
    [
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
      // senha inicial do grupo; a liderança troca na aba Equipe
      "INSERT OR IGNORE INTO settings (key, value) VALUES ('team_password', 'rasgando')",
    ],
    "write",
  );
  const empty = await client.execute("SELECT id FROM members WHERE token=''");
  if (empty.rows.length) {
    await client.batch(empty.rows.map((r) => ({ sql: "UPDATE members SET token=? WHERE id=?", args: [newToken(), r.id] })), "write");
  }
}

/** Segredo de sessão (impossível de adivinhar). */
export function newToken(): string {
  return crypto.randomBytes(24).toString("base64url");
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
export type Access = "lider" | "ministro" | "banda";
export type Member = { id: number; name: string; roles: string; phone: string; active: number; access: Access; token: string };
export type Service = { id: number; date: string; title: string; notes: string };
