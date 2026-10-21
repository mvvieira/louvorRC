"use client";
import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { searchScore } from "@/lib/match";
import LinkPick, { type LinkOpt } from "./LinkPick";
import {
  addSongToService, createSongForService, fillServiceLinks, pasteSongList, removeServiceSongItem, reorderServiceSongs,
} from "../actions";

export type { LinkOpt };
/** `auto` = quantos links o "Completar" consegue preencher sem dúvida de tom. */
export type SongLinks = { vozes: LinkOpt[]; cifras: LinkOpt[]; auto: number };

export type RepSong = { id: number; title: string; song_key: string; version: string; artist: string; vozes_url: string; cifra_url: string };
export type RepItem = RepSong & { ss_id: number };

type Op = { type: "add"; item: RepItem } | { type: "remove"; ssId: number } | { type: "order"; ids: number[] };

const vc = (v: string) => (v === "MASCULINO" ? "m" : v === "FEMININO" ? "f" : "");
let tempId = -1;

/** Repertório do culto: busca, colar lista, arrastar para reordenar. Tudo aparece na hora e salva em seguida. */
export default function Repertoire({ serviceId, items, songs, links, driveReady, twins = [] }: {
  serviceId: number; items: RepItem[]; songs: RepSong[]; links: Record<number, SongLinks>; driveReady: boolean;
  /** cultos do mesmo domingo que cantam este mesmo repertório */
  twins?: { id: number; title: string }[];
}) {
  const [list, apply] = useOptimistic(items, (cur: RepItem[], op: Op) => {
    if (op.type === "add") return [...cur, op.item];
    if (op.type === "remove") return cur.filter((x) => x.ss_id !== op.ssId);
    const byId = new Map(cur.map((x) => [x.ss_id, x]));
    return op.ids.map((id) => byId.get(id)!).filter(Boolean);
  });
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [act, setAct] = useState(0);
  const [open, setOpen] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [filling, setFilling] = useState<string | null>(null);

  const inList = new Set(list.map((x) => x.id));
  const nq = q.trim();
  const results = nq
    ? songs.map((s) => [searchScore(nq, s.title, s.artist), s] as const).filter(([sc]) => sc > 0)
        .sort((a, b) => b[0] - a[0] || a[1].title.localeCompare(b[1].title)).slice(0, 8).map(([, s]) => s)
    : [];
  const canCreate = nq.length > 1 && !results.some((s) => searchScore(nq, s.title) >= 90);
  const options = results.length + (canCreate ? 1 : 0);

  const add = (s: RepSong) => {
    setQ(""); setAct(0);
    start(async () => {
      apply({ type: "add", item: { ...s, ss_id: tempId-- } });
      await addSongToService(serviceId, s.id);
    });
    input.current?.focus();
  };
  const create = (title: string) => {
    setQ(""); setAct(0);
    setMissing((m) => m.filter((x) => x !== title));
    start(async () => {
      apply({ type: "add", item: { id: tempId, title, song_key: "", version: "", artist: "", vozes_url: "", cifra_url: "", ss_id: tempId-- } });
      await createSongForService(serviceId, title);
    });
    input.current?.focus();
  };
  const remove = (ssId: number) => start(async () => {
    apply({ type: "remove", ssId });
    await removeServiceSongItem(ssId);
  });
  const reorder = (ids: number[]) => start(async () => {
    apply({ type: "order", ids });
    await reorderServiceSongs(serviceId, ids);
  });
  const move = (i: number, j: number) => {
    if (j < 0 || j >= list.length || i === j) return;
    const ids = list.map((x) => x.ss_id);
    const [x] = ids.splice(i, 1);
    ids.splice(j, 0, x);
    reorder(ids);
  };
  const paste = (text: string) => {
    setQ(""); setPasting(true);
    start(async () => {
      const miss = await pasteSongList(serviceId, text);
      setMissing((m) => [...new Set([...m, ...miss])]);
      setPasting(false);
    });
  };
  // links que faltam e que o Drive tem no mesmo tom
  const fillable = list.reduce((n, s) => n + (links[s.id]?.auto ?? 0), 0);
  const fill = () => {
    setFilling("Procurando no Drive…");
    start(async () => {
      const n = await fillServiceLinks(serviceId);
      setFilling(n ? `${n} link${n === 1 ? "" : "s"} preenchido${n === 1 ? "" : "s"}. Confira nas listas abaixo de cada música.` : "Nada novo para preencher.");
    });
  };
  const choose = (i: number) => (i < results.length ? add(results[i]) : canCreate && create(q.trim()));

  return (
    <>
      <h3>Repertório <small>{list.length} música{list.length === 1 ? "" : "s"}</small></h3>
      {twins.length > 0 && (
        <p className="twin-note">
          🔗 Mesmo repertório do{" "}
          {twins.map((t, i) => <span key={t.id}>{i > 0 && " e do "}<Link href={`/cultos/${t.id}`}>{t.title}</Link></span>)}
          : o que mudar aqui muda lá também.
        </p>
      )}
      {(fillable > 0 || filling) && (
        <div className="fill-bar">
          {fillable > 0 && (
            <button type="button" className="btn small primary" onClick={fill}>
              Completar {fillable} link{fillable === 1 ? "" : "s"} com o Drive
            </button>
          )}
          {filling && <span className="muted">{filling}</span>}
        </div>
      )}
      {!driveReady && <p className="picker-hint">As pastas do Drive ainda não foram lidas: abra <Link href="/musicas/importar">Músicas › Importar do Drive</Link> e toque em “Ler o Drive agora”.</p>}
      <ol className="setlist">
        {list.length === 0 && <li className="none">Nenhuma música ainda. Busque abaixo pelo nome ou cole a lista inteira.</li>}
        {list.map((s, i) => {
          const temp = s.ss_id < 0;
          return (
            <li
              key={s.ss_id}
              className={`set${drag === i ? " dragging" : ""}${over === i && drag !== null && drag !== i ? (drag < i ? " drop-after" : " drop-before") : ""}${temp ? " saving" : ""}`}
              draggable={!temp}
              onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { e.preventDefault(); if (over !== i) setOver(i); }}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
            >
              <span className="n" title="Arraste para mudar a ordem"><span className="grip" aria-hidden="true">⠿</span>{i + 1}</span>
              <div>
                <div className="name">{s.title}</div>
                <div className="links-state">
                  {s.song_key && <span className={`chip ${vc(s.version)}`}>{s.song_key}</span>}
                  {s.version && <span className={`chip ${vc(s.version)}`}>{s.version === "MASCULINO" ? "Masc" : "Fem"}</span>}
                  {temp && <span className="chip">salvando…</span>}
                </div>
                {!temp && links[s.id] && (
                  <div className="links-pick">
                    <LinkPick songId={s.id} kind="vozes" current={s.vozes_url} opts={links[s.id].vozes} />
                    <LinkPick songId={s.id} kind="cifra" current={s.cifra_url} opts={links[s.id].cifras} />
                  </div>
                )}
              </div>
              <div className="side">
                <button type="button" className="btn ghost icon" aria-label="Subir" disabled={temp || i === 0} onClick={() => move(i, i - 1)}>↑</button>
                <button type="button" className="btn ghost icon" aria-label="Descer" disabled={temp || i === list.length - 1} onClick={() => move(i, i + 1)}>↓</button>
                <button type="button" className="btn ghost icon" aria-label="Remover" disabled={temp} onClick={() => remove(s.ss_id)}>✕</button>
              </div>
            </li>
          );
        })}
        {pasting && <li className="none">Procurando as músicas da lista…</li>}
      </ol>

      <div className="picker">
        <input
          ref={input}
          type="search"
          value={q}
          placeholder="Buscar música para adicionar… (ou cole a lista inteira)"
          autoComplete="off"
          aria-label="Adicionar música"
          onChange={(e) => { setQ(e.target.value); setAct(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (text.includes("\n")) { e.preventDefault(); paste(text); }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { setAct((a) => Math.min(a + 1, options - 1)); e.preventDefault(); }
            else if (e.key === "ArrowUp") { setAct((a) => Math.max(a - 1, 0)); e.preventDefault(); }
            else if (e.key === "Enter" && options) { choose(act); e.preventDefault(); }
            else if (e.key === "Escape") { setQ(""); setOpen(false); }
          }}
        />
        {open && nq && (
          <div className="results">
            {results.map((s, i) => (
              <button type="button" key={s.id} className={i === act ? "act" : undefined}
                onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)} onMouseEnter={() => setAct(i)}>
                <span>{s.title}{inList.has(s.id) && <span className="k"> · já está no repertório</span>}</span>
                <span className="k">{[s.song_key, s.version === "MASCULINO" ? "masc" : s.version === "FEMININO" ? "fem" : "", s.cifra_url ? "🎸" : "sem cifra"].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
            {canCreate && (
              <button type="button" className={act === results.length ? "act" : undefined}
                onMouseDown={(e) => e.preventDefault()} onClick={() => create(q.trim())} onMouseEnter={() => setAct(results.length)}>
                <span>Cadastrar “{q.trim()}” no catálogo e adicionar</span><span className="k">nova</span>
              </button>
            )}
          </div>
        )}
      </div>
      <p className="picker-hint">Enter adiciona e já deixa pronto para a próxima · arraste ⠿ para mudar a ordem</p>

      {missing.length > 0 && (
        <div className="missing-box">
          <span>Não localizado no catálogo:</span>
          {missing.map((m) => (
            <button type="button" key={m} className="chip miss" onClick={() => create(m)} title="Cadastrar e adicionar">+ {m}</button>
          ))}
          <button type="button" className="btn ghost small" onClick={() => setMissing([])}>Dispensar</button>
        </div>
      )}
    </>
  );
}
