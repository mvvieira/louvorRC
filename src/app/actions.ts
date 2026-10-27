"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { badPassword, checkSecret, COOKIE, currentUser, hashSecret, INITIAL_PASSWORD, requireLevel, requireSelf, seesAccessLog } from "@/lib/auth";
import { redirect } from "next/navigation";
import { all, db, newToken, one, run, type Access, type Song } from "@/lib/db";
import { cifraHits } from "@/lib/match";
import { driveItems } from "@/lib/drive";
import { linkHits, parseQueryLine, rankBy } from "@/lib/finder";
import { pullRepertoire, syncRepertoire } from "@/lib/repertoire";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(f.get(k));

/* ---------- Músicas ---------- */

export async function saveSong(f: FormData) {
  await requireLevel("ministro");
  const id = num(f, "id");
  const args = [
    str(f, "title"),
    str(f, "song_key"),
    str(f, "version").toUpperCase(),
    str(f, "artist"),
    str(f, "vozes_url"),
    str(f, "cifra_url"),
    str(f, "notes"),
  ];
  if (!args[0]) return;
  if (id) {
    await run(
      "UPDATE songs SET title=?, song_key=?, version=?, artist=?, vozes_url=?, cifra_url=?, notes=? WHERE id=?",
      [...args, id],
    );
  } else {
    await run(
      "INSERT INTO songs (title, song_key, version, artist, vozes_url, cifra_url, notes) VALUES (?,?,?,?,?,?,?)",
      args,
    );
  }
  revalidatePath("/", "layout");
  redirect("/musicas");
}

export async function deleteSong(f: FormData) {
  await requireLevel("lider");
  await run("DELETE FROM service_songs WHERE song_id=?", [num(f, "id")]);
  await run("DELETE FROM songs WHERE id=?", [num(f, "id")]);
  revalidatePath("/", "layout");
  redirect("/musicas");
}

/* ---------- Equipe ---------- */

export async function saveMember(f: FormData) {
  await requireLevel("lider");
  const id = num(f, "id");
  const name = str(f, "name");
  if (!name) return;
  if (id) {
    await run("UPDATE members SET name=?, roles=?, phone=? WHERE id=?", [name, str(f, "roles"), str(f, "phone"), id]);
  } else {
    // quem entra na equipe já nasce com a senha inicial (troca no 1º acesso)
    await run("INSERT INTO members (name, roles, phone, token, pin_hash, must_change) VALUES (?,?,?,?,?,1)", [name, str(f, "roles"), str(f, "phone"), newToken(), hashSecret(INITIAL_PASSWORD)]);
  }
  revalidatePath("/", "layout");
}

export async function deleteMember(f: FormData) {
  await requireLevel("lider");
  await run("DELETE FROM service_members WHERE member_id=?", [num(f, "id")]);
  await run("DELETE FROM members WHERE id=?", [num(f, "id")]);
  revalidatePath("/", "layout");
}

/* ---------- Cultos ---------- */

export async function createService(f: FormData) {
  await requireLevel("lider");
  const date = str(f, "date");
  if (!date) return;
  const r = await run("INSERT INTO services (date, title) VALUES (?, ?)", [date, str(f, "title") || "Culto"]);
  const id = Number(r.lastInsertRowid);
  const list = str(f, "list");
  if (list) {
    await addSongsFromList(id, list);
    await syncRepertoire(id);
  } else await pullRepertoire(id);
  redirect(`/cultos/${id}`);
}

export async function updateService(f: FormData) {
  await requireLevel("lider");
  const id = num(f, "id");
  const date = str(f, "date");
  if (!date) return;
  await run("UPDATE services SET date=?, title=? WHERE id=?", [date, str(f, "title") || "Culto", id]);
  await pullRepertoire(id);
  revalidatePath("/", "layout");
}

export async function updateServiceNotes(f: FormData) {
  await requireLevel("ministro");
  await run("UPDATE services SET notes=? WHERE id=?", [str(f, "notes"), num(f, "id")]);
  revalidatePath("/", "layout");
}

export async function deleteService(f: FormData) {
  await requireLevel("lider");
  const id = num(f, "id");
  await run("DELETE FROM service_songs WHERE service_id=?", [id]);
  await run("DELETE FROM service_members WHERE service_id=?", [id]);
  await run("DELETE FROM services WHERE id=?", [id]);
  revalidatePath("/", "layout");
  redirect("/cultos");
}

async function nextPosition(serviceId: number) {
  const r = await one<{ p: number | null }>("SELECT MAX(position) AS p FROM service_songs WHERE service_id=?", [serviceId]);
  return Number(r?.p ?? 0) + 1;
}

/** Recebe uma lista colada (uma música por linha, aceita "✅ Gratidão Db (Giovanni)") e casa com o catálogo. */
async function addSongsFromList(serviceId: number, list: string, noteMissing = true): Promise<string[]> {
  const songs = await all<Song>("SELECT * FROM songs");
  let pos = await nextPosition(serviceId);
  const missing: string[] = [];
  for (const line of list.split(/\r?\n/)) {
    const q = parseQueryLine(line);
    if (!q) continue;
    const [best] = rankBy(q, songs);
    if (best && best.score >= 60) {
      await run("INSERT INTO service_songs (service_id, song_id, position) VALUES (?,?,?)", [serviceId, best.id, pos++]);
    } else missing.push([q.title, q.key, q.version === "FEMININO" ? "Fem" : q.version === "MASCULINO" ? "Masc" : ""].filter(Boolean).join(" "));
  }
  if (missing.length && noteMissing) {
    await run("UPDATE services SET notes = TRIM(notes || ?, char(10) || ' ') WHERE id=?", [
      `\nNão localizadas no catálogo: ${missing.join("; ")}`,
      serviceId,
    ]);
  }
  return missing;
}

export async function addServiceMember(f: FormData) {
  await requireLevel("lider");
  const id = num(f, "service_id");
  const memberId = num(f, "member_id");
  if (!memberId) return;
  await run("INSERT INTO service_members (service_id, member_id, role) VALUES (?,?,?)", [id, memberId, str(f, "role")]);
  revalidatePath("/", "layout");
}

export async function removeServiceMember(f: FormData) {
  await requireLevel("lider");
  await run("DELETE FROM service_members WHERE id=?", [num(f, "id")]);
  revalidatePath("/", "layout");
}

/** Troca a pessoa de uma posição da escala; sem pessoa, tira a posição. */
export async function setServiceMember(f: FormData) {
  await requireLevel("lider");
  const id = num(f, "id");
  const memberId = num(f, "member_id");
  if (memberId) await run("UPDATE service_members SET member_id=? WHERE id=?", [memberId, id]);
  else await run("DELETE FROM service_members WHERE id=?", [id]);
  revalidatePath("/", "layout");
}

/* ---------- Repertório (editor do culto) ---------- */

/** Adiciona uma música ao fim do repertório e devolve o id da linha. */
export async function addSongToService(serviceId: number, songId: number): Promise<number> {
  await requireLevel("ministro");
  const r = await run("INSERT INTO service_songs (service_id, song_id, position) VALUES (?,?,?)", [
    serviceId, songId, await nextPosition(serviceId),
  ]);
  await syncRepertoire(serviceId);
  revalidatePath("/", "layout");
  return Number(r.lastInsertRowid);
}

/** Cadastra uma música nova no catálogo e já põe no repertório. Tom/versão vêm do texto; links, do Drive. */
export async function createSongForService(serviceId: number, title: string): Promise<number> {
  await requireLevel("ministro");
  const q = parseQueryLine(title);
  if (!q) return 0;
  const hits = linkHits(q.title, q.key, q.version, await driveItems());
  const v = hits.vozes[0]?.score >= 70 ? hits.vozes[0] : undefined;
  const c = hits.cifras[0]?.score >= 70 ? hits.cifras[0] : undefined;
  const r = await run("INSERT INTO songs (title, song_key, version, vozes_url, cifra_url) VALUES (?,?,?,?,?)", [
    q.title, q.key || v?.song_key || "", q.version || v?.version || "", v?.url ?? "", c?.url ?? "",
  ]);
  return addSongToService(serviceId, Number(r.lastInsertRowid));
}

export async function removeServiceSongItem(id: number) {
  await requireLevel("ministro");
  const row = await one<{ service_id: number }>("SELECT service_id FROM service_songs WHERE id=?", [id]);
  await run("DELETE FROM service_songs WHERE id=?", [id]);
  if (row) await syncRepertoire(Number(row.service_id));
  revalidatePath("/", "layout");
}

/** Grava a ordem do repertório a partir da lista de ids na ordem nova. */
export async function reorderServiceSongs(serviceId: number, ids: number[]) {
  await requireLevel("ministro");
  for (let k = 0; k < ids.length; k++) {
    await run("UPDATE service_songs SET position=? WHERE id=? AND service_id=?", [k + 1, ids[k], serviceId]);
  }
  await syncRepertoire(serviceId);
  revalidatePath("/", "layout");
}

/** Lista colada: adiciona o que achar no catálogo e devolve o que não achou. */
export async function pasteSongList(serviceId: number, list: string): Promise<string[]> {
  await requireLevel("ministro");
  const missing = await addSongsFromList(serviceId, list, false);
  await syncRepertoire(serviceId);
  revalidatePath("/", "layout");
  return missing;
}

/* ---------- Cifras sugeridas do Drive ---------- */

export type CifraSuggestion = { url: string; name: string; score: number; keyOk: boolean | null };

/** Arquivos de cifra do Drive com nome parecido com a música. */
export async function suggestCifras(songId: number): Promise<CifraSuggestion[]> {
  await requireLevel("ministro");
  const song = await one<Song>("SELECT * FROM songs WHERE id=?", [songId]);
  if (!song) return [];
  const cifras = (await driveItems()).filter((i) => i.kind === "cifra");
  return cifraHits(song.title, song.song_key, cifras)
    .slice(0, 5)
    .map(({ url, name, score, keyOk }) => ({ url, name, score, keyOk }));
}

export async function setSongCifra(songId: number, url: string) {
  await requireLevel("ministro");
  await run("UPDATE songs SET cifra_url=? WHERE id=?", [url, songId]);
  revalidatePath("/", "layout");
}

/* ---------- Links do Drive no repertório ---------- */

/** Troca a pasta de vozes ou a cifra de uma música (vale para o catálogo todo). Tom/versão vazios vêm da pasta. */
export async function setSongLink(songId: number, kind: "vozes" | "cifra", url: string) {
  await requireLevel("ministro");
  const col = kind === "vozes" ? "vozes_url" : "cifra_url";
  await run(`UPDATE songs SET ${col}=? WHERE id=?`, [url, songId]);
  if (kind === "vozes" && url) {
    const it = await one<{ song_key: string; version: string }>("SELECT song_key, version FROM drive_items WHERE url=?", [url]);
    if (it) {
      await run(
        "UPDATE songs SET song_key = CASE WHEN song_key='' THEN ? ELSE song_key END, version = CASE WHEN version='' THEN ? ELSE version END WHERE id=?",
        [it.song_key, it.version, songId],
      );
    }
  }
  revalidatePath("/", "layout");
}

/** Preenche de uma vez os links que faltam no repertório com o melhor resultado do Drive. Devolve quantos ligou. */
export async function fillServiceLinks(serviceId: number): Promise<number> {
  await requireLevel("ministro");
  const songs = await all<Song>(
    "SELECT s.* FROM service_songs ss JOIN songs s ON s.id=ss.song_id WHERE ss.service_id=?",
    [serviceId],
  );
  const items = await driveItems();
  let n = 0;
  for (const s of songs) {
    if (s.vozes_url && s.cifra_url) continue;
    const h = linkHits(s.title, s.song_key, s.version, items);
    // tom diferente fica para alguém escolher na lista
    const ok = (x?: { song_key: string }) => x && (!s.song_key || !x.song_key || x.song_key.toLowerCase() === s.song_key.toLowerCase());
    const v = h.vozes[0], c = h.cifras[0];
    if (!s.vozes_url && ok(v)) { await setSongLink(s.id, "vozes", v.url); n++; }
    if (!s.cifra_url && ok(c)) { await setSongLink(s.id, "cifra", c.url); n++; }
  }
  revalidatePath("/", "layout");
  return n;
}

/* ---------- Disponibilidade ---------- */

/** 1 = disponível, 0 = indisponível, null = apaga a resposta. */
export async function setAvailability(memberId: number, serviceId: number, available: 0 | 1 | null) {
  await requireSelf(memberId);
  if (available === null) {
    await run("DELETE FROM availability WHERE member_id=? AND service_id=?", [memberId, serviceId]);
  } else {
    await run(
      `INSERT INTO availability (member_id, service_id, available) VALUES (?,?,?)
       ON CONFLICT(member_id, service_id) DO UPDATE SET available=excluded.available, updated_at=datetime('now')`,
      [memberId, serviceId, available],
    );
  }
  revalidatePath("/", "layout");
}

/** Marca (ou limpa) de uma vez os cultos ainda por vir do mês "AAAA-MM". */
export async function setMonthAvailability(memberId: number, month: string, available: 0 | 1 | null, from: string) {
  await requireSelf(memberId);
  const cs = await all<{ id: number }>("SELECT id FROM services WHERE date LIKE ? AND date >= ?", [`${month}-%`, from]);
  for (const c of cs) {
    if (available === null) await run("DELETE FROM availability WHERE member_id=? AND service_id=?", [memberId, c.id]);
    else await run(
      `INSERT INTO availability (member_id, service_id, available) VALUES (?,?,?)
       ON CONFLICT(member_id, service_id) DO UPDATE SET available=excluded.available, updated_at=datetime('now')`,
      [memberId, c.id, available],
    );
  }
  revalidatePath("/", "layout");
}

/* ---------- Distribuição automática da escala ---------- */

/** Lança na escala as posições revisadas na página Distribuir (não repete pessoa no mesmo culto). */
export async function applyDistribution(month: string, picks: { service_id: number; member_id: number; role: string }[], stay = false) {
  await requireLevel("lider");
  const c = await db();
  const res = await c.batch(
    picks.map((p) => ({
      sql: `INSERT INTO service_members (service_id, member_id, role)
            SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM service_members WHERE service_id=? AND member_id=?)`,
      args: [p.service_id, p.member_id, p.role, p.service_id, p.member_id],
    })),
    "write",
  );
  revalidatePath("/", "layout");
  if (stay) return; // na página do culto a escala atualiza no lugar
  redirect(`/escala/montar?m=${month}&done=${res.reduce((n, r) => n + r.rowsAffected, 0)}`);
}

/* ---------- Acesso ---------- */

/** Sai deste celular (volta para o "Quem é você?"). */
export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/entrar");
}

/** Liderança muda o nível de alguém (não dá para tirar a própria liderança por engano). */
export async function setMemberAccess(memberId: number, access: Access) {
  const me = await requireLevel("lider");
  if (!["lider", "ministro", "banda"].includes(access) || memberId === me.id) return;
  await run("UPDATE members SET access=? WHERE id=?", [access, memberId]);
  revalidatePath("/", "layout");
}


/** Qualquer pessoa troca a própria senha (confirmando a atual). */
export async function changeMyPassword(current: string, next: string): Promise<{ ok: true } | { error: string }> {
  const me = await currentUser();
  if (!me) return { error: "Entre de novo no app." };
  const row = await one<{ pin_hash: string }>("SELECT pin_hash FROM members WHERE id=?", [me.id]);
  if (row?.pin_hash && !checkSecret(current, row.pin_hash)) return { error: "A senha atual não confere." };
  const bad = badPassword(next);
  if (bad) return { error: bad };
  await run("UPDATE members SET pin_hash=?, must_change=0, pin_fails=0, pin_until='' WHERE id=?", [hashSecret(next), me.id]);
  return { ok: true };
}

/** Esqueceu a senha: volta para a inicial (troca obrigatória no próximo acesso) e desconecta os aparelhos da pessoa. */
export async function resetMemberPassword(memberId: number) {
  const me = await requireLevel("lider");
  if (!(await seesAccessLog(me))) throw new Error("Sem permissão para zerar senhas.");
  await run("UPDATE members SET pin_hash=?, must_change=1, pin_fails=0, pin_until='', token=? WHERE id=?", [
    hashSecret(INITIAL_PASSWORD), newToken(), memberId,
  ]);
  revalidatePath("/", "layout");
}
