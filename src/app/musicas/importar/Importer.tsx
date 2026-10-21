"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Broken, LooseCifra, NewVozes } from "@/lib/importer";
import { ignoreItems, importCifra, importVozes, readDrive, restoreIgnored } from "./actions";

const vc = (v: string) => (v === "MASCULINO" ? "m" : v === "FEMININO" ? "f" : "");
const verName = (v: string) => (v === "MASCULINO" ? "Masc" : v === "FEMININO" ? "Fem" : "");
const pdf = (n: string) => n.replace(/\.pdf$/i, "");

/** Revisão do que há de novo no Drive antes de entrar no catálogo. */
export default function Importer({ when, counts, vozes, loose, broken, ignored }: {
  when: string | null; counts: { vozes: number; cifras: number };
  vozes: NewVozes[]; loose: LooseCifra[]; broken: Broken[]; ignored: number;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [off, setOff] = useState<Set<string>>(new Set()); // pastas desmarcadas
  const [cifra, setCifra] = useState<Record<string, string>>({});

  const hide = (ids: string[]) => setGone((g) => new Set([...g, ...ids]));
  const vz = vozes.filter((v) => !gone.has(v.id));
  const lc = loose.filter((c) => !gone.has(c.id));
  const chosen = vz.filter((v) => !off.has(v.id));
  const cifraOf = (v: NewVozes) => cifra[v.id] ?? v.cifra;
  const total = vz.length + lc.length + broken.length;

  const run = (f: () => Promise<string | void>) => start(async () => { const m = await f(); if (m) setMsg(m); });

  return (
    <div className="sheet imp">
      <div className="imp-bar">
        <span className="muted">
          {when ? <>Drive lido em <b>{when}</b> · {counts.vozes} pastas de vozes · {counts.cifras} cifras</> : "O Drive ainda não foi lido."}
        </span>
        <button type="button" className="btn primary" disabled={pending}
          onClick={() => run(async () => { setGone(new Set()); return readDrive(); })}>
          {pending ? "Trabalhando…" : "Ler o Drive agora"}
        </button>
      </div>
      {msg && <p className="toast" role="status">{msg}</p>}
      <p className="muted imp-help">
        Nada entra no catálogo sozinho: o que aparecer de novo nas pastas do Drive fica aqui até alguém importar ou ignorar.
      </p>

      {total === 0 && <p className="imp-empty">✓ Tudo em dia: todas as pastas e cifras do Drive já estão no catálogo.</p>}

      {vz.length > 0 && (
        <section className="sec">
          <h3>Músicas novas <small>{vz.length} pasta{vz.length === 1 ? "" : "s"} de vozes</small></h3>
          <ul className="imp-list">
            {vz.map((v) => (
              <li key={v.id} className={off.has(v.id) ? "off" : undefined}>
                <label className="imp-check">
                  <input type="checkbox" checked={!off.has(v.id)}
                    onChange={() => setOff((o) => { const n = new Set(o); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n; })} />
                  <b>{v.title}</b>
                </label>
                <span className="imp-tags">
                  {v.song_key && <span className={`chip ${vc(v.version)}`}>{v.song_key}</span>}
                  {verName(v.version) && <span className={`chip ${vc(v.version)}`}>{verName(v.version)}</span>}
                  <a className="chip ok" href={v.url} target="_blank" rel="noopener">vozes</a>
                </span>
                <select className={`slot${cifraOf(v) ? "" : " empty"}`} value={cifraOf(v)} aria-label={`Cifra de ${v.title}`}
                  onChange={(e) => setCifra((c) => ({ ...c, [v.id]: e.target.value }))}>
                  <option value="">{v.opts.length ? "sem cifra por enquanto" : "nenhuma cifra parecida no Drive"}</option>
                  {v.opts.map((o) => (
                    <option key={o.url} value={o.url}>{pdf(o.name)}{o.keyOk === false ? " · outro tom" : ""}</option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <div className="out-bar">
            <button type="button" className="btn primary" disabled={pending || !chosen.length}
              onClick={() => run(async () => {
                const n = await importVozes(chosen.map((v) => ({ id: v.id, cifra: cifraOf(v) })));
                hide(chosen.map((v) => v.id));
                return `${n} música${n === 1 ? "" : "s"} nova${n === 1 ? "" : "s"} no catálogo.`;
              })}>
              Importar {chosen.length} selecionada{chosen.length === 1 ? "" : "s"}
            </button>
            <button type="button" className="btn ghost small" disabled={pending || !chosen.length}
              onClick={() => run(async () => { await ignoreItems(chosen.map((v) => v.id)); hide(chosen.map((v) => v.id)); })}>
              Ignorar selecionadas
            </button>
          </div>
        </section>
      )}

      {lc.length > 0 && (
        <section className="sec">
          <h3>Cifras sem música <small>{lc.length} arquivo{lc.length === 1 ? "" : "s"} que nenhuma música usa</small></h3>
          <p className="muted imp-help">Costumam ser outro tom de uma música que já existe. Ligue a uma música sem cifra, crie uma música nova com ela ou ignore.</p>
          <ul className="imp-list">
            {lc.map((c) => (
              <li key={c.id}>
                <span className="imp-name">
                  <a href={c.url} target="_blank" rel="noopener"><b>{pdf(c.name)}</b></a>
                  {c.folder !== "CIFRAS" && <span className="muted"> · {c.folder.replace(/^CIFRAS \/ /, "")}</span>}
                </span>
                <span className="imp-acts">
                  {c.target && (
                    <button type="button" className="btn small primary" disabled={pending}
                      onClick={() => run(async () => { await importCifra(c.id, c.target!.id); hide([c.id]); return `Cifra ligada a ${c.target!.title}.`; })}>
                      Ligar a {c.target.title}{c.target.song_key ? ` (${c.target.song_key})` : ""}
                    </button>
                  )}
                  <button type="button" className="btn small" disabled={pending}
                    onClick={() => run(async () => { await importCifra(c.id); hide([c.id]); return `${c.title} entrou no catálogo.`; })}>
                    Criar música{c.song_key ? ` em ${c.song_key}` : ""}
                  </button>
                  <button type="button" className="btn ghost small" disabled={pending}
                    onClick={() => run(async () => { await ignoreItems([c.id]); hide([c.id]); })}>
                    Ignorar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {broken.length > 0 && (
        <section className="sec">
          <h3>Links que sumiram do Drive <small>{broken.length}</small></h3>
          <p className="muted imp-help">O arquivo ou a pasta foi apagado, renomeado para outra pasta ou ficou privado.</p>
          <ul className="imp-list">
            {broken.map((b) => (
              <li key={`${b.id}${b.kind}`}>
                <span className="imp-name"><b>{b.title}</b>{b.song_key && <span className="muted"> · {b.song_key}</span>}</span>
                <span className="chip miss">{b.kind === "vozes" ? "vozes" : "cifra"} não encontrada</span>
                <Link className="btn small" href={`/musicas/${b.id}`}>Corrigir</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ignored > 0 && (
        <p className="muted imp-help" style={{ marginTop: 18 }}>
          {ignored} ite{ignored === 1 ? "m ignorado" : "ns ignorados"} ·{" "}
          <button type="button" className="btn ghost small" disabled={pending} onClick={() => run(async () => { await restoreIgnored(); setGone(new Set()); })}>
            mostrar de novo
          </button>
        </p>
      )}
    </div>
  );
}
