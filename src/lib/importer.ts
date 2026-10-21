import { all } from "./db";
import { driveItems, type DriveItem } from "./drive";
import { cifraHits, confidentCifra } from "./match";

export type Opt = { url: string; name: string; keyOk: boolean | null };
/** Pasta de vozes que ainda não é música do catálogo. `cifra` = sugestão segura (pode vir vazia). */
export type NewVozes = { id: string; name: string; url: string; title: string; song_key: string; version: string; cifra: string; opts: Opt[] };
/** Arquivo de cifra que nenhuma música usa. `target` = música sem cifra que combina com ele. */
export type LooseCifra = { id: string; name: string; url: string; title: string; song_key: string; folder: string; target?: { id: number; title: string; song_key: string } };
/** Link de música que não existe mais nas pastas do Drive. */
export type Broken = { id: number; title: string; song_key: string; kind: "vozes" | "cifra" };

type S = { id: number; title: string; song_key: string; vozes_url: string; cifra_url: string };

/** Diferenças entre as pastas do Drive (última leitura) e o catálogo de músicas. */
export async function driveNews() {
  const items = await driveItems();
  const songs = await all<S>("SELECT id, title, song_key, vozes_url, cifra_url FROM songs ORDER BY title");
  const ignored = new Set((await all<{ id: string }>("SELECT id FROM drive_ignored")).map((r) => r.id));
  const usedVozes = new Set(songs.map((s) => s.vozes_url).filter(Boolean));
  const usedCifras = new Set(songs.map((s) => s.cifra_url).filter(Boolean));
  const cifras = items.filter((i) => i.kind === "cifra");
  const urls = new Set(items.map((i) => i.url));

  const vozes: NewVozes[] = items
    .filter((i) => i.kind === "vozes" && !usedVozes.has(i.url) && !ignored.has(i.id))
    .map((v) => ({
      id: v.id, name: v.name, url: v.url, title: v.title, song_key: v.song_key, version: v.version,
      cifra: confidentCifra(v.title, v.song_key, cifras)?.url ?? "",
      opts: cifraHits(v.title, v.song_key, cifras).slice(0, 5).map((h) => ({ url: h.url, name: h.name, keyOk: h.keyOk })),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const noCifra = songs.filter((s) => !s.cifra_url);
  const loose: LooseCifra[] = cifras
    .filter((c) => !usedCifras.has(c.url) && !ignored.has(c.id))
    .map((c: DriveItem) => {
      let target: LooseCifra["target"];
      let best = 0;
      for (const s of noCifra) {
        // mesma regra da ligação automática: nome muito parecido e tom compatível
        const h = confidentCifra(s.title, s.song_key, [c]);
        if (h && h.score > best) {
          best = h.score;
          target = { id: Number(s.id), title: s.title, song_key: s.song_key };
        }
      }
      return { id: c.id, name: c.name, url: c.url, title: c.title, song_key: c.song_key, folder: c.folder, target };
    })
    .sort((a, b) => Number(!!b.target) - Number(!!a.target) || a.title.localeCompare(b.title));

  // só faz sentido avisar de link quebrado se o Drive já foi lido
  const broken: Broken[] = items.length
    ? songs.flatMap((s) => [
        ...(s.vozes_url.includes("drive.google.com") && !urls.has(s.vozes_url) ? [{ id: Number(s.id), title: s.title, song_key: s.song_key, kind: "vozes" as const }] : []),
        ...(s.cifra_url.includes("drive.google.com") && !urls.has(s.cifra_url) ? [{ id: Number(s.id), title: s.title, song_key: s.song_key, kind: "cifra" as const }] : []),
      ])
    : [];

  return { vozes, loose, broken, ignored: ignored.size, total: vozes.length + loose.length + broken.length };
}
