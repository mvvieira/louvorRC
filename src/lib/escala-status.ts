import { can, type User } from "./auth";
import { all, one, run } from "./db";

/*
 * Aprovação da escala do mês: enquanto o mês não é aprovado (rascunho), só a liderança vê quem está escalado.
 * Quem aprova é o aprovador (settings.approver_id — hoje o Gui Cavalcante). Mês aprovado = linha em escala_status.
 */

export type MonthStatus = { official: boolean; by?: string; at?: string };

export async function monthStatus(month: string): Promise<MonthStatus> {
  const r = await one<{ approved_at: string; name: string | null }>(
    "SELECT es.approved_at, m.name FROM escala_status es LEFT JOIN members m ON m.id=es.approved_by WHERE es.month=?",
    [month],
  );
  return r ? { official: true, by: r.name ?? undefined, at: r.approved_at } : { official: false };
}

/** Quem pode aprovar/reabrir a escala do mês. */
export async function isApprover(u: User | null): Promise<boolean> {
  if (!u) return false;
  const id = (await one<{ value: string }>("SELECT value FROM settings WHERE key='approver_id'"))?.value;
  return !!id && Number(id) === u.id;
}

export async function approverName(): Promise<string> {
  return (await one<{ name: string }>("SELECT m.name FROM settings s JOIN members m ON m.id=CAST(s.value AS INTEGER) WHERE s.key='approver_id'"))?.name ?? "o aprovador";
}

/** Liderança vê sempre; os demais só a escala de meses aprovados. */
export async function seesEscala(u: User | null, month: string): Promise<boolean> {
  return can(u, "lider") || (await monthStatus(month)).official;
}

/**
 * Trecho de SQL para filtrar escalas visíveis: use `${escalaSql("s.date")}` num WHERE/AND,
 * passando `seeAll` (1 para liderança) como parâmetro na posição do "?".
 */
export const escalaSql = (dateCol: string) => `(? = 1 OR substr(${dateCol}, 1, 7) IN (SELECT month FROM escala_status))`;
export const seeAll = (u: User | null) => (can(u, "lider") ? 1 : 0);

export async function approveMonth(month: string, by: number) {
  await run("INSERT OR REPLACE INTO escala_status (month, approved_by, approved_at) VALUES (?, ?, datetime('now'))", [month, by]);
}
export async function reopenMonth(month: string) {
  await run("DELETE FROM escala_status WHERE month=?", [month]);
}
export async function officialMonths(): Promise<string[]> {
  return (await all<{ month: string }>("SELECT month FROM escala_status ORDER BY month")).map((r) => r.month);
}
