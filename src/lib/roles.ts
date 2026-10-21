export const FUNCOES = ["Ministro", "Soprano", "Contralto", "Tenor", "Teclado", "Guitarra", "Violão", "Baixo", "Bateria", "VS / Playback", "Som"];

/** Funções gravadas como texto separado por vírgula. */
export function splitRoles(s: string): string[] {
  return s.split(",").map((r) => r.trim()).filter(Boolean);
}

/** Tipo do culto pelo nome, para a cor na escala do mês. */
export function serviceType(title: string): [string, string] {
  const t = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (t.includes("domingo")) return ["dom", "Culto de domingo"];
  if (t.includes("intercess")) return ["int", "Intercessão"];
  if (t.includes("quinta")) return ["qui", "Quinta que Estabelece"];
  if (t.includes("batismo")) return ["bat", "Batismo"];
  return ["esp", "Cultos especiais"];
}

export type Eligible = { id: number; roles: string[] };

/**
 * Quem pode ser escalado numa função: tem a função marcada na Equipe
 * e não marcou "indisponível" para aquele culto (`away`).
 */
export function canServe(p: Eligible, role: string, away: number[] = []): boolean {
  return p.roles.includes(role) && !away.includes(p.id);
}
