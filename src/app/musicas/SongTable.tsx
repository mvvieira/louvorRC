"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalize } from "@/lib/text";
import type { Song } from "@/lib/db";

export default function SongTable({ songs, children }: { songs: Song[]; children: React.ReactNode }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [f, setF] = useState("");
  const nq = normalize(q);
  let list = songs.filter((s) => normalize(`${s.title} ${s.artist}`).includes(nq));
  if (f === "semvozes") list = list.filter((s) => !s.vozes_url);
  if (f === "semcifra") list = list.filter((s) => !s.cifra_url);
  if (f === "completas") list = list.filter((s) => s.vozes_url && s.cifra_url);
  const complete = songs.filter((s) => s.vozes_url && s.cifra_url).length;
  const open = (id: number) => router.push(`/musicas/${id}`);
  const vc = (v: string) => (v === "MASCULINO" ? "m" : v === "FEMININO" ? "f" : "");

  return (
    <>
      <div className="tools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar música…" aria-label="Buscar música" />
        <select value={f} onChange={(e) => setF(e.target.value)} aria-label="Filtro">
          <option value="">Todas</option>
          <option value="semvozes">Sem link de vozes</option>
          <option value="semcifra">Sem link de cifra</option>
          <option value="completas">Com vozes e cifra</option>
        </select>
        {children}
        <span className="count">{list.length} de {songs.length} · {complete} com vozes e cifra</span>
      </div>
      <div className="table-wrap">
        <table className="songs">
          <thead><tr><th>Música</th><th>Tom</th><th>Versão</th><th>Vozes</th><th>Cifra</th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} data-href tabIndex={0} onClick={() => open(s.id)} onKeyDown={(e) => e.key === "Enter" && open(s.id)}>
                <td><b>{s.title}</b>{s.artist && <span className="muted"> · {s.artist}</span>}</td>
                <td className={`k ${vc(s.version)}`}>{s.song_key}</td>
                <td className="muted">{s.version === "MASCULINO" ? "Masculina" : s.version === "FEMININO" ? "Feminina" : ""}</td>
                <td>{s.vozes_url ? <span className="chip ok">ok</span> : <span className="chip miss">falta</span>}</td>
                <td>{s.cifra_url ? <span className="chip ok">ok</span> : <span className="chip miss">falta</span>}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="muted">Nenhuma música encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
