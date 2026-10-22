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

/** Modelo de cada culto: a quantidade mais comum de cada função nas últimas escalas com o mesmo nome (ou do mesmo tipo). */
export function learnTemplate(titles: string[], history: (DService & { roles: string[] })[]): Template {
  const out: Template = {};
  for (const title of titles) {
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
 * Preenche as vagas que faltam (modelo − quem já está escalado) culto a culto, em ordem de data.
 * Nunca usa quem marcou "não posso"; quem não respondeu só entra com `useNoAnswer` e fica marcado.
 * Escolhe quem tem menos escalas no mês, evitando o mesmo dia e dias seguidos.
 */
export function distribute({ services, people, existing, avail, template, seed, useNoAnswer }: {
  services: DService[]; people: DPerson[]; existing: DSlot[]; avail: Avail;
  template: Template; seed: number; useNoAnswer: boolean;
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
  for (const s of [...services].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)) {
    const busy = new Set(existing.filter((e) => e.service_id === s.id).map((e) => e.member_id));
    const ok = (p: DPerson) => {
      const a = avail[`${p.id}:${s.id}`];
      return a === 1 || (a === undefined && useNoAnswer);
    };
    const need = Object.entries(template[s.title] ?? {})
      .map(([role, n]) => ({ role, n: n - existing.filter((e) => e.service_id === s.id && (e.role || "Equipe") === role).length }))
      .filter((x) => x.n > 0)
      // função com menos gente disponível escolhe primeiro
      .map((x) => ({ ...x, pool: people.filter((p) => p.roles.includes(x.role) && ok(p)).length }))
      .sort((a, b) => a.pool - b.pool || FUNCOES.indexOf(a.role) - FUNCOES.indexOf(b.role));

    for (const { role, n } of need) {
      for (let k = 0; k < n; k++) {
        const cands = people.filter((p) => p.roles.includes(role) && !busy.has(p.id) && ok(p));
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
            + rnd(seed, p.id, s.id) * 4;
        };
        const best = cands.reduce((a, b) => (cost(b) < cost(a) ? b : a));
        busy.add(best.id);
        serve(best.id, s.date);
        picks.push({ service_id: s.id, member_id: best.id, role, maybe: avail[`${best.id}:${s.id}`] !== 1 });
      }
    }
  }
  return { picks, gaps, load };
}
