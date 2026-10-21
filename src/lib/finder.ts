import type { DriveItem } from "./drive";
import { normalize, parseDriveName } from "./text";

export type Query = { line: string; title: string; key: string; version: string; note: string };

const KEY_RE = /^[A-G](#|b)?m?$/;

/** "✅ Gratidão Db (Giovanni)" → título "Gratidão", tom "Db", nota "Giovanni". */
export function parseQueryLine(line: string): Query | null {
  let s = line
    .replace(/[\u{1F000}-\u{1FFFF}☀-➿️‍]/gu, " ") // emojis
    .replace(/^\s*(\d+\s*[.)\-–]|[-•*–])\s*/, "")
    .trim();
  if (!s) return null;

  // Parênteses: tom/versão ficam, nomes de pessoas viram nota.
  const notes: string[] = [];
  s = s.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    const t = inner.trim();
    if (KEY_RE.test(t.replace(/^TOM\s*/i, "")) || /^(TOM\b|MASC|FEM)/i.test(t)) return ` ${t} `;
    if (t) notes.push(t);
    return " ";
  });
  // Separadores " - " / " — " no fim costumam trazer nomes também.
  const dash = s.match(/\s[-–—]\s(.+)$/);
  if (dash && !KEY_RE.test(dash[1].trim())) {
    notes.push(dash[1].trim());
    s = s.slice(0, dash.index);
  }

  const p = parseDriveName(s);
  if (!p.title) return null;
  return { line: line.trim(), title: p.title, key: p.key, version: p.version, note: notes.join(", ") };
}

export function titleScore(query: string, candidate: string): number {
  const q = normalize(query);
  const t = normalize(candidate);
  if (!q || !t) return 0;
  if (q === t) return 100;
  const qw = q.split(" ");
  const tw = t.split(" ");
  // título começa igual (ex.: "Sublime" x "Sublime Fhop Music")
  if (t.startsWith(q + " ") || q.startsWith(t + " ")) return 85 - Math.min(15, Math.abs(tw.length - qw.length) * 3);
  if (` ${t} `.includes(` ${q} `) || ` ${q} `.includes(` ${t} `)) return 70;
  const big = (w: string[]) => new Set(w.filter((x) => x.length > 2));
  const a = big(qw);
  const b = big(tw);
  if (!a.size || !b.size) return 0;
  let common = 0;
  a.forEach((w) => {
    if (b.has(w)) common++;
    else if ([...b].some((x) => x.startsWith(w.slice(0, 5)) && w.length > 4)) common += 0.7;
  });
  return Math.round((common / Math.max(a.size, b.size)) * 65);
}

type Rankable = { title: string; song_key: string; version: string };

/** Ordena itens (pastas do Drive ou músicas do catálogo) pelo quanto combinam com título, tom e versão. */
export function rankBy<T extends Rankable>(q: { title: string; key: string; version: string }, items: T[]): (T & { score: number })[] {
  return items
    .map((i) => {
      let score = titleScore(q.title, i.title);
      if (score < 35) return { ...i, score: 0 };
      if (q.key) {
        if (i.song_key && i.song_key.toLowerCase() === q.key.toLowerCase()) score += 12;
        else if (i.song_key) score -= 8;
      }
      if (q.version && i.version) score += i.version === q.version ? 6 : -6;
      return { ...i, score };
    })
    .filter((h) => h.score >= 35)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

/** Pastas de vozes e arquivos de cifra do Drive para uma música, melhores primeiro. */
export function linkHits(title: string, key: string, version: string, items: DriveItem[]) {
  const q = { title, key, version };
  return {
    vozes: rankBy(q, items.filter((i) => i.kind === "vozes")).slice(0, 5),
    cifras: rankBy(q, items.filter((i) => i.kind === "cifra")).slice(0, 5),
  };
}
