"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { setSongCifra, suggestCifras, type CifraSuggestion } from "./actions";

/** Chip "Cifra: sem link" que procura no Drive arquivos com nome parecido e liga com um clique. */
export default function CifraSuggest({ songId, songKey, open: startOpen = false }: { songId: number; songKey?: string; open?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const [hits, setHits] = useState<CifraSuggestion[] | null>(null);
  const [pending, start] = useTransition();

  const load = () => start(async () => setHits(await suggestCifras(songId)));
  useEffect(() => {
    if (startOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <span className="suggest">
      <button type="button" className="chip miss" aria-expanded={open}
        onClick={() => { setOpen(!open); if (!hits) load(); }}>
        Cifra: sem link · procurar
      </button>
      {open && (
        <span className="suggest-box">
          {pending && !hits && <span className="muted">Procurando no Drive…</span>}
          {hits?.length === 0 && <span className="muted">Nada parecido nas pastas de cifra.</span>}
          {hits?.map((h) => (
            <span key={h.url} className="suggest-row">
              <a href={h.url} target="_blank" rel="noopener" className="suggest-name" title="Abrir para conferir">{h.name}</a>
              {h.keyOk === true && <span className="chip ok">tom {songKey}</span>}
              {h.keyOk === false && <span className="chip miss">outro tom</span>}
              <button type="button" className="btn small primary" disabled={pending}
                onClick={() => start(async () => { await setSongCifra(songId, h.url); setOpen(false); })}>
                Usar
              </button>
            </span>
          ))}
          <Link href={`/musicas/${songId}`} className="suggest-manual">Colar o link na mão</Link>
        </span>
      )}
    </span>
  );
}
