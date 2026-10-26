import Link from "next/link";
import { pageUser, seesAccessLog } from "@/lib/auth";
import { all } from "@/lib/db";
import { INSTRUMENTO, INSTRUMENTOS, plays } from "@/lib/distribute";
import { monthData } from "@/lib/distribute-data";
import { dayName, ddmm, MESES, shiftMonth, today } from "@/lib/format";
import { FUNCOES, serviceType } from "@/lib/roles";
import CopyButton from "../CopyButton";

export const dynamic = "force-dynamic";

const quando = (at: string) =>
  new Date(at.replace(" ", "T") + "Z").toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Acompanhamento do preenchimento da disponibilidade do mês (liderança). */
export default async function Relatorios({ searchParams }: { searchParams: Promise<{ m?: string; f?: string }> }) {
  const me = await pageUser("lider");
  const admin = await seesAccessLog(me);
  const sp = await searchParams;
  const t = today();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : shiftMonth(t.slice(0, 7), 1);
  const [y, m] = month.split("-").map(Number);
  const mes = MESES[m - 1];
  const role = FUNCOES.includes(sp.f ?? "") ? sp.f! : "";
  const href = (o: { m?: string; f?: string }) => {
    const q = new URLSearchParams({ m: o.m ?? month });
    if (o.f ?? role) q.set("f", o.f ?? role);
    return `/relatorios?${q}`;
  };

  const { services, people, avail, template, existing } = await monthData(month);
  const ready = new Set(existing.map((e) => e.service_id));
  const total = services.length;
  const lastAt = new Map((await all<{ member_id: number; last: string }>(
    `SELECT a.member_id, MAX(a.updated_at) AS last FROM availability a JOIN services s ON s.id=a.service_id
     WHERE s.date LIKE ? GROUP BY a.member_id`,
    [`${month}-%`],
  )).map((r) => [Number(r.member_id), r.last]));
  const inApp = admin
    ? new Set((await all<{ member_id: number }>("SELECT DISTINCT member_id FROM access_log")).map((r) => Number(r.member_id)))
    : null;

  const rows = people.map((p) => {
    const marked = services.filter((s) => avail[`${p.id}:${s.id}`] !== undefined);
    return {
      ...p,
      done: marked.length,
      yes: marked.filter((s) => avail[`${p.id}:${s.id}`] === 1).length,
      last: lastAt.get(p.id),
    };
  });
  const full = rows.filter((r) => total && r.done === total);
  const partial = rows.filter((r) => r.done > 0 && r.done < total);
  const none = rows.filter((r) => r.done === 0);
  const shown = rows
    .filter((r) => !role || r.roles.includes(role))
    .sort((a, b) => a.done - b.done || a.name.localeCompare(b.name));

  const cobrar = [
    `📋 *Disponibilidade de ${mes}*`,
    "",
    ...(none.length ? [`Ainda não marcaram: ${none.map((r) => r.name).join(", ")}`] : []),
    ...(partial.length ? [`Faltam alguns cultos: ${partial.map((r) => r.name).join(", ")}`] : []),
    ...(none.length + partial.length === 0 ? ["✓ Todo mundo já marcou. Obrigado! 🙌"] : []),
    "",
    `Entre em louvor-rc.vercel.app → *Disponibilidade* e marque os cultos de ${mes} 🙏 (leva menos de 1 minuto)`,
  ].join("\n");

  // cobertura: quantas pessoas da função podem em cada culto, comparado ao que o culto precisa
  const roles = [...FUNCOES, INSTRUMENTO].filter((r) => services.some((s) => (template[s.title]?.[r] ?? 0) > 0));
  const cell = (sid: number, r: string) => {
    const need = template[services.find((s) => s.id === sid)!.title]?.[r] ?? 0;
    const pool = people.filter((p) => plays(p, r));
    const can = pool.filter((p) => avail[`${p.id}:${sid}`] === 1).length;
    const open = pool.filter((p) => avail[`${p.id}:${sid}`] === undefined).length;
    return { need, can, open };
  };
  // só o que falta mesmo se todo mundo responder (cultos com escala pronta ficam de fora)
  const gaps = services.filter((s) => !ready.has(s.id))
    .flatMap((s) => roles.map((r) => ({ s, r, ...cell(s.id, r) })).filter((c) => c.need && c.can + c.open < c.need));

  return (
    <div className="rel">
      <div className="esc-top">
        <div className="month">
          <Link className="btn icon" href={href({ m: shiftMonth(month, -1) })} aria-label="Mês anterior">‹</Link>
          <h2>{mes} {y}</h2>
          <Link className="btn icon" href={href({ m: shiftMonth(month, 1) })} aria-label="Próximo mês">›</Link>
        </div>
        <CopyButton text={cobrar} label="Copiar cobrança para o grupo" done="Mensagem copiada" className="btn primary" />
      </div>
      <p className="muted rel-sub">Acompanhamento da disponibilidade de {mes}: {total} culto{total === 1 ? "" : "s"} no mês.</p>

      <div className="acc-nums">
        <div><b>{full.length}</b><span>marcaram todos os cultos</span></div>
        <div><b>{partial.length}</b><span>marcaram só alguns</span></div>
        <div><b>{none.length}</b><span>ainda não marcaram</span></div>
      </div>
      <div className="rel-bar" aria-label={`${full.length} completos e ${partial.length} parciais de ${rows.length}`}>
        <i className="ok" style={{ width: `${(full.length / Math.max(1, rows.length)) * 100}%` }} />
        <i className="mid" style={{ width: `${(partial.length / Math.max(1, rows.length)) * 100}%` }} />
      </div>

      <section className="sec">
        <h3>Cobertura por culto <small>pessoas que podem / precisa</small></h3>
        {gaps.length > 0 ? (
          <p className="notes" style={{ marginBottom: 10 }}>
            ⚠ Falta gente mesmo com todos respondendo: {gaps.slice(0, 8).map((g) => `${ddmm(g.s.date)} ${g.r === INSTRUMENTO ? "Instrumento" : g.r}`).join(" · ")}{gaps.length > 8 ? ` e mais ${gaps.length - 8}` : ""}
          </p>
        ) : total > 0 && <p className="muted" style={{ marginBottom: 10 }}>Nenhum culto está sem gente possível. Os amarelos ainda dependem de quem não respondeu.</p>}
        <div className="grid-wrap">
          <table className="eg rel-cov">
            <thead>
              <tr>
                <th className="corner" />
                {services.map((s) => (
                  <th key={s.id}>
                    <Link className="colh" href={`/cultos/${s.id}`} style={{ "--tc": `var(--t-${serviceType(s.title)[0]})` } as React.CSSProperties}>
                      <span className="dw">{dayName(s.date)}</span>
                      <span className="dn">{s.date.slice(8, 10)}</span>
                      <span className="tt">{s.title}</span>
                      {ready.has(s.id) && <span className="chip ok rel-ready">escala pronta</span>}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r}>
                  <th scope="row">{r === INSTRUMENTO ? `Instrumento*` : r}</th>
                  {services.map((s) => {
                    const c = cell(s.id, r);
                    if (!c.need || ready.has(s.id)) return <td key={s.id} className="empty">{ready.has(s.id) && c.need ? "✓" : "·"}</td>;
                    return (
                      <td key={s.id} className={c.can >= c.need ? "cov-ok" : c.can + c.open >= c.need ? "cov-wait" : "cov-bad"}
                        title={`${c.can} podem · ${c.open} sem resposta · precisa ${c.need}`}>
                        <b>{c.can}</b>/{c.need}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted rel-legend">
          <span className="cov-ok">verde</span> já tem gente · <span className="cov-wait">amarelo</span> depende de quem ainda não respondeu ·{" "}
          <span className="cov-bad">vermelho</span> falta gente mesmo com todos respondendo
          {roles.includes(INSTRUMENTO) && <> · *Instrumento = {INSTRUMENTOS.join(", ").toLowerCase()} (intercessão)</>}
        </p>
      </section>

      <section className="sec">
        <h3>Por pessoa <small>{shown.length}</small></h3>
        <nav className="seg small" aria-label="Função" style={{ marginBottom: 10 }}>
          <Link href={href({ f: "" })} aria-current={!role ? "page" : undefined}>Todos</Link>
          {FUNCOES.filter((r) => people.some((p) => p.roles.includes(r))).map((r) => (
            <Link key={r} href={href({ f: r })} aria-current={role === r ? "page" : undefined}>{r}</Link>
          ))}
        </nav>
        <div className="acc-table">
          <table>
            <thead>
              <tr><th>Pessoa</th><th>Preenchido</th><th>Pode em</th><th>Última marcação</th>{inApp && <th>Entrou no app?</th>}</tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b><br /><span className="muted">{r.roles.join(", ")}</span></td>
                  <td>
                    <span className={`chip ${r.done === total && total ? "ok" : r.done ? "" : "miss"}`}>
                      {r.done === 0 ? "não respondeu" : `${r.done} de ${total}`}
                    </span>
                  </td>
                  <td>{r.done ? `${r.yes} culto${r.yes === 1 ? "" : "s"}` : "—"}</td>
                  <td>{r.last ? quando(r.last) : "—"}</td>
                  {inApp && <td>{inApp.has(r.id) ? "✓ sim" : <span className="muted">nunca entrou</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
