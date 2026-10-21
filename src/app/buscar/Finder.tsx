"use client";

import { useMemo, useState, useTransition } from "react";
import type { Hit, Result } from "@/lib/finder";
import { saveAsService, searchLinks, syncNow } from "./actions";
import CopyButton from "../CopyButton";
import { today } from "@/lib/format";

const vc = (v: string) => (v === "MASCULINO" ? "m" : v === "FEMININO" ? "f" : "");

function label(h: Hit) {
  const sub = h.folder.startsWith("CIFRAS / ") ? ` · ${h.folder.slice(9)}` : "";
  return `${h.name.replace(/\.pdf$/i, "")}${sub}`;
}

export default function Finder() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState("Culto");

  const picks = useMemo(
    () =>
      (results ?? []).map((r, i) => {
        const pick = (k: "v" | "c", hits: Hit[]) =>
          sel[`${k}${i}`] === "none" ? undefined : hits.find((h) => h.id === sel[`${k}${i}`]) ?? hits[0];
        return { r, v: pick("v", r.vozes), c: pick("c", r.cifras) };
      }),
    [results, sel],
  );

  const share = picks
    .map(({ r, v, c }) => [r.q.line, `Vozes: ${v?.url ?? "(não localizado)"}`, `Cifra: ${c?.url ?? "(não localizado)"}`].join("\n"))
    .join("\n\n");

  const search = () =>
    start(async () => {
      const r = await searchLinks(text);
      setResults(r.results);
      setWarning(r.warning);
      setSel({});
    });

  return (
    <div className="sheet">
      <form className="new-form" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <label className="muted" htmlFor="lista">Cole as músicas do repertório, uma por linha. Tom e nomes entre parênteses podem ficar.</label>
        <textarea
          id="lista"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) search(); }}
          placeholder={"✅ Gratidão Db (Giovanni)\n✅ Rendido estou (Roberta)\n✅ Sublime D (Giovanni e Roberta)"}
        />
        <div className="out-bar">
          <button className="btn primary" disabled={pending || !text.trim()}>{pending ? "Buscando no Drive…" : "Buscar links"}</button>
          <button
            type="button"
            className="btn ghost small"
            disabled={pending}
            style={{ marginLeft: "auto" }}
            onClick={() =>
              start(async () => {
                try {
                  const r = await syncNow();
                  setSyncMsg(`Atualizado: ${r.vozes} vozes e ${r.cifras} cifras${r.news ? ` · ${r.news} novidade${r.news === 1 ? "" : "s"} para revisar em Músicas › Importar do Drive` : ""}`);
                } catch (e) {
                  setSyncMsg(`Não consegui ler o Drive: ${(e as Error).message}`);
                }
              })
            }
          >
            Atualizar do Drive
          </button>
          {syncMsg && <span className="count">{syncMsg}</span>}
        </div>
      </form>

      {warning && <p className="notes" style={{ marginTop: 14 }}>{warning}</p>}

      {results && results.length > 0 && (
        <>
          <div className="sec">
            <h3>Encontrado <small>{results.length} música{results.length === 1 ? "" : "s"}</small></h3>
            <ol className="setlist">
              {picks.map(({ r, v, c }, i) => (
                <li className="set" key={i} style={{ gridTemplateColumns: "28px minmax(0, 1fr)" }}>
                  <span className="n">{i + 1}</span>
                  <div>
                    <div className="name">
                      {r.q.title}
                      {r.q.note && <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}> · {r.q.note}</span>}
                    </div>
                    <div className="links-state">
                      {r.q.key && <span className="chip">{r.q.key}</span>}
                    </div>
                    {(["v", "c"] as const).map((k) => {
                      const hits = k === "v" ? r.vozes : r.cifras;
                      const cur = k === "v" ? v : c;
                      return (
                        <div key={k} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                          <b style={{ width: 52, fontSize: 14 }}>{k === "v" ? "Vozes" : "Cifra"}</b>
                          {hits.length === 0 ? (
                            <span className="chip miss">não localizado</span>
                          ) : (
                            <>
                              <select
                                className="slot"
                                value={cur?.id ?? "none"}
                                onChange={(e) => setSel((s) => ({ ...s, [`${k}${i}`]: e.target.value }))}
                                style={{ flex: "1 1 220px", minWidth: 0 }}
                                aria-label={k === "v" ? "Pasta de vozes" : "Cifra"}
                              >
                                {hits.map((h) => <option key={h.id} value={h.id}>{label(h)}</option>)}
                                <option value="none">— nenhuma —</option>
                              </select>
                              {cur?.version && <span className={`chip ${vc(cur.version)}`}>{cur.version === "MASCULINO" ? "Masc" : "Fem"}</span>}
                              {cur && <a className="chip ok" href={cur.url} target="_blank" rel="noopener">abrir</a>}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="sec">
            <h3>Mensagem para o grupo</h3>
            <div className="out">
              <textarea readOnly value={share} aria-label="Mensagem gerada" />
              <div className="out-bar"><CopyButton text={share} /></div>
            </div>
          </div>

          <div className="sec">
            <h3>Salvar como culto</h3>
            <div className="out-bar">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" />
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do culto" aria-label="Nome do culto" />
              <button
                className="btn"
                disabled={pending}
                onClick={() =>
                  start(() =>
                    saveAsService(
                      date,
                      title,
                      picks.map(({ r, v, c }) => ({
                        title: v?.title || c?.title || r.q.title,
                        key: r.q.key || v?.song_key || c?.song_key || "",
                        version: v?.version || r.q.version || "",
                        vozes: v?.url ?? "",
                        cifra: c?.url ?? "",
                      })),
                    ),
                  )
                }
              >
                Criar culto com essas músicas
              </button>
            </div>
          </div>
        </>
      )}
      {results && results.length === 0 && !warning && <p className="muted" style={{ marginTop: 14 }}>Nenhuma música na lista.</p>}
    </div>
  );
}
