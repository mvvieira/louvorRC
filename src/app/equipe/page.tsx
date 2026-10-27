import { pageUser, seesAccessLog } from "@/lib/auth";
import { all } from "@/lib/db";
import { ddmm, today } from "@/lib/format";
import { FUNCOES } from "@/lib/roles";
import { deleteMember, resetMemberPassword, saveMember } from "../actions";
import MemberCard, { type MemberRow } from "./MemberCard";

export const dynamic = "force-dynamic";

export default async function Equipe() {
  const me = await pageUser("lider");
  const canReset = await seesAccessLog(me);
  const members = (await all<MemberRow>("SELECT id, name, roles, phone, must_change FROM members ORDER BY name"))
    .map((m) => ({ id: Number(m.id), name: m.name, roles: m.roles, phone: m.phone, must_change: Number(m.must_change) }));
  const upcoming = await all<{ member_id: number; date: string; role: string }>(
    `SELECT sm.member_id, s.date, sm.role FROM service_members sm JOIN services s ON s.id=sm.service_id
     WHERE s.date >= ? ORDER BY s.date`,
    [today()],
  );
  const meta = (id: number) => {
    const mine = upcoming.filter((u) => Number(u.member_id) === id);
    return mine.length
      ? "Próximas escalas: " + mine.map((u) => `${ddmm(u.date)}${u.role ? " " + u.role : ""}`).join(" · ")
      : "Sem escala nos próximos cultos";
  };
  return (
    <>
      <form action={saveMember} className="tools">
        <input type="text" name="name" placeholder="Nome de quem entra na equipe" aria-label="Nome" required style={{ flex: "0 1 280px" }} />
        <button className="btn primary">Adicionar integrante</button>
        <span className="count">{members.length} integrante{members.length === 1 ? "" : "s"}</span>
      </form>
      <div className="team">
        {members.map((m) => (
          <MemberCard key={m.id} member={m} funcoes={FUNCOES} meta={meta(Number(m.id))} save={saveMember} remove={deleteMember}
            resetPassword={canReset && Number(m.id) !== me.id ? resetMemberPassword : undefined} />
        ))}
      </div>
      {members.length === 0 && (
        <p className="muted">Cadastre quem serve no louvor e marque as funções de cada um. A escala dos cultos sugere as funções a partir daqui.</p>
      )}
    </>
  );
}
