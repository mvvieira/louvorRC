import Link from "next/link";
import { can, type User } from "@/lib/auth";
import { approverName, isApprover, monthStatus } from "@/lib/escala-status";
import { all, type Member, type Service } from "@/lib/db";
import { dayName, ddmm, MESES, shiftMonth as shift, today } from "@/lib/format";
import { FUNCOES, serviceType, splitRoles } from "@/lib/roles";
import { addServiceMember, approveEscala, reopenEscala, setServiceMember } from "../actions";
import ConfirmButton from "../ConfirmButton";
import CopyButton from "../CopyButton";
import SlotSelect, { type SlotPerson } from "../SlotSelect";

type Slot = { id: number; service_id: number; member_id: number; role: string; name: string };

/**
 * Escala do mês. Em /escala é só leitura (com o destaque amarelo de quem está usando);
 * em /escala/montar (liderança) as células viram seletores e aparecem as ações de montar.
 */
export default async function EscalaView({ month, me, edit, done }: { month: string; me: User; edit: boolean; done?: string }) {
  const t = today();
  const base = edit ? "/escala/montar" : "/escala";
  const [y, m] = month.split("-");
  const mesNome = MESES[Number(m) - 1];

  const status = await monthStatus(month);
  const lider = can(me, "lider");
  const approver = await isApprover(me);
  const who = await approverName();
  const quando = status.at ? new Date(status.at.replace(" ", "T") + "Z").toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const nav = (
    <div className="month">
      <Link className="btn icon" href={`${base}?m=${shift(month, -1)}`} aria-label="Mês anterior">‹</Link>
      <h2>{edit ? "Montar · " : ""}{mesNome} {y}</h2>
      <Link className="btn icon" href={`${base}?m=${shift(month, 1)}`} aria-label="Próximo mês">›</Link>
    </div>
  );
  // equipe só vê a escala de mês aprovado
  if (!edit && !lider && !status.official) {
    return (
      <>
        <div className="esc-top esc-full">{nav}</div>
        <p className="edit-hint">A escala de {mesNome} está sendo montada. Ela aparece aqui quando for aprovada pela liderança.</p>
      </>
    );
  }

  const cs = await all<Service>("SELECT * FROM services WHERE date LIKE ? ORDER BY date, id", [`${month}-%`]);
  const slots = await all<Slot>(
    `SELECT sm.id, sm.service_id, sm.member_id, sm.role, mb.name FROM service_members sm
     JOIN members mb ON mb.id=sm.member_id JOIN services s ON s.id=sm.service_id
     WHERE s.date LIKE ? ORDER BY sm.id`,
    [`${month}-%`],
  );
  const people = edit ? await all<Member>("SELECT id, name, roles FROM members WHERE active=1 ORDER BY name") : [];
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
  // quem está usando o app: destaque amarelo como no calendário
  const yours = (c: Service) => at(Number(c.id)).filter((s) => Number(s.member_id) === me.id);
  const yourCs = cs.filter((c) => yours(c).length);
  const col = (c: Service) => (yours(c).length ? " mine" : "");

  const L = [`📅 *ESCALA RC LOUVOR – ${mesNome.toUpperCase()} ${y}*`];
  for (const c of cs) {
    L.push("", `🔥 *${dayName(c.date).toUpperCase()} ${ddmm(c.date)} – ${c.title.toUpperCase()}*`);
    for (const f of fs) {
      const ns = at(Number(c.id), f).map((s) => s.name);
      if (ns.length) L.push(`${f}: ${ns.join(", ")}`);
    }
  }

  return (
    <>
      <div className="esc-top esc-full">
        {nav}
        {edit && <Link className="btn primary" href={`/escala/distribuir?m=${month}`}>Distribuir automaticamente</Link>}
        {edit && <CopyButton text={L.join("\n")} label="Copiar escala do mês" done="Escala copiada" className="btn" />}
      </div>

      {edit && cs.length > 0 && (
        <div className={`approve-bar${status.official ? " ok" : ""}`}>
          {status.official ? (
            <span>✓ <b>Escala oficial</b>{status.by ? ` · aprovada por ${status.by}` : ""}{quando ? ` em ${quando}` : ""}. Toda a equipe já vê. Trocas feitas aqui aparecem na hora.</span>
          ) : (
            <span><b>Rascunho</b> · só a liderança vê a escala de {mesNome}. {approver ? "Quando estiver pronta, aprove para todos verem." : `Aguardando a aprovação de ${who}.`}</span>
          )}
          {approver && (
            <form action={status.official ? reopenEscala : approveEscala}>
              <input type="hidden" name="month" value={month} />
              {status.official ? (
                <ConfirmButton className="btn small" message={`Reabrir a escala de ${mesNome}? Ela some para a equipe até você aprovar de novo.`}>Reabrir para ajustes</ConfirmButton>
              ) : (
                <ConfirmButton className="btn primary" message={`Aprovar a escala de ${mesNome}? Ela passa a aparecer para toda a equipe.`}>Aprovar escala de {mesNome}</ConfirmButton>
              )}
            </form>
          )}
        </div>
      )}

      {!edit && !status.official && (
        <p className="edit-hint">Rascunho: só a liderança está vendo a escala de {mesNome}. Ela aparece para a equipe quando {who} aprovar em Montar escala.</p>
      )}

      {done !== undefined && (
        <p className="edit-hint">✓ {done} pessoa{done === "1" ? "" : "s"} lançada{done === "1" ? "" : "s"} na escala pela distribuição automática. Para trocar alguém, escolha outra pessoa na célula.</p>
      )}

      {edit ? (
        <p className="edit-hint">
          Escolha outra pessoa na célula para trocar, “✕ Tirar da escala” para tirar, ou “+ acrescentar” para pôr mais alguém. Cada mudança salva na hora.
        </p>
      ) : (
        <p className="today-mine esc-mine">
          <span className="you-dot">★</span>
          {yourCs.length
            ? <>Você está em <b>{yourCs.length} culto{yourCs.length === 1 ? "" : "s"}</b> em {mesNome}: {yourCs.map((c, i) => (
                <span key={c.id}>{i > 0 && " · "}{dayName(c.date)} {ddmm(c.date)} ({yours(c).map(roleOf).join(", ")})</span>
              ))}</>
            : <>Você não está escalado em {mesNome}.</>}
        </p>
      )}

      {cs.length === 0 ? (
        <div className="grid-wrap">
          <p className="empty-month">Nenhum culto cadastrado em {mesNome}. Crie os cultos na aba <Link href="/cultos">Cultos</Link>.</p>
        </div>
      ) : (
        <>
          <div className={`grid-wrap${edit ? " editing" : " has-grid"}`}>
            <table className="eg">
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
                          return <span key={i} className={`p${Number(s.member_id) === me.id ? " you" : ""}${off ? " away" : ""}`} title={off ? "Marcou que não pode neste culto" : undefined}>{off && "⚠ "}{s.name}</span>;
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
              <Link key={c.id} href={`/cultos/${c.id}`} className={`ccard${yours(c).length ? " mine" : ""}`}
                style={{ "--tc": `var(--t-${serviceType(c.title)[0]})` } as React.CSSProperties}>
                {yours(c).length > 0 && <span className="ev-you">★ Você · {yours(c).map(roleOf).join(", ")}</span>}
                <h3>{dayName(c.date)} {ddmm(c.date)} · {c.title}</h3>
                <dl>
                  {fs.filter((f) => at(Number(c.id), f).length).map((f) => (
                    <div key={f} style={{ display: "contents" }}>
                      <dt>{f}</dt>
                      <dd>{at(Number(c.id), f).map((s, i) => (
                        <span key={i}>{i > 0 && ", "}<span className={Number(s.member_id) === me.id ? "you" : undefined}>{s.name}</span></span>
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
