import { notFound } from "next/navigation";
import { one, type Song } from "@/lib/db";
import { deleteSong } from "../../actions";
import SongForm from "../SongForm";
import ConfirmButton from "../../ConfirmButton";
import CifraSuggest from "../../CifraSuggest";

export const dynamic = "force-dynamic";

export default async function EditSong({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const song = await one<Song>("SELECT * FROM songs WHERE id=?", [Number(id)]);
  if (!song) notFound();
  return (
    <div className="sheet narrow" style={{ padding: 0 }}>
      {!song.cifra_url && (
        <div style={{ padding: "18px 22px 0" }}><CifraSuggest songId={song.id} songKey={song.song_key} open /></div>
      )}
      <SongForm song={song} />
      <form action={deleteSong} style={{ padding: "0 22px 22px" }}>
        <input type="hidden" name="id" value={song.id} />
        <ConfirmButton className="btn ghost small" message={`Excluir “${song.title}” do catálogo? Ela também sai dos repertórios dos cultos.`}>
          Excluir do catálogo
        </ConfirmButton>
      </form>
    </div>
  );
}
