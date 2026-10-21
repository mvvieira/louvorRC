import Link from "next/link";
import { saveSong } from "../actions";
import type { Song } from "@/lib/db";

export default function SongForm({ song, cancel }: { song?: Song; cancel?: React.ReactNode }) {
  return (
    <form action={saveSong} className="dlg">
      <h2 style={{ fontSize: 22 }}>{song ? "Editar música" : "Nova música"}</h2>
      {song && <input type="hidden" name="id" value={song.id} />}
      <label className="f">Nome<input type="text" name="title" defaultValue={song?.title} required /></label>
      <div className="grid2">
        <label className="f">Tom<input type="text" name="song_key" defaultValue={song?.song_key} placeholder="ex.: B, Gb, Bm" /></label>
        <label className="f">Versão
          <select name="version" defaultValue={song?.version ?? ""}>
            <option value="">—</option><option value="MASCULINO">Masculina</option><option value="FEMININO">Feminina</option>
          </select>
        </label>
        <label className="f">Artista<input type="text" name="artist" defaultValue={song?.artist} /></label>
      </div>
      <label className="f">Link da pasta de vozes<input type="url" name="vozes_url" defaultValue={song?.vozes_url} placeholder="https://drive.google.com/drive/folders/…" /></label>
      <label className="f">Link da cifra<input type="url" name="cifra_url" defaultValue={song?.cifra_url} placeholder="https://drive.google.com/file/d/…" /></label>
      <label className="f">Observação<input type="text" name="notes" defaultValue={song?.notes} /></label>
      <div className="dlg-foot">
        <span />
        <span>
          {cancel ?? <Link className="btn" href="/musicas">Cancelar</Link>}
          <button className="btn primary">Salvar música</button>
        </span>
      </div>
    </form>
  );
}
