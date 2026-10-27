import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { escalaSql, seeAll } from "@/lib/escala-status";
import { MESES, monthGrid, shiftMonth, today } from "@/lib/format";
import { serviceType } from "@/lib/roles";
import AvailCalendar, { type AvailItem } from "./AvailCalendar";

export const dynamic = "force-dynamic";

/** Cada pessoa vê e marca só a própria disponibilidade (o acompanhamento da liderança fica em Relatórios). */
export default async function Disponibilidade({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const me = await pageUser();
  const sp = await searchParams;
  const t = today();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : t.slice(0, 7);
  const [y, m] = month.split("-").map(Number);

  const services = await all<{ id: number; date: string; title: string; available: number | null; roles: string | null }>(
    `SELECT s.id, s.date, s.title,
       (SELECT available FROM availability a WHERE a.member_id=? AND a.service_id=s.id) AS available,
       (SELECT GROUP_CONCAT(sm.role, ', ') FROM service_members sm WHERE sm.member_id=? AND sm.service_id=s.id AND ${escalaSql("s.date")}) AS roles
     FROM services s WHERE s.date LIKE ? ORDER BY s.date, s.id`,
    [me.id, me.id, seeAll(me), `${month}-%`],
  );
  const items: AvailItem[] = services.map((s) => ({
    id: Number(s.id),
    date: s.date,
    title: s.title,
    kind: serviceType(s.title)[0],
    state: s.available === null ? null : (Number(s.available) as 0 | 1),
    roles: s.roles ?? "",
    past: s.date < t,
  }));

  return (
    <>
      <div className="esc-top">
        <div className="month">
          <Link className="btn icon" href={`/disponibilidade?m=${shiftMonth(month, -1)}`} aria-label="Mês anterior">‹</Link>
          <h2>{MESES[m - 1]} {y}</h2>
          <Link className="btn icon" href={`/disponibilidade?m=${shiftMonth(month, 1)}`} aria-label="Próximo mês">›</Link>
        </div>
      </div>
      <AvailCalendar memberId={me.id} name={me.name} month={month} mes={MESES[m - 1]} today={t} days={monthGrid(month)} items={items} />
    </>
  );
}
