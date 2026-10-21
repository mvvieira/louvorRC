import { lastSync } from "@/lib/drive";
import Finder from "./Finder";

export const dynamic = "force-dynamic";

export default async function Buscar() {
  const s = await lastSync();
  const when = s.at
    ? new Date(s.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })
    : null;
  return (
    <>
      <div className="page-head">
        <h2>Buscar links</h2>
        <span className="count">
          {when ? `Drive: ${s.vozes} pastas de vozes · ${s.cifras} cifras · atualizado ${when}` : "O Drive é lido na primeira busca"}
        </span>
      </div>
      <Finder />
    </>
  );
}
