import { all, db } from "./db";
import { serviceType } from "./roles";

type Svc = { id: number; date: string; title: string };

/** Cultos de domingo do mesmo dia (manhã e noite) cantam o mesmo repertório. */
export async function repertoireSiblings(serviceId: number): Promise<Svc[]> {
  const rows = await all<Svc>(
    "SELECT o.id, o.date, o.title FROM services s JOIN services o ON o.date=s.date AND o.id<>s.id WHERE s.id=? ORDER BY o.id",
    [serviceId],
  );
  const self = await all<Svc>("SELECT id, date, title FROM services WHERE id=?", [serviceId]);
  if (!self[0] || serviceType(self[0].title)[0] !== "dom") return [];
  return rows.filter((o) => serviceType(o.title)[0] === "dom");
}

/** Copia o repertório (músicas e ordem) deste culto para os cultos irmãos do mesmo domingo. */
export async function syncRepertoire(serviceId: number) {
  const sibs = await repertoireSiblings(serviceId);
  if (!sibs.length) return;
  const songs = await all<{ song_id: number }>(
    "SELECT song_id FROM service_songs WHERE service_id=? ORDER BY position, id",
    [serviceId],
  );
  const c = await db();
  await c.batch(
    sibs.flatMap((o) => [
      { sql: "DELETE FROM service_songs WHERE service_id=?", args: [o.id] },
      ...songs.map((s, i) => ({
        sql: "INSERT INTO service_songs (service_id, song_id, position) VALUES (?,?,?)",
        args: [o.id, s.song_id, i + 1],
      })),
    ]),
    "write",
  );
}

/** Culto de domingo novo (ou com data trocada) e vazio: herda o repertório do irmão do mesmo dia. */
export async function pullRepertoire(serviceId: number) {
  const own = await all<{ n: number }>("SELECT COUNT(*) AS n FROM service_songs WHERE service_id=?", [serviceId]);
  if (Number(own[0]?.n ?? 0) > 0) return;
  for (const o of await repertoireSiblings(serviceId)) {
    const n = await all<{ n: number }>("SELECT COUNT(*) AS n FROM service_songs WHERE service_id=?", [o.id]);
    if (Number(n[0]?.n ?? 0) > 0) return syncRepertoire(o.id);
  }
}
