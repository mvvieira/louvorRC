import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { all, type Service } from "@/lib/db";
import { MESES, shiftMonth, today } from "@/lib/format";
import { serviceType } from "@/lib/roles";

export const dynamic = "force-dynamic";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

type Item = Service & { n: number; ministros: string | null };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const inMonthOf = (d: string, month: string) => d.startsWith(month);

export default async function Calendario({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const me = await pageUser();
  const sp = await searchParams;
  const t = today();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : t.slice(0, 7);
  const [y, m] = month.split("-").map(Number);

  // grade de semanas inteiras (dom → sáb) cobrindo o mês
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const last = new Date(Date.UTC(y, m, 0));
  const end = new Date(last);
  end.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));
  const days: string[] = [];
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) days.push(iso(d));

  const items = await all<Item>(
    `SELECT s.*,
       (SELECT COUNT(*) FROM service_songs ss WHERE ss.service_id=s.id) AS n,
       (SELECT GROUP_CONCAT(mb.name, ', ') FROM service_members sm JOIN members mb ON mb.id=sm.member_id
         WHERE sm.service_id=s.id AND sm.role='Ministro') AS ministros
     FROM services s WHERE date BETWEEN ? AND ? ORDER BY date, id`,
    [days[0], days[days.length - 1]],
  );
  // funções de quem está usando o app em cada culto (para destacar os dias dele)
  const mine = new Map<number, string>();
  for (const r of await all<{ service_id: number; roles: string }>(
    `SELECT sm.service_id, GROUP_CONCAT(sm.role, ', ') AS roles FROM service_members sm JOIN services s ON s.id=sm.service_id
     WHERE sm.member_id=? AND s.date BETWEEN ? AND ? GROUP BY sm.service_id`,
    [me.id, days[0], days[days.length - 1]],
  )) mine.set(Number(r.service_id), r.roles || "Equipe");
  const myNext = await all<Item & { roles: string }>(
    `SELECT s.*, GROUP_CONCAT(sm.role, ', ') AS roles FROM service_members sm JOIN services s ON s.id=sm.service_id
     WHERE sm.member_id=? AND s.date >= ? GROUP BY s.id ORDER BY s.date, s.id LIMIT 1`,
    [me.id, t],
  );
  const myMonth = items.filter((i) => inMonthOf(i.date, month) && mine.has(Number(i.id))).length;
  const byDay = new Map<string, Item[]>();
  for (const it of items) byDay.set(it.date, [...(byDay.get(it.date) ?? []), it]);
  const tipos = [...new Map(items.filter((i) => i.date.startsWith(month)).map((i) => serviceType(i.title))).entries()];
  const inMonth = (d: string) => d.startsWith(month);
  const isMine = (d: string) => (byDay.get(d) ?? []).some((s) => mine.has(Number(s.id)));
  const isToday = (d: string) => d === t;
  const weekday = (d: string) => new Date(d + "T12:00:00Z").getUTCDay();
  const todayItems = byDay.get(t) ?? [];
  const next = items.find((i) => i.date > t) ?? (await all<Item>("SELECT *, 0 AS n, NULL AS ministros FROM services WHERE date > ? ORDER BY date, id LIMIT 1", [t]))[0];

  const chip = (s: Item) => {
    const [k] = serviceType(s.title);
    return (
      <Link key={s.id} href={`/cultos/${s.id}`} className={`ev${mine.has(Number(s.id)) ? " mine" : ""}`} style={{ "--tc": `var(--t-${k})` } as React.CSSProperties}>
        {mine.has(Number(s.id)) && <span className="ev-you">★ Você · {mine.get(Number(s.id))}</span>}
        <span className="ev-t">{s.title}</span>
        {s.ministros && <span className="ev-m">{s.ministros}</span>}
      </Link>
    );
  };

  return (
    <>
      <div className="esc-top">
        <div className="month">
          <Link className="btn icon" href={`/calendario?m=${shiftMonth(month, -1)}`} aria-label="Mês anterior">‹</Link>
          <h2>{MESES[m - 1]} {y}</h2>
          <Link className="btn icon" href={`/calendario?m=${shiftMonth(month, 1)}`} aria-label="Próximo mês">›</Link>
        </div>
        {month !== t.slice(0, 7) && <Link className="btn" href="/calendario">Voltar para hoje</Link>}
      </div>

      <div className="today-card">
        <div className="today-date">
          <span>Hoje</span>
          <b>{t.slice(8, 10)}</b>
          <span>{SEMANA_LONGA[weekday(t)]}, {MESES[Number(t.slice(5, 7)) - 1]}</span>
        </div>
        <div className="today-body">
          {todayItems.length > 0 ? (
            <><p className="muted">Cultos de hoje</p><div className="today-evs">{todayItems.map(chip)}</div></>
          ) : (
            <p className="muted">Nenhum culto hoje.</p>
          )}
          <p className="today-mine">
            <span className="you-dot">★</span>
            {myMonth
              ? <>Você está em <b>{myMonth} culto{myMonth === 1 ? "" : "s"}</b> em {MESES[m - 1]}</>
              : <>Você não está escalado em {MESES[m - 1]}</>}
            {myNext[0] && (
              <> · sua próxima: <Link href={`/cultos/${myNext[0].id}`}><b>{myNext[0].title}</b></Link>{" "}
                {SEMANA[weekday(myNext[0].date)]} {myNext[0].date.slice(8, 10)}/{myNext[0].date.slice(5, 7)} ({myNext[0].roles})</>
            )}
          </p>
          {next && (
            <p className="today-next">
              Próximo: <Link href={`/cultos/${next.id}`}><b>{next.title}</b></Link> · {SEMANA[weekday(next.date)]} {next.date.slice(8, 10)}/{next.date.slice(5, 7)}
              {next.ministros ? ` · ${next.ministros}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="legend">
        {tipos.map(([k, l]) => <span key={k}><i style={{ background: `var(--t-${k})` }} />{l}</span>)}
      </div>

      <div className="cal">
        {SEMANA.map((d) => <div key={d} className="cal-h">{d}</div>)}
        {days.map((d) => (
          <div key={d} className={`cal-d${inMonth(d) ? "" : " out"}${isToday(d) ? " today" : ""}${d < t ? " past" : ""}${isMine(d) ? " mine" : ""}`}>
            <div className="cal-n">
              <b>{Number(d.slice(8, 10))}</b>
              {isToday(d) && <span className="hoje">Hoje</span>}
            </div>
            {(byDay.get(d) ?? []).map(chip)}
          </div>
        ))}
      </div>

      <ol className="cal-list">
        {days.filter((d) => inMonth(d) && (byDay.has(d) || isToday(d))).map((d) => (
          <li key={d} className={`${isToday(d) ? "today" : ""}${d < t ? " past" : ""}${isMine(d) ? " mine" : ""}`}>
            <span className="dday"><b>{d.slice(8, 10)}</b><span>{SEMANA[weekday(d)]}</span></span>
            <div className="cal-list-evs">
              {isToday(d) && <span className="hoje">Hoje</span>}
              {(byDay.get(d) ?? []).map(chip)}
              {isToday(d) && !byDay.has(d) && <span className="muted" style={{ fontSize: 14 }}>Nenhum culto hoje</span>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
