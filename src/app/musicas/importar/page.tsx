import Link from "next/link";
import { lastSync } from "@/lib/drive";
import { driveNews } from "@/lib/importer";
import Importer from "./Importer";

export const dynamic = "force-dynamic";

export default async function Importar() {
  const s = await lastSync();
  const news = await driveNews();
  const when = s.at
    ? new Date(s.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })
    : null;
  return (
    <>
      <div className="page-head">
        <h2>Importar do Drive</h2>
        <Link className="btn ghost small" href="/musicas">← Músicas</Link>
      </div>
      <Importer
        when={when}
        counts={{ vozes: s.vozes, cifras: s.cifras }}
        vozes={news.vozes}
        loose={news.loose}
        broken={news.broken}
        ignored={news.ignored}
      />
    </>
  );
}
