"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { setSongLink } from "../actions";

export type LinkOpt = { url: string; label: string; version: string };

/** Linha "Vozes [pasta do Drive ▾] abrir": troca o link da música na hora. */
export default function LinkPick({ songId, kind, current, opts }: { songId: number; kind: "vozes" | "cifra"; current: string; opts: LinkOpt[] }) {
  const [val, setVal] = useState(current);
  const [seen, setSeen] = useState(current);
  const [pending, start] = useTransition();
  if (current !== seen) { setSeen(current); setVal(current); }

  const list = val && !opts.some((o) => o.url === val) ? [{ url: val, label: "link colado à mão", version: "" }, ...opts] : opts;
  const name = kind === "vozes" ? "Vozes" : "Cifra";

  return (
    <div className={`link-row${pending ? " saving" : ""}`}>
      <b>{name}</b>
      {list.length === 0 ? (
        <span className="link-none">
          <span className="chip miss">não achei no Drive</span>
          <Link href={`/musicas/${songId}`} className="muted">colar link</Link>
        </span>
      ) : (
        <select
          className={`slot${val ? "" : " empty"}`}
          value={val}
          aria-label={kind === "vozes" ? "Pasta de vozes" : "Cifra"}
          onChange={(e) => {
            const url = e.target.value;
            setVal(url);
            start(() => setSongLink(songId, kind, url));
          }}
        >
          <option value="">{val ? "— tirar o link —" : `escolher ${kind === "vozes" ? "pasta de vozes" : "cifra"}… (${opts.length})`}</option>
          {list.map((o) => <option key={o.url} value={o.url}>{o.label}</option>)}
        </select>
      )}
      <span className="link-side">
        {val && <a className="chip ok" href={val} target="_blank" rel="noopener">abrir</a>}
      </span>
    </div>
  );
}
