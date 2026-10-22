import { all, type Member, type Service } from "./db";
import { buildTemplate, type Avail, type DPerson, type DService, type DSlot, type Template } from "./distribute";
import { splitRoles } from "./roles";

/** Tudo o que a distribuição precisa de um mês "AAAA-MM": cultos, escalas lançadas, equipe, disponibilidade e modelo. */
export async function monthData(month: string): Promise<{
  services: DService[]; existing: DSlot[]; people: DPerson[]; avail: Avail; template: Template; answered: number;
}> {
  const services = (await all<Service>("SELECT id, date, title FROM services WHERE date LIKE ? ORDER BY date, id", [`${month}-%`]))
    .map((c) => ({ id: Number(c.id), date: c.date, title: c.title }));
  const existing = (await all<DSlot>(
    `SELECT sm.service_id, sm.member_id, sm.role FROM service_members sm JOIN services s ON s.id=sm.service_id WHERE s.date LIKE ?`,
    [`${month}-%`],
  )).map((e) => ({ service_id: Number(e.service_id), member_id: Number(e.member_id), role: e.role || "Equipe" }));
  const people = (await all<Member>("SELECT id, name, roles FROM members WHERE active=1 ORDER BY name"))
    .map((p) => ({ id: Number(p.id), name: p.name, roles: splitRoles(p.roles) }));
  const avail: Avail = {};
  for (const a of await all<{ member_id: number; service_id: number; available: number }>(
    `SELECT a.member_id, a.service_id, a.available FROM availability a JOIN services s ON s.id=a.service_id WHERE s.date LIKE ?`,
    [`${month}-%`],
  )) avail[`${a.member_id}:${a.service_id}`] = Number(a.available) ? 1 : 0;

  // escalas anteriores ao mês, para os cultos especiais aprenderem quantas pessoas levam
  const hist = await all<{ id: number; date: string; title: string; roles: string }>(
    `SELECT s.id, s.date, s.title, group_concat(CASE WHEN sm.role='' THEN 'Equipe' ELSE sm.role END, '|') AS roles
     FROM services s JOIN service_members sm ON sm.service_id=s.id
     WHERE s.date < ? GROUP BY s.id ORDER BY s.date, s.id`,
    [`${month}-01`],
  );
  const template = buildTemplate([...new Set(services.map((c) => c.title))], hist.map((h) => ({ ...h, id: Number(h.id), roles: String(h.roles).split("|") })));
  const answered = new Set(Object.keys(avail).map((k) => k.split(":")[0])).size;
  return { services, existing, people, avail, template, answered };
}
