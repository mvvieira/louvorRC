import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { all, type Member, type Service } from "@/lib/db";
import { dayName, ddmm, MESES, shiftMonth as shift, today } from "@/lib/format";
import { FUNCOES, serviceType } from "@/lib/roles";
import { setServiceMember, addServiceMember } from "../actions";
import CopyButton from "../CopyButton";
import SlotSelect, { type SlotPerson } from "../SlotSelect";
import { splitRoles } from "@/lib/roles";
import WhoSelect from "./WhoSelect";

export const dynamic = "force-dynamic";

type Slot = { id: number; service_id: number; member_id: number; role: string; name: string };

export default async function Escala({ searchParams }: { searchParams: Promise<{ m?: string; p?: string; edit?: string; done?: string }> }) {
  const me_ = await pageUser();
  const lider = me_.access === "lider";
  const sp = await searchParams;
  const t = today();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : t.slice(0, 7);
  const me = Number(sp.p) || 0;
  const edit = lider && sp.edit === "1";
  const [y, m] = month.split("-");
  const mesNome = MESES[Number(m) - 1];

  const cs = await all<Service>("SELECT * FROM services WHERE date LIKE ? ORDER BY date, id", [`${month}-%`]);
  const slots = await all<Slot>(
    `SELECT sm.id, sm.service_id, sm.member_id, sm.role, mb.name FROM service_members sm
     JOIN members mb ON mb.id=sm.member_id JOIN services s ON s.id=sm.service_id
     WHERE s.date LIKE ? ORDER BY sm.id`,
    [`${month}-%`],
  );
  const people = await all<Member>("SELECT id, name, roles FROM members WHERE active=1 ORDER BY name");
  const slotPeople: SlotPerson[] = people.map((p) => ({ id: Number(p.id), name: p.name, roles: splitRoles(p.roles) }));

  const awayRows = await all<{ service_id: number; member_id: number }>(
    `SELECT a.service_id, a.member_id FROM availability a JOIN services s ON s.id=a.service_id WHERE s.date LIKE ? AND a.available=0`,
    [`${month}-%`],
  );
  const awayAt = (sid: number) => awayRows.filter((a) => Number(a.service_id) === sid).map((a) => Number(a.member_id));
  const roleOf = (s: Slot) => s.role || "Equipe";
  const at = (sid: number, role?: string) => slots.filter((s) => Number(s.service_id) === sid && (!role || roleOf(s) === role));
  const extra = [...new Set(slots.map(roleOf))].filter((r) => !FUNCOES.includes(r));
  const fs = [...FUNCOES, ...extra].filter((r) => edit || slots.some((s) => roleOf(s) === r));
  const tipos = [...new Map(cs.map((c) => serviceType(c.title))).entries()];
  const hasMe = (c: Service) => at(Number(c.id)).some((s) => Number(s.member_id) === me);
  const person = people.find((p) => Number(p.id) === me);
  const mine = cs.filter(hasMe);
  // quem está usando o app: destaque amarelo como no calendário
  const you = me_.id;
  const yours = (c: Service) => at(Number(c.id)).filter((s) => Number(s.member_id) === you);
  const yourCs = cs.filter((c) => yours(c).length);
  const col = (c: Service) => (yours(c).length ? " mine" : "");

  const L = [`📅 *ESCALA RC LOUVOR – ${mesNome.toUpperCase()} ${y}*`];
  for (const c of cs.filter((c) => !me || hasMe(c))) {
    L.push("", `🔥 *${dayName(c.date).toUpperCase()} ${ddmm(c.date)} – ${c.title.toUpperCase()}*`);
    for (const f of fs) {
      const ns = at(Number(c.id), f).filter((s) => !me || Number(s.member_id) === me).map((s) => s.name);
      if (ns.length) L.push(`${f}: ${ns.join(", ")}`);
    }
  }
  const q = (me ? `&p=${me}` : "") + (edit ? "&edit=1" : "");
  const editHref = `/escala?m=${month}${me ? `&p=${me}` : ""}${edit ? "" : "&edit=1"}`;

  return (
    <>
      <div className="esc-top">
        <div className="month">
          <Link className="btn icon" href={`/escala?m=${shift(month, -1)}${q}`} aria-label="Mês anterior">‹</Link>
          <h2>{mesNome} {y}</h2>
          <Link className="btn icon" href={`/escala?m=${shift(month, 1)}${q}`} aria-label="Próximo mês">›</Link>
        </div>
        <WhoSelect edit={edit} month={month} value={me ? String(me) : ""} people={people.map((p) => ({ id: Number(p.id), name: p.name }))} />
        {lider && <Link className={`btn${edit ? " primary" : ""}`} href={editHref}>{edit ? "Concluir edição" : "Editar escala"}</Link>}
        {lider && <Link className="btn" href={`/escala/distribuir?m=${month}`}>Distribuir automaticamente</Link>}
        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <CopyButton text={L.join("\n")} label="Copiar escala do mês" done="Escala copiada" className="btn" />
        </span>
      </div>

      {sp.done !== undefined && (
        <p className="edit-hint">✓ {sp.done} pessoa{sp.done === "1" ? "" : "s"} lançada{sp.done === "1" ? "" : "s"} na escala pela distribuição automática. Para trocar alguém, use “Editar escala”.</p>
      )}

      {!person && (
        <p className="today-mine esc-mine">
          <span className="you-dot">★</span>
          {yourCs.length
            ? <>Você está em <b>{yourCs.length} culto{yourCs.length === 1 ? "" : "s"}</b> em {mesNome}: {yourCs.map((c, i) => (
                <span key={c.id}>{i > 0 && " · "}{dayName(c.date)} {ddmm(c.date)} ({yours(c).map(roleOf).join(", ")})</span>
              ))}</>
            : <>Você não está escalado em {mesNome}.</>}
        </p>
      )}

      {person && (
        <div className="who-sum">
          <b>{person.name}</b> · {mine.length} escala{mine.length === 1 ? "" : "s"} em {mesNome}
          {mine.length > 0 && (
            <ul>
              {mine.map((c) => (
                <li key={c.id}>
                  {dayName(c.date)} {ddmm(c.date)} – {c.title}:{" "}
                  <strong>{at(Number(c.id)).filter((s) => Number(s.member_id) === me).map(roleOf).join(", ")}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {edit && (
        <p className="edit-hint">
          Modo edição: escolha outra pessoa na célula para trocar, “✕ Tirar da escala” para tirar, ou “+ acrescentar” para pôr mais alguém. Cada mudança salva na hora.
        </p>
      )}

      <div className="legend">
        {tipos.map(([k, l]) => <span key={k}><i style={{ background: `var(--t-${k})` }} />{l}</span>)}
      </div>

      {cs.length === 0 ? (
        <div className="grid-wrap">
          <p className="empty-month">Nenhum culto cadastrado em {mesNome}. Crie os cultos na aba <Link href="/cultos">Cultos</Link>.</p>
        </div>
      ) : (
        <>
          <div className={`grid-wrap${edit ? " editing" : " has-grid"}`}>
            <table className={`eg ${me ? "focus" : ""}`}>
              <colgroup><col />{cs.map((c) => <col key={c.id} className={[c.date === t && "today", yours(c).length && "mine"].filter(Boolean).join(" ") || undefined} />)}</colgroup>
              <thead>
                <tr>
                  <th className="corner" />
                  {cs.map((c) => (
                    <th key={c.id} className={yours(c).length ? "mine" : undefined}>
                      <Link className="colh" href={`/cultos/${c.id}`} title="Abrir culto" style={{ "--tc": `var(--t-${serviceType(c.title)[0]})` } as React.CSSProperties}>
                        <span className="dw">{dayName(c.date)}</span>
                        <span className="dn">{c.date.slice(8, 10)}</span>
                        <span className="tt">{c.title}</span>
                        {yours(c).length > 0 && <span className="ev-you">★ Você</span>}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fs.length === 0 && (
                  <tr><th scope="row">Escala</th>{cs.map((c) => <td key={c.id} className={`empty${col(c)}`}>·</td>)}</tr>
                )}
                {fs.map((f) => (
                  <tr key={f}>
                    <th scope="row">{f}</th>
                    {cs.map((c) => {
                      const ss = at(Number(c.id), f);
                      if (edit) {
                        const busy = at(Number(c.id)).map((s) => Number(s.member_id));
                        const common = { serviceId: Number(c.id), role: f, people: slotPeople, busy, away: awayAt(Number(c.id)), change: setServiceMember, add: addServiceMember };
                        return (
                          <td key={c.id} className={`edit-cell${col(c)}`}>
                            {ss.map((s) => <SlotSelect key={s.id} {...common} slotId={Number(s.id)} current={Number(s.member_id)} />)}
                            <SlotSelect {...common} />
                          </td>
                        );
                      }
                      return ss.length ? (
                        <td key={c.id} className={col(c).trim() || undefined}>{ss.map((s, i) => {
                          const off = awayAt(Number(c.id)).includes(Number(s.member_id));
                          return <span key={i} className={`p ${Number(s.member_id) === me ? "me" : ""}${Number(s.member_id) === you ? " you" : ""}${off ? " away" : ""}`} title={off ? "Marcou que não pode neste culto" : undefined}>{off && "⚠ "}{s.name}</span>;
                        })}</td>
                      ) : <td key={c.id} className={`empty${col(c)}`}>·</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`cards${edit ? " hidden" : ""}`}>
            {cs.map((c) => (
              <Link key={c.id} href={`/cultos/${c.id}`} className={`ccard ${!me || hasMe(c) ? "" : "dim"}${yours(c).length ? " mine" : ""}`}
                style={{ "--tc": `var(--t-${serviceType(c.title)[0]})` } as React.CSSProperties}>
                {yours(c).length > 0 && <span className="ev-you">★ Você · {yours(c).map(roleOf).join(", ")}</span>}
                <h3>{dayName(c.date)} {ddmm(c.date)} · {c.title}</h3>
                <dl>
                  {fs.filter((f) => at(Number(c.id), f).length).map((f) => (
                    <div key={f} style={{ display: "contents" }}>
                      <dt>{f}</dt>
                      <dd>{at(Number(c.id), f).map((s, i) => (
                        <span key={i}>{i > 0 && ", "}<span className={[Number(s.member_id) === me && "me", Number(s.member_id) === you && "you"].filter(Boolean).join(" ") || undefined}>{s.name}</span></span>
                      ))}</dd>
                    </div>
                  ))}
                </dl>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
