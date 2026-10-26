import Link from "next/link";
import { redirect } from "next/navigation";
import { pageUser, seesAccessLog } from "@/lib/auth";
import { all, run } from "@/lib/db";
import { ddmm, dayName } from "@/lib/format";

export const dynamic = "force-dynamic";

type Row = { id: number; name: string; roles: string; last: string | null; n7: number; entradas: number; dev: string | null };
type Ev = { id: number; member_id: number; name: string; at: string; kind: string; path: string; device: string };

/** "2026-10-26 17:05:00" (UTC, do banco) → Date */
const toDate = (at: string) => new Date(at.replace(" ", "T") + "Z");
const quando = (at: string) => toDate(at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
function ha(at: string) {
  const min = Math.round((Date.now() - toDate(at).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d === 1 ? "" : "s"}`;
}

/** Log de acesso: quem está usando o app (só o administrador). */
export default async function Acessos({ searchParams }: { searchParams: Promise<{ eu?: string }> }) {
  const me = await pageUser("lider", false); // a própria página de acessos não entra no log
  if (!(await seesAccessLog(me))) redirect("/calendario");
  const withMe = (await searchParams).eu === "1";
  await run("DELETE FROM access_log WHERE at < datetime('now', '-90 days')");

  const people = await all<Row>(
    `SELECT m.id, m.name, m.roles, MAX(a.at) AS last,
       COALESCE(SUM(a.at > datetime('now', '-7 days')), 0) AS n7,
       COALESCE(SUM(a.kind = 'entrada'), 0) AS entradas,
       (SELECT x.device FROM access_log x WHERE x.member_id = m.id ORDER BY x.at DESC LIMIT 1) AS dev
     FROM members m LEFT JOIN access_log a ON a.member_id = m.id
     WHERE m.active = 1 GROUP BY m.id ORDER BY last IS NULL, last DESC, m.name`,
  );
  const events = await all<Ev>(
    `SELECT a.*, m.name FROM access_log a JOIN members m ON m.id = a.member_id
     ${withMe ? "" : "WHERE a.member_id <> ?"} ORDER BY a.id DESC LIMIT 150`,
    withMe ? [] : [me.id],
  );
  const cultos = new Map((await all<{ id: number; date: string; title: string }>("SELECT id, date, title FROM services"))
    .map((c) => [Number(c.id), `${dayName(c.date)} ${ddmm(c.date)} · ${c.title}`]));

  const pagina = (p: string) => {
    const [path, q = ""] = p.split("?");
    const c = path.match(/^\/cultos\/(\d+)/);
    if (c) return `Culto ${cultos.get(Number(c[1])) ?? `#${c[1]}`}`;
    if (path.startsWith("/disponibilidade")) return q.includes("ver=equipe") ? "Disponibilidade · Equipe" : "Disponibilidade";
    if (path.startsWith("/escala/distribuir")) return "Distribuir escala";
    if (/^\/musicas\/\d+/.test(path)) return "Música";
    const names: Record<string, string> = { "/calendario": "Calendário", "/cultos": "Cultos", "/escala": "Escala", "/musicas": "Músicas", "/musicas/importar": "Importar do Drive", "/equipe": "Equipe", "/acessos": "Acessos" };
    return names[path] ?? path;
  };

  const used = people.filter((p) => p.last && (withMe || Number(p.id) !== me.id));
  const never = people.filter((p) => !p.last);
  const active7 = people.filter((p) => Number(p.n7) > 0).length;

  return (
    <div className="acessos">
      <div className="esc-top">
        <h2>Acessos</h2>
        <Link className="btn small" href={withMe ? "/acessos" : "/acessos?eu=1"}>{withMe ? "Esconder os meus" : "Mostrar os meus"}</Link>
      </div>
      <p className="muted">Só a administração vê esta página. Guarda os últimos 90 dias; a mesma página da mesma pessoa conta uma vez a cada 10 minutos.</p>

      <div className="acc-nums">
        <div><b>{people.length - never.length}</b><span>de {people.length} já entraram</span></div>
        <div><b>{active7}</b><span>usaram nos últimos 7 dias</span></div>
        <div><b>{never.length}</b><span>nunca entraram</span></div>
      </div>

      {never.length > 0 && (
        <section className="sec">
          <h3>Ainda não entraram <small>{never.length}</small></h3>
          <p className="acc-never">{never.map((p) => <span key={p.id} className="chip">{p.name}</span>)}</p>
        </section>
      )}

      <section className="sec">
        <h3>Por pessoa</h3>
        {used.length === 0 ? <p className="muted">Ninguém além de você entrou ainda.</p> : (
          <div className="acc-table">
            <table>
              <thead><tr><th>Pessoa</th><th>Último acesso</th><th>Aparelho</th><th>Páginas (7 dias)</th><th>Entradas</th></tr></thead>
              <tbody>
                {used.map((p) => (
                  <tr key={p.id}>
                    <td><b>{p.name}</b><br /><span className="muted">{p.roles}</span></td>
                    <td title={quando(p.last!)}>{ha(p.last!)}</td>
                    <td>{p.dev}</td>
                    <td>{Number(p.n7)}</td>
                    <td>{Number(p.entradas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sec">
        <h3>Últimos movimentos</h3>
        {events.length === 0 ? <p className="muted">Nada registrado ainda.</p> : (
          <ol className="acc-log">
            {events.map((e) => (
              <li key={e.id}>
                <span className="muted">{quando(e.at)}</span>
                <b>{e.name}</b>
                <span>{e.kind === "entrada" ? <span className="chip ok">entrou</span> : pagina(e.path)}</span>
                <span className="muted">{e.device}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
