import { FUNCOES, serviceType } from "./roles";

/* Distribuição automática da escala do mês a partir da disponibilidade (sem acesso ao banco: roda no navegador). */

export type DService = { id: number; date: string; title: string };
export type DPerson = { id: number; name: string; roles: string[] };
export type DSlot = { service_id: number; member_id: number; role: string };
/** Quantas pessoas cada função leva, por nome do culto. */
export type Template = Record<string, Record<string, number>>;
/** "membro:culto" → 1 posso / 0 não posso (sem chave = sem resposta). */
export type Avail = Record<string, 0 | 1>;

export type DPick = DSlot & { maybe: boolean };
export type Gap = { service_id: number; role: string; missing: number };

/** Vaga coringa: qualquer um destes instrumentos serve (Intercessão = ministro + um instrumento). */
export const INSTRUMENTO = "Instrumento";
export const INSTRUMENTOS = ["Teclado", "Violão", "Guitarra"];

/** Vagas de ministro por voz: nas vozes do Domingo e da Quinta vão um ministro e uma ministra. */
export const MINISTRO_H = "Ministro (homem)";
export const MINISTRA = "Ministra (mulher)";
const POR_VOZ: Record<string, "h" | "m"> = { [MINISTRO_H]: "h", [MINISTRA]: "m" };

/** Todas as vagas que um modelo pode ter, na ordem de exibição. */
export const VAGAS = [MINISTRO_H, MINISTRA, ...FUNCOES, INSTRUMENTO];

/** Domingo e Quinta: banda completa; vozes = 3 mulheres (ministra, soprano, contralto) e 2 homens (ministro, tenor). */
const BANDA = { [MINISTRO_H]: 1, [MINISTRA]: 1, Soprano: 1, Contralto: 1, Tenor: 1, Teclado: 1, Guitarra: 1, Violão: 1, Baixo: 1, Bateria: 1 };
const FIXOS: Record<string, Record<string, number>> = { dom: BANDA, qui: BANDA, int: { Ministro: 1, [INSTRUMENTO]: 1 } };

/** Homem ou mulher pelo naipe: Tenor = homem; Soprano/Contralto = mulher (sem naipe: não se sabe). */
export const voz = (roles: string[]): "h" | "m" | "" =>
  roles.includes("Tenor") ? "h" : roles.some((r) => r === "Soprano" || r === "Contralto") ? "m" : "";

/** Função gravada na escala para uma vaga do modelo ("Ministra (mulher)" → "Ministro"). */
const base = (role: string) => (POR_VOZ[role] ? "Ministro" : role);

/** A vaga do modelo é preenchida por quem está gravado com esta função na escala. */
export const covers = (slot: string, role: string) =>
  slot === role || base(slot) === role || (slot === INSTRUMENTO && INSTRUMENTOS.includes(role));

/** A pessoa faz a função (a vaga "Instrumento" aceita qualquer um dos INSTRUMENTOS; ministro/ministra olha a voz). */
export const plays = (p: DPerson, role: string) => {
  if (role === INSTRUMENTO) return p.roles.some((r) => INSTRUMENTOS.includes(r));
  if (POR_VOZ[role]) { const v = voz(p.roles); return p.roles.includes("Ministro") && (!v || v === POR_VOZ[role]); }
  return p.roles.includes(role);
};

/**
 * Vagas de um culto que não fecham com quem pode (e, com `useNoAnswer`, também quem não respondeu),
 * por função. Cada pessoa ocupa uma só vaga no culto, então quem faz duas funções conta uma vez.
 */
export function shortfall(s: DService, people: DPerson[], avail: Avail, template: Template, useNoAnswer: boolean): Record<string, number> {
  const ok = (p: DPerson) => {
    const a = avail[`${p.id}:${s.id}`];
    return a === 1 || (a === undefined && useNoAnswer);
  };
  const slots = Object.entries(template[s.title] ?? {}).flatMap(([role, n]) => Array<string>(n).fill(role));
  const cands = slots.map((role) => people.filter((p) => plays(p, role) && ok(p)).map((p) => p.id));
  // emparelhamento máximo vaga ↔ pessoa (caminhos aumentantes), funções mais difíceis primeiro
  const owner = new Map<number, number>();
  const seat = (i: number, seen: Set<number>): boolean => {
    for (const m of cands[i]) {
      if (seen.has(m)) continue;
      seen.add(m);
      const j = owner.get(m);
      if (j === undefined || seat(j, seen)) { owner.set(m, i); return true; }
    }
    return false;
  };
  const out: Record<string, number> = {};
  for (const i of slots.map((_, i) => i).sort((a, b) => cands[a].length - cands[b].length))
    if (!seat(i, new Set())) out[slots[i]] = (out[slots[i]] ?? 0) + 1;
  return out;
}

/**
 * Modelo de cada culto: fixo para Domingo, Quinta e Intercessão; para os demais,
 * a quantidade mais comum de cada função nas últimas escalas com o mesmo nome (ou do mesmo tipo).
 */
export function buildTemplate(titles: string[], history: (DService & { roles: string[] })[]): Template {
  const out: Template = {};
  for (const title of titles) {
    const fixo = FIXOS[serviceType(title)[0]];
    if (fixo) { out[title] = { ...fixo }; continue; }
    let past = history.filter((h) => h.title === title);
    if (!past.length) past = history.filter((h) => serviceType(h.title)[0] === serviceType(title)[0]);
    past = past.slice(-6);
    const t: Record<string, number> = {};
    for (const role of new Set(past.flatMap((h) => h.roles))) {
      const counts = past.map((h) => h.roles.filter((r) => r === role).length);
      const freq = new Map<number, number>();
      for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
      // a mais comum; no empate, a mais recente
      const best = Math.max(...freq.values());
      const mode = [...counts].reverse().find((c) => freq.get(c) === best) ?? 0;
      if (mode > 0) t[role] = mode;
    }
    out[title] = t;
  }
  return out;
}

/** Número pseudoaleatório estável para o mesmo sorteio. */
function rnd(...xs: number[]): number {
  let h = 2166136261;
  for (const x of xs) h = Math.imul(h ^ x, 16777619);
  h ^= h >>> 13; h = Math.imul(h, 2654435761); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const dayDiff = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

/**
 * Preenche, culto a culto em ordem de data, os cultos que ainda não têm ninguém na escala.
 * Cultos com escala já lançada (`existing`) não são mexidos, mas contam para dividir por igual.
 * `targets` limita os cultos a preencher (os demais só contam); com `complete`, um culto já
 * começado tem só as vagas que faltam completadas, sem trocar quem já está.
 * Nunca usa quem marcou "não posso"; quem não respondeu só entra com `useNoAnswer` e fica marcado.
 * Escolhe quem tem menos escalas no mês, evitando o mesmo dia e dias seguidos.
 * Com `favorScarce`, no empate de escalas vem primeiro quem marcou "posso" em poucos cultos,
 * para quem tem pouca disponibilidade também conseguir servir (quem pode sempre cobre o resto).
 */
export function distribute({ services, people, existing, avail, template, seed, useNoAnswer, targets, complete, favorScarce = true }: {
  services: DService[]; people: DPerson[]; existing: DSlot[]; avail: Avail;
  template: Template; seed: number; useNoAnswer: boolean; targets?: number[]; complete?: boolean; favorScarce?: boolean;
}): { picks: DPick[]; gaps: Gap[]; load: Map<number, number> } {
  const load = new Map<number, number>();
  const dates = new Map<number, string[]>();
  const date = new Map(services.map((s) => [s.id, s.date]));
  const serve = (m: number, d: string) => {
    load.set(m, (load.get(m) ?? 0) + 1);
    dates.set(m, [...(dates.get(m) ?? []), d]);
  };
  for (const e of existing) { const d = date.get(e.service_id); if (d) serve(e.member_id, d); }

  const picks: DPick[] = [];
  const gaps: Gap[] = [];
  const ready = new Set(existing.map((e) => e.service_id));
  // chances reais de cada um: cultos ainda a preencher em que marcou "posso" e que levam uma função dele
  // (sem nenhuma chance conta como muito disponível)
  const open = services.filter((s) => (!targets || targets.includes(s.id)) && (!ready.has(s.id) || complete));
  const free = new Map(people.map((p) => [p.id,
    open.filter((s) => avail[`${p.id}:${s.id}`] === 1 && Object.keys(template[s.title] ?? {}).some((r) => plays(p, r))).length || 99]));
  for (const s of [...services].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)) {
    if (targets && !targets.includes(s.id)) continue;
    if (ready.has(s.id) && !complete) continue;
    const here = existing.filter((e) => e.service_id === s.id);
    const busy = new Set(here.map((e) => e.member_id));
    const ok = (p: DPerson) => {
      const a = avail[`${p.id}:${s.id}`];
      return a === 1 || (a === undefined && useNoAnswer);
    };
    const tpl = template[s.title] ?? {};
    const who = new Map(people.map((p) => [p.id, p]));
    const ministros = here.filter((e) => e.role === "Ministro").length;
    const vagasMin = Object.entries(tpl).filter(([r]) => POR_VOZ[r]).reduce((a, [, n]) => a + n, 0);
    const need = Object.entries(tpl)
      .map(([role, n]) => {
        const has = here.filter((e) => covers(role, e.role) && (!POR_VOZ[role] || plays(who.get(e.member_id) ?? { id: 0, name: "", roles: [] }, role))).length;
        // ministro/ministra: nunca passa do total de ministros do modelo, mesmo se os já escalados forem da mesma voz
        return { role, n: POR_VOZ[role] ? Math.min(n - has, vagasMin - ministros) : n - has };
      })
      .filter((x) => x.n > 0)
      // função com menos gente disponível escolhe primeiro
      .map((x) => ({ ...x, pool: people.filter((p) => plays(p, x.role) && ok(p)).length }))
      .sort((a, b) => a.pool - b.pool || FUNCOES.indexOf(a.role) - FUNCOES.indexOf(b.role));

    for (const { role, n } of need) {
      for (let k = 0; k < n; k++) {
        const cands = people.filter((p) => plays(p, role) && !busy.has(p.id) && ok(p));
        if (!cands.length) {
          const g = gaps.find((x) => x.service_id === s.id && x.role === role);
          if (g) g.missing++; else gaps.push({ service_id: s.id, role, missing: 1 });
          continue;
        }
        const cost = (p: DPerson) => {
          const ds = dates.get(p.id) ?? [];
          return (avail[`${p.id}:${s.id}`] === 1 ? 0 : 100)
            + (load.get(p.id) ?? 0) * 10
            + (ds.includes(s.date) ? 40 : 0)
            + (ds.some((d) => d !== s.date && dayDiff(d, s.date) <= 2) ? 6 : 0)
            // pouca disponibilidade passa na frente, mas nunca vale mais que uma escala a menos (10)
            + (favorScarce ? Math.min(free.get(p.id)!, 7) * 1.4 : 0)
            + rnd(seed, p.id, s.id) * 4;
        };
        const best = cands.reduce((a, b) => (cost(b) < cost(a) ? b : a));
        busy.add(best.id);
        serve(best.id, s.date);
        const as = role === INSTRUMENTO ? INSTRUMENTOS.find((r) => best.roles.includes(r))! : base(role);
        picks.push({ service_id: s.id, member_id: best.id, role: as, maybe: avail[`${best.id}:${s.id}`] !== 1 });
      }
    }
  }
  return { picks, gaps, load };
}
