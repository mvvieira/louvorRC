import { pageUser } from "@/lib/auth";
import { today } from "@/lib/format";
import EscalaView from "./EscalaView";

export const dynamic = "force-dynamic";

/** Escala do mês para todos (só leitura, com o destaque de quem está usando). Montar fica em /escala/montar. */
export default async function Escala({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const me = await pageUser();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today().slice(0, 7);
  return <EscalaView month={month} me={me} edit={false} />;
}
