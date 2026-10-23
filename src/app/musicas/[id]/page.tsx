import { notFound } from "next/navigation";
import { can, pageUser } from "@/lib/auth";
import { one, type Song } from "@/lib/db";
import { deleteSong } from "../../actions";
import SongForm from "../SongForm";
import ConfirmButton from "../../ConfirmButton";
import CifraSuggest from "../../CifraSuggest";

export const dynamic = "force-dynamic";

export default async function EditSong({ params }: { params: Promise<{ id: string }> }) {
  const me = await pageUser();
  const { id } = await params;
  const song = await one<Song>("SELECT * FROM songs WHERE id=?", [Number(id)]);
  if (!song) notFound();
  if (!can(me, "ministro")) {
    const ver = song.version === "MASCULINO" ? "Masculino" : song.version === "FEMININO" ? "Feminino" : "";
    return (
      <div className="sheet narrow song-ro">
        <h2>{song.title}</h2>
        <p className="muted">{[song.song_key && `Tom ${song.song_key}`, ver, song.artist].filter(Boolean).join(" · ")}</p>
        <p className="links-state">
          {song.vozes_url ? <a className="chip ok" href={song.vozes_url} target="_blank" rel="noopener">🎤 vozes</a> : <span className="chip miss">vozes: não localizado</span>}
          {song.cifra_url ? <a className="chip ok" href={song.cifra_url} target="_blank" rel="noopener">🎸 cifra</a> : <span className="chip miss">cifra: não localizado</span>}
        </p>
        {song.notes && <p className="notes">{song.notes}</p>}
      </div>
    );
  }
  return (
    <div className="sheet narrow" style={{ padding: 0 }}>
      {!song.cifra_url && (
        <div style={{ padding: "18px 22px 0" }}><CifraSuggest songId={song.id} songKey={song.song_key} open /></div>
      )}
      <SongForm song={song} />
      {can(me, "lider") && (
        <form action={deleteSong} style={{ padding: "0 22px 22px" }}>
          <input type="hidden" name="id" value={song.id} />
          <ConfirmButton className="btn ghost small" message={`Excluir “${song.title}” do catálogo? Ela também sai dos repertórios dos cultos.`}>
            Excluir do catálogo
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
