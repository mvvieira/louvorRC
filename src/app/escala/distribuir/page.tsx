import Link from "next/link";
import { all, type Member, type Service } from "@/lib/db";
import { learnTemplate, type Avail, type DSlot } from "@/lib/distribute";
import { MESES, shiftMonth as shift, today } from "@/lib/format";
import { splitRoles } from "@/lib/roles";
import Distributor from "./Distributor";

export const dynamic = "force-dynamic";

export default async function Distribuir({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const t = today();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : shift(t.slice(0, 7), 1);
  const [y, m] = month.split("-");
  const mesNome = MESES[Number(m) - 1];

  const cs = await all<Service>("SELECT id, date, title FROM services WHERE date LIKE ? AND date >= ? ORDER BY date, id", [`${month}-%`, t]);
  const ids = cs.map((c) => Number(c.id));
  const marks = ids.length ? ids.map(() => "?").join(",") : "0";
  const existing = (await all<DSlot>(`SELECT service_id, member_id, role FROM service_members WHERE service_id IN (${marks})`, ids))
    .map((e) => ({ service_id: Number(e.service_id), member_id: Number(e.member_id), role: e.role || "Equipe" }));
  const people = (await all<Member>("SELECT id, name, roles FROM members WHERE active=1 ORDER BY name"))
    .map((p) => ({ id: Number(p.id), name: p.name, roles: splitRoles(p.roles) }));
  const avail: Avail = {};
  for (const a of await all<{ member_id: number; service_id: number; available: number }>(
    `SELECT member_id, service_id, available FROM availability WHERE service_id IN (${marks})`, ids,
  )) avail[`${a.member_id}:${a.service_id}`] = Number(a.available) ? 1 : 0;

  // escalas anteriores ao mês, para aprender quantas pessoas cada culto leva
  const hist = await all<{ id: number; date: string; title: string; roles: string }>(
    `SELECT s.id, s.date, s.title, group_concat(CASE WHEN sm.role='' THEN 'Equipe' ELSE sm.role END, '|') AS roles
     FROM services s JOIN service_members sm ON sm.service_id=s.id
     WHERE s.date < ? GROUP BY s.id ORDER BY s.date, s.id`,
    [`${month}-01`],
  );
  const template = learnTemplate([...new Set(cs.map((c) => c.title))], hist.map((h) => ({ ...h, id: Number(h.id), roles: String(h.roles).split("|") })));
  const answered = new Set(Object.keys(avail).map((k) => k.split(":")[0])).size;

  return (
    <>
      <div className="esc-top">
        <div className="month">
          <Link className="btn icon" href={`/escala/distribuir?m=${shift(month, -1)}`} aria-label="Mês anterior">‹</Link>
          <h2>Distribuir {mesNome} {y}</h2>
          <Link className="btn icon" href={`/escala/distribuir?m=${shift(month, 1)}`} aria-label="Próximo mês">›</Link>
        </div>
        <Link className="btn" href={`/escala?m=${month}`}>← Voltar para a escala</Link>
      </div>
      {cs.length === 0 ? (
        <p className="empty-month">Nenhum culto por vir em {mesNome}. Crie os cultos na aba <Link href="/cultos">Cultos</Link>.</p>
      ) : (
        <Distributor key={month} month={month} services={cs.map((c) => ({ id: Number(c.id), date: c.date, title: c.title }))}
          people={people} existing={existing} avail={avail} template={template} answered={answered} />
      )}
    </>
  );
}
