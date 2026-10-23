import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { all, one, type Member } from "@/lib/db";
import { dayName, ddmm, MESES, monthGrid, shiftMonth, today } from "@/lib/format";
import { FUNCOES, serviceType, splitRoles } from "@/lib/roles";
import AvailCalendar, { type AvailItem } from "./AvailCalendar";

export const dynamic = "force-dynamic";

export default async function Disponibilidade({ searchParams }: { searchParams: Promise<{ m?: string; p?: string; ver?: string; f?: string }> }) {
  const user = await pageUser();
  const lider = user.access === "lider";
  const sp = await searchParams;
  const t = today();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : t.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const mes = `${MESES[m - 1]} ${y}`;
  const team = sp.ver === "equipe";
  // cada um marca a sua; só a liderança abre (e marca) a de outra pessoa
  const me = lider && Number(sp.p) ? Number(sp.p) : user.id;
  const person = await one<Member>("SELECT * FROM members WHERE id=? AND active=1", [me]);
  const q = (o: { m?: string; ver?: string; p?: number; f?: string }) => {
    const u = new URLSearchParams({ m: o.m ?? month });
    if (o.ver) u.set("ver", o.ver);
    if (o.p && o.p !== user.id) u.set("p", String(o.p));
    if (o.f) u.set("f", o.f);
    return `/disponibilidade?${u}`;
  };
  const keep = { ver: team ? "equipe" : undefined, p: team ? undefined : me, f: sp.f };

  const head = (
    <div className="esc-top">
      <div className="month">
        <Link className="btn icon" href={q({ ...keep, m: shiftMonth(month, -1) })} aria-label="Mês anterior">‹</Link>
        <h2>{mes}</h2>
        <Link className="btn icon" href={q({ ...keep, m: shiftMonth(month, 1) })} aria-label="Próximo mês">›</Link>
      </div>
      <nav className="seg" aria-label="Ver">
        <Link href={q({})} aria-current={!team && me === user.id ? "page" : undefined}>Minha disponibilidade</Link>
        <Link href={q({ ver: "equipe" })} aria-current={team ? "page" : undefined}>Equipe</Link>
      </nav>
    </div>
  );

  if (team) {
    const services = await all<{ id: number; date: string; title: string }>("SELECT id, date, title FROM services WHERE date LIKE ? AND date >= ? ORDER BY date, id", [`${month}-%`, t]);
    const people = (await all<Member>("SELECT id, name, roles FROM members WHERE active=1 ORDER BY name"))
      .map((p) => ({ id: Number(p.id), name: p.name, roles: splitRoles(p.roles) }));
    const marks = await all<{ member_id: number; service_id: number; available: number }>(
      `SELECT a.member_id, a.service_id, a.available FROM availability a JOIN services s ON s.id=a.service_id WHERE s.date LIKE ?`,
      [`${month}-%`],
    );
    const role = FUNCOES.includes(sp.f ?? "") ? sp.f! : "";
    const pool = people.filter((p) => !role || p.roles.includes(role));
    const st = (pid: number, sid: number) => marks.find((a) => Number(a.member_id) === pid && Number(a.service_id) === sid);
    const who = (p: { id: number; name: string }) =>
      lider ? <Link key={p.id} href={q({ p: p.id })} className={p.id === user.id ? "me" : undefined}>{p.name}</Link>
        : <span key={p.id} className={p.id === user.id ? "me" : undefined}>{p.name}</span>;
    const list = (ps: typeof pool) => ps.map((p, i) => <span key={p.id}>{i > 0 && ", "}{who(p)}</span>);

    return (
      <>
        {head}
        <div className="sheet">
          <div className="av-team-bar">
            <p className="muted">Quem pode e quem não pode em cada culto: ajuda a achar alguém para trocar.</p>
            <nav className="seg small" aria-label="Função">
              <Link href={q({ ver: "equipe" })} aria-current={!role ? "page" : undefined}>Todos</Link>
              {FUNCOES.filter((r) => people.some((p) => p.roles.includes(r))).map((r) => (
                <Link key={r} href={q({ ver: "equipe", f: r })} aria-current={role === r ? "page" : undefined}>{r}</Link>
              ))}
            </nav>
          </div>
          {services.length === 0 && <p className="muted">Nenhum culto por vir em {MESES[m - 1]}.</p>}
          <div className="av-team">
            {services.map((s) => {
              const yes = pool.filter((p) => Number(st(p.id, s.id)?.available) === 1);
              const no = pool.filter((p) => st(p.id, s.id) && Number(st(p.id, s.id)!.available) === 0);
              const none = pool.filter((p) => !st(p.id, s.id));
              return (
                <section key={s.id} className="av-tcard" style={{ "--tc": `var(--t-${serviceType(s.title)[0]})` } as React.CSSProperties}>
                  <h4><Link href={`/cultos/${s.id}`}>{dayName(s.date)} {ddmm(s.date)} · {s.title}</Link></h4>
                  <p><b className="ok-t">✓ Podem ({yes.length})</b> {yes.length ? list(yes) : <span className="muted">ninguém ainda</span>}</p>
                  {no.length > 0 && <p><b className="no-t">✕ Não podem ({no.length})</b> {list(no)}</p>}
                  {none.length > 0 && <details><summary className="muted">Sem resposta ({none.length})</summary><p>{list(none)}</p></details>}
                </section>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  if (!person) return <>{head}<p className="muted">Pessoa não encontrada.</p></>;

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
      {me !== user.id && (
        <p className="edit-hint">Marcando pela <b>{person.name}</b> (liderança). <Link href={q({})}>Voltar para a minha</Link></p>
      )}
      <AvailCalendar memberId={me} name={person.name} month={month} mes={MESES[m - 1]} today={t} days={monthGrid(month)} items={items} />
    </>
  );
}
