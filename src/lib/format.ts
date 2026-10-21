export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = dt.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return `${wd} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "dom", "seg"… para uma data ISO (AAAA-MM-DD). */
export function dayName(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "20/10" para uma data ISO. */
export function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

/** Data de hoje (AAAA-MM-DD) no horário de Brasília, igual no servidor (Vercel, em UTC) e no navegador. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Soma `d` meses a "AAAA-MM". */
export function shiftMonth(month: string, d: number): string {
  let [y, m] = month.split("-").map(Number);
  m += d;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Dias (AAAA-MM-DD) das semanas inteiras, de domingo a sábado, que cobrem o mês "AAAA-MM". */
export function monthGrid(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const d = new Date(first);
  d.setUTCDate(1 - first.getUTCDay());
  const last = new Date(Date.UTC(y, m, 0));
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));
  const out: string[] = [];
  for (; d <= end; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}
