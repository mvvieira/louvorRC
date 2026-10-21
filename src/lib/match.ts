// Comparação tolerante de nomes de músicas (acentos, erros de digitação, artista no nome do arquivo).
// Sem imports para poder ser testado direto com `node`.

const NOISE = new Set([
  "MEDLEY", "TOM", "FEMININO", "FEMNINO", "FMININO", "MASCULINO", "MASC", "FEM", "VERSAO", "VS", "PDF", "CIFRA",
  "E", "DE", "DO", "DA", "DOS", "DAS", "O", "A", "OS", "AS", "EM", "NO", "NA", "AO", "UM", "UMA",
]);
const KEY = /^[A-G](#|B)?M?$/;

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9#]+/g, " ")
    .replace(/(\d)([A-Z])/g, "$1 $2")
    .replace(/([A-Z])(\d)/g, "$1 $2")
    .trim();
}

/** Palavras que identificam a música (sem tom, versão, artigos). */
export function words(s: string): string[] {
  return norm(s).split(" ").filter((t) => t && !NOISE.has(t) && !KEY.test(t));
}

/** Todos os tons citados no nome, ex.: "AGNUS DEI C e A.pdf" → ["C", "A"]. */
export function keysIn(name: string): string[] {
  const raw = name.replace(/\.pdf$/i, "").replace(/[()]/g, " ").replace(/\bTOM\b\s*-?/gi, " ").split(/\s+/);
  const out: string[] = [];
  raw.forEach((t, i) => {
    // "A" e "E" sozinhos só contam como tom no fim do nome ou depois de outro tom / "e"
    if (!/^[A-G](#|b)?m?$/.test(t)) return;
    if ((t === "A" || t === "E") && i < raw.length - 1 && !/^[A-G](#|b)?m?$/.test(raw[i + 1] ?? "")) {
      const prev = raw[i - 1] ?? "";
      if (!/^[A-G](#|b)?m?$/.test(prev) && prev.toLowerCase() !== "e") return;
    }
    out.push(t);
  });
  return [...new Set(out.map((k) => k.charAt(0).toUpperCase() + k.slice(1)))];
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

function ratio(a: string, b: string): number {
  if (!a && !b) return 1;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
}

/** Semelhança entre duas palavras (0–1), tolerando um erro de digitação. */
function wordSim(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.9;
  return ratio(a, b);
}

/** Quanto `a` está contido em `b`, palavra a palavra, sem reaproveitar palavra. */
function cover(a: string[], b: string[]): number {
  const free = [...b];
  let sum = 0;
  for (const w of a) {
    let best = 0, at = -1;
    free.forEach((x, i) => { const s = wordSim(w, x); if (s > best) [best, at] = [s, i]; });
    if (best >= 0.75 && at >= 0) { sum += best; free.splice(at, 1); }
  }
  return a.length ? sum / a.length : 0;
}

/**
 * Nota de 0 a 100 para "o título `q` é a música `c`?".
 * Todas as palavras de `q` precisam aparecer em `c`; palavras sobrando em `c` (artista, "10 anos") pesam pouco.
 */
export function songScore(q: string, c: string): number {
  const a = words(q), b = words(c);
  if (!a.length || !b.length) return 0;
  const there = cover(a, b);
  if (there < 0.8) return 0;
  const back = cover(b, a);
  const seq = ratio(a.join(" "), b.join(" "));
  return Math.round(there * 70 + back * 15 + seq * 15);
}

/**
 * Para o autocompletar: aceita palavras pela metade ("subl") e erro de digitação ("impossivl").
 * Devolve 0 quando não combina.
 */
export function searchScore(query: string, title: string, extra = ""): number {
  const q = norm(query).split(" ").filter(Boolean);
  if (!q.length) return 0;
  const t = norm(title).split(" ").filter(Boolean);
  const x = norm(extra).split(" ").filter(Boolean);
  const all = [...t, ...x];
  let score = 0;
  for (const w of q) {
    let best = 0;
    for (const [i, tw] of all.entries()) {
      const inTitle = i < t.length ? 1 : 0.7;
      let s = 0;
      if (tw === w) s = 1;
      else if (tw.startsWith(w)) s = 0.9;
      else if (w.length >= 4 && ratio(w, tw.slice(0, Math.max(w.length, tw.length))) >= 0.75) s = 0.7;
      else if (w.length >= 4 && ratio(w, tw) >= 0.75) s = 0.7;
      best = Math.max(best, s * inTitle);
    }
    if (!best) return 0;
    score += best;
  }
  const starts = norm(title).startsWith(norm(query)) ? 0.5 : 0;
  return Math.round(((score / q.length) + starts) * 60);
}

export type CifraCandidate = { url: string; name: string; title: string };
export type CifraHit = CifraCandidate & { score: number; keys: string[]; keyOk: boolean | null };

/** Arquivos de cifra parecidos com a música, melhores primeiro. `keyOk` = o tom da música aparece no arquivo. */
export function cifraHits(title: string, key: string, cifras: CifraCandidate[]): CifraHit[] {
  return cifras
    .map((c) => {
      const keys = keysIn(c.name);
      const keyOk = key && keys.length ? keys.some((k) => k.toLowerCase() === key.toLowerCase()) : null;
      let score = Math.max(songScore(title, c.title), songScore(title, c.name.replace(/\.pdf$/i, "")));
      if (score && /MEDLEY/i.test(c.name) !== /MEDLEY/i.test(title)) score -= 15; // medley ≠ música avulsa
      if (score && keyOk === true) score += 8;
      if (score && keyOk === false) score -= 10;
      return { ...c, score, keys, keyOk };
    })
    .filter((h) => h.score >= 60)
    .sort((a, b) => b.score - a.score);
}

/** Só liga sozinho quando não há dúvida: nome muito parecido, tom compatível e nenhum concorrente próximo. */
export function confidentCifra(title: string, key: string, cifras: CifraCandidate[]): CifraHit | undefined {
  const [best, second] = cifraHits(title, key, cifras);
  if (!best || best.score < 88 || best.keyOk === false) return undefined;
  if (key && best.keyOk !== true && best.keys.length) return undefined;
  if (second && second.url !== best.url && best.score - second.score < 6) return undefined;
  return best;
}
