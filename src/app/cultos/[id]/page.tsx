import Link from "next/link";
import { notFound } from "next/navigation";
import { can, pageUser } from "@/lib/auth";
import { all, one, type Member, type Service, type Song } from "@/lib/db";
import { dayName, ddmm, today } from "@/lib/format";
import { monthData } from "@/lib/distribute-data";
import { monthStatus } from "@/lib/escala-status";
import { FUNCOES, splitRoles } from "@/lib/roles";
import { driveItems } from "@/lib/drive";
import { linkHits } from "@/lib/finder";
import { repertoireSiblings } from "@/lib/repertoire";
import {
  addServiceMember, deleteService, removeServiceMember, setServiceMember, updateService, updateServiceNotes,
} from "../../actions";
import SlotSelect, { type SlotPerson } from "../../SlotSelect";
import AddSlot from "../AddSlot";
import AutoEscala from "../AutoEscala";
import AutoForm from "../../AutoForm";
import CopyButton from "../../CopyButton";
import ConfirmButton from "../../ConfirmButton";
import Repertoire, { type LinkOpt, type SongLinks } from "../Repertoire";

export const dynamic = "force-dynamic";

export default async function Culto({ params }: { params: Promise<{ id: string }> }) {
  const me = await pageUser();
  const lider = can(me, "lider"), ministro = can(me, "ministro");
  const { id: idStr } = await params;
  const id = Number(idStr);
  const service = await one<Service>("SELECT * FROM services WHERE id=?", [id]);
  if (!service) notFound();

  const items = await all<Song & { ss_id: number }>(
    `SELECT s.*, ss.id AS ss_id FROM service_songs ss JOIN songs s ON s.id=ss.song_id
     WHERE ss.service_id=? ORDER BY ss.position, ss.id`,
    [id],
  );
  // escala de mês ainda não aprovado: só a liderança vê
  const official = (await monthStatus(service.date.slice(0, 7))).official;
  const team = lider || official ? await all<{ sm_id: number; member_id: number; name: string; role: string }>(
    `SELECT sm.id AS sm_id, sm.member_id, m.name, sm.role FROM service_members sm JOIN members m ON m.id=sm.member_id
     WHERE sm.service_id=? ORDER BY sm.id`,
    [id],
  ) : [];
  const songs = await all<Song>("SELECT id, title, song_key, version, artist, vozes_url, cifra_url FROM songs ORDER BY title");
  const twins = await repertoireSiblings(id);
  const drive = await driveItems();
  const opt = (h: { url: string; name: string; folder: string; version: string; score: number }): LinkOpt => ({
    url: h.url,
    label: `${h.name.replace(/\.pdf$/i, "")}${h.folder.startsWith("CIFRAS / ") ? ` · ${h.folder.slice(9)}` : ""}`,
    version: h.version,
  });
  const links: Record<number, SongLinks> = {};
  for (const s of items) {
    const h = linkHits(s.title, s.song_key, s.version, drive);
    const fits = (x?: { song_key: string }) => !!x && (!s.song_key || !x.song_key || x.song_key.toLowerCase() === s.song_key.toLowerCase());
    links[s.id] = { vozes: h.vozes.map(opt), cifras: h.cifras.map(opt), auto: (!s.vozes_url && fits(h.vozes[0]) ? 1 : 0) + (!s.cifra_url && fits(h.cifras[0]) ? 1 : 0) };
  }
  const members = await all<Member>("SELECT id, name, roles FROM members WHERE active=1 ORDER BY name");

  const L = [`🎶 *${(service.title || "Repertório").toUpperCase()} – ${dayName(service.date).toUpperCase()} ${ddmm(service.date)}*`];
  for (const s of items) {
    const voz = s.version === "MASCULINO" ? " (masculino)" : s.version === "FEMININO" ? " (feminino)" : "";
    L.push("", `🔥 *${s.title.toUpperCase()}${s.song_key ? ` (${s.song_key})` : ""}*${voz}`);
    L.push(`🎤 Vozes: ${s.vozes_url || "(não localizado)"}`);
    L.push(`🎸 Cifra: ${s.cifra_url || "(não localizado)"}`);
  }
  if (team.length) {
    const byRole = new Map<string, string[]>();
    for (const t of team) byRole.set(t.role || "Equipe", [...(byRole.get(t.role || "Equipe") ?? []), t.name]);
    L.push("", "👥 *ESCALA*", ...[...byRole].map(([r, ns]) => `${r}: ${ns.join(", ")}`));
  }
  const share = L.join("\n");

  const slotPeople: SlotPerson[] = members.map((m) => ({ id: Number(m.id), name: m.name, roles: splitRoles(m.roles) }));
  const busy = team.map((t) => Number(t.member_id));
  const away = (await all<{ member_id: number }>("SELECT member_id FROM availability WHERE service_id=? AND available=0", [id])).map((a) => Number(a.member_id));
  const awayTeam = team.filter((t) => away.includes(Number(t.member_id)));
  const roleOrder = (r: string) => (FUNCOES.indexOf(r) < 0 ? 99 : FUNCOES.indexOf(r));
  team.sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.sm_id - b.sm_id);
  const month = service.date.slice(0, 7);
  const auto = lider && service.date >= today() ? await monthData(month) : null;
  const roleOptions = [...new Set([...FUNCOES, ...members.flatMap((m) => splitRoles(m.roles))])];

  return (
    <>
      {lider ? (
        <AutoForm action={updateService} className="sheet-head">
          <input type="hidden" name="id" value={id} />
          <input className="title-in" type="text" name="title" defaultValue={service.title} placeholder="Nome do culto (ex.: Domingo, Apresentação de Filhos)" aria-label="Nome do culto" />
          <label className="f">Data<input type="date" name="date" defaultValue={service.date} required /></label>
        </AutoForm>
      ) : (
        <div className="sheet-head ro-head">
          <h2>{service.title}</h2>
          <span className="muted">{dayName(service.date)} {ddmm(service.date)}/{service.date.slice(0, 4)}</span>
        </div>
      )}

      {service.notes && !ministro && <p className="notes">{service.notes}</p>}
      {service.notes && ministro && (
        <AutoForm action={updateServiceNotes}>
          <input type="hidden" name="id" value={id} />
          <label className="f">Observações<textarea name="notes" rows={2} defaultValue={service.notes} /></label>
        </AutoForm>
      )}

      <div className="sec">
        <Repertoire readOnly={!ministro} serviceId={id} items={items} songs={songs} links={links} driveReady={drive.length > 0}
          twins={twins.map((t) => ({ id: Number(t.id), title: t.title }))} />
      </div>

      <div className="sec">
        <h3>Escala</h3>
        {lider && !official && team.length > 0 && (
          <p className="edit-hint">Rascunho: a equipe ainda não vê esta escala. Ela aparece para todos quando a escala do mês for aprovada em Montar escala.</p>
        )}
        {auto && <AutoEscala key={team.map((t) => t.sm_id).join()} serviceId={id} month={month} {...auto} />}
        {awayTeam.length > 0 && (
          <p className="notes" style={{ marginBottom: 10 }}>
            ⚠ {awayTeam.map((t) => `${t.name} (${t.role})`).join(", ")} marcou que não pode neste culto.{lider && " Troque na lista abaixo."}
          </p>
        )}
        {!lider ? (
          team.length ? (
            <dl className="esc-ro">
              {team.map((t) => (
                <div key={t.sm_id} style={{ display: "contents" }}>
                  <dt>{t.role || "—"}</dt>
                  <dd className={Number(t.member_id) === me.id ? "me" : undefined}>{t.name}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="muted">{official ? "Escala ainda não lançada." : "Escala em preparação: aparece aqui quando for aprovada."}</p>
        ) : (
        <div className="escala">
          {team.map((t) => (
            <form action={removeServiceMember} className="esc-row" key={t.sm_id}>
              <input type="hidden" name="service_id" value={id} />
              <input type="hidden" name="id" value={t.sm_id} />
              <span className="role-n">{t.role || "—"}</span>
              <SlotSelect serviceId={id} role={t.role} slotId={Number(t.sm_id)} current={Number(t.member_id)}
                people={slotPeople} busy={busy} away={away} change={setServiceMember} add={addServiceMember} />
              <button className="btn ghost icon" aria-label="Remover da escala">✕</button>
            </form>
          ))}
          {members.length === 0 ? (
            <p className="muted" style={{ fontSize: 14, margin: "4px 0 0" }}>
              Cadastre a equipe na aba <Link href="/equipe">Equipe</Link> para escalar as pessoas.
            </p>
          ) : (
            <AddSlot serviceId={id} roles={roleOptions} people={slotPeople} busy={busy} away={away} add={addServiceMember} />
          )}
        </div>
        )}
      </div>

      <div className="sec">
        <h3>Mensagem para o grupo</h3>
        <div className="out">
          <textarea readOnly value={share} aria-label="Mensagem gerada" />
          <div className="out-bar">
            <CopyButton text={share} />
            {lider && (
              <form action={deleteService} style={{ marginLeft: "auto" }}>
                <input type="hidden" name="id" value={id} />
                <ConfirmButton className="btn ghost small" message="Excluir este culto? O repertório e a escala dele serão apagados.">Excluir culto</ConfirmButton>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
