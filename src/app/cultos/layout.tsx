import { pageUser } from "@/lib/auth";
import { all, type Service } from "@/lib/db";
import { today } from "@/lib/format";
import Agenda from "./Agenda";

export const dynamic = "force-dynamic";

/** `mine` = funções de quem está usando o app nesse culto (vazio se não está escalado). */
export type AgendaItem = Service & { n: number; mine: string | null };

export default async function CultosLayout({ children }: { children: React.ReactNode }) {
  const me = await pageUser();
  const t = today();
  const rows = await all<AgendaItem>(
    `SELECT s.*, (SELECT COUNT(*) FROM service_songs ss WHERE ss.service_id=s.id) AS n,
       (SELECT GROUP_CONCAT(CASE WHEN sm.role='' THEN 'Equipe' ELSE sm.role END, ', ') FROM service_members sm WHERE sm.service_id=s.id AND sm.member_id=?) AS mine
     FROM services s`,
    [me.id],
  );
  const up = rows.filter((s) => s.date >= t).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const past = rows.filter((s) => s.date < t).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  return (
    <div className="cultos">
      <Agenda up={up} past={past} lider={me.access === "lider"} />
      <div className="sheet">{children}</div>
    </div>
  );
}
