import Link from "next/link";
import { all, one, type Member } from "@/lib/db";
import { MESES, monthGrid, shiftMonth, today } from "@/lib/format";
import { serviceType, splitRoles } from "@/lib/roles";
import AvailCalendar, { type AvailItem } from "./AvailCalendar";
import PickPerson from "./PickPerson";

export const dynamic = "force-dynamic";

export default async function Disponibilidade({ searchParams }: { searchParams: Promise<{ m?: string; p?: string }> }) {
  const sp = await searchParams;
  const t = today();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : t.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const mes = `${MESES[m - 1]} ${y}`;
  const me = Number(sp.p) || 0;
  const person = me ? await one<Member>("SELECT * FROM members WHERE id=? AND active=1", [me]) : undefined;
  const nav = (mm: string) => `/disponibilidade?m=${mm}${person ? `&p=${me}` : ""}`;

  const head = (
    <div className="esc-top">
      <div className="month">
        <Link className="btn icon" href={nav(shiftMonth(month, -1))} aria-label="Mês anterior">‹</Link>
        <h2>{mes}</h2>
        <Link className="btn icon" href={nav(shiftMonth(month, 1))} aria-label="Próximo mês">›</Link>
      </div>
      {person && <Link className="btn" href={`/disponibilidade?m=${month}`}>Não sou {person.name.split(" ")[0]}</Link>}
    </div>
  );

  if (!person) {
    const people = await all<{ id: number; name: string; roles: string; answered: number }>(
      `SELECT mb.id, mb.name, mb.roles,
         (SELECT COUNT(*) FROM availability a JOIN services s ON s.id=a.service_id
           WHERE a.member_id=mb.id AND s.date LIKE ?) AS answered
       FROM members mb WHERE mb.active=1 ORDER BY mb.name`,
      [`${month}-%`],
    );
    const total = Number((await one<{ n: number }>("SELECT COUNT(*) AS n FROM services WHERE date LIKE ?", [`${month}-%`]))?.n ?? 0);
    return (
      <>
        {head}
        <div className="sheet">
          <h3 style={{ marginTop: 0 }}>Quem é você?</h3>
          <p className="muted" style={{ marginTop: -4 }}>
            Toque no seu nome para marcar em quais cultos de {MESES[m - 1]} você pode servir. O aparelho lembra da sua escolha.
          </p>
          <PickPerson
            month={month}
            total={total}
            people={people.map((p) => ({ id: Number(p.id), name: p.name, roles: splitRoles(p.roles).join(", "), answered: Number(p.answered) }))}
          />
        </div>
      </>
    );
  }

  const services = await all<{ id: number; date: string; title: string; available: number | null; roles: string | null }>(
    `SELECT s.id, s.date, s.title,
       (SELECT available FROM availability a WHERE a.member_id=? AND a.service_id=s.id) AS available,
       (SELECT GROUP_CONCAT(sm.role, ', ') FROM service_members sm WHERE sm.member_id=? AND sm.service_id=s.id) AS roles
     FROM services s WHERE s.date LIKE ? ORDER BY s.date, s.id`,
    [me, me, `${month}-%`],
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
      {head}
      <AvailCalendar memberId={me} name={person.name} month={month} mes={MESES[m - 1]} today={t} days={monthGrid(month)} items={items} />
    </>
  );
}
