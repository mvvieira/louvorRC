const KEY_RE = /^[A-G](#|b)?m?$/;

/** Remove acentos, pontuação e espaços extras, em maiúsculas. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Extrai título, tom e versão (MASCULINO/FEMININO) de um nome de pasta/arquivo do Drive. */
export function parseDriveName(raw: string): { title: string; key: string; version: string } {
  let s = raw
    .replace(/\.pdf(\.pdf)?\s*$/i, "")
    .replace(/\s+pdf\s*$/i, "")
    .replace(/-?convertido/gi, " ")
    .replace(/\(\s*\d+\s*\)/g, " ")
    .replace(/\b(TOM|CIFRA)\b/gi, " ")
    .replace(/(^|\s)-(\s|$)/g, " ");
  let version = "";
  const v = s.match(/\b(MASCULINO|FEMININO|FEMINIMO|MASC|FEM)\b/i);
  if (v) {
    version = v[1].toUpperCase().startsWith("M") ? "MASCULINO" : "FEMININO";
    s = s.replace(v[0], " ");
  }
  const tokens = s.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
  let key = "";
  // "A" e "E" são ambíguos (artigo/conjunção x tom): só contam como tom no fim do nome.
  // Para os demais, vale o último tom que aparecer.
  const kept = [...tokens];
  for (let i = kept.length - 1; i >= 0; i--) {
    const t = kept[i];
    if (!KEY_RE.test(t)) continue;
    if (i === 0) break; // título nunca começa pelo tom
    const ambiguous = t === "A" || t === "E" || t === "Em";
    if (ambiguous && i !== kept.length - 1) continue;
    key = t;
    kept.splice(i, 1);
    break;
  }
  // tom entre parênteses no original, ex.: "(A)"
  if (!key) {
    const p = raw.match(/\(\s*([A-G](#|b)?m?)\s*\)/);
    if (p) {
      key = p[1];
      const i = kept.indexOf(p[1]);
      if (i >= 0) kept.splice(i, 1);
    }
  }
  const title = kept.join(" ").replace(/\s+/g, " ").trim();
  return { title: titleCase(title), key, version };
}

const LOWER = new Set(["a", "o", "e", "de", "do", "da", "dos", "das", "em", "no", "na", "que", "meu", "ao"]);
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && LOWER.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Pontua o quanto `query` combina com `title` (0 = nada). */
export function matchScore(query: string, title: string): number {
  const q = normalize(query);
  const t = normalize(title);
  if (!q || !t) return 0;
  if (q === t) return 100;
  if (t.startsWith(q) || q.startsWith(t)) return 80;
  if (t.includes(q) || q.includes(t)) return 60;
  const qw = new Set(q.split(" ").filter((w) => w.length > 2));
  const tw = new Set(t.split(" ").filter((w) => w.length > 2));
  if (!qw.size || !tw.size) return 0;
  let common = 0;
  qw.forEach((w) => tw.has(w) && common++);
  return Math.round((common / Math.max(qw.size, tw.size)) * 50);
}
