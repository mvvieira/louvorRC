import Link from "next/link";
import { can, pageUser } from "@/lib/auth";
import { all, type Song } from "@/lib/db";
import { driveNews } from "@/lib/importer";
import SongForm from "./SongForm";
import SongTable from "./SongTable";
import NewSongDialog, { CloseDialog } from "./NewSongDialog";

export const dynamic = "force-dynamic";

export default async function Musicas() {
  const me = await pageUser();
  const lider = can(me, "lider");
  const songs = await all<Song>("SELECT * FROM songs ORDER BY title");
  const news = lider ? await driveNews() : { total: 0, vozes: [], loose: [], broken: [] };
  return (
    <>
      {news.total > 0 && (
        <Link href="/musicas/importar" className="imp-banner">
          <b>{news.total} novidade{news.total === 1 ? "" : "s"} no Drive</b>
          <span>
            {[
              news.vozes.length && `${news.vozes.length} música${news.vozes.length === 1 ? "" : "s"} nova${news.vozes.length === 1 ? "" : "s"}`,
              news.loose.length && `${news.loose.length} cifra${news.loose.length === 1 ? "" : "s"} sem música`,
              news.broken.length && `${news.broken.length} link${news.broken.length === 1 ? "" : "s"} quebrado${news.broken.length === 1 ? "" : "s"}`,
            ].filter(Boolean).join(" · ")}
          </span>
          <span className="go">Revisar e importar →</span>
        </Link>
      )}
      <SongTable songs={songs}>
        {can(me, "ministro") && <NewSongDialog><SongForm cancel={<CloseDialog />} /></NewSongDialog>}
        {lider && <Link className="btn" href="/musicas/importar">Importar do Drive</Link>}
      </SongTable>
    </>
  );
}
