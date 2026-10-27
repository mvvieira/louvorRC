import { pageUser } from "@/lib/auth";
import { shiftMonth, today } from "@/lib/format";
import EscalaView from "../EscalaView";

export const dynamic = "force-dynamic";

/** Montar a escala (liderança): editar célula a célula, distribuir automaticamente e copiar a escala do mês. */
export default async function Montar({ searchParams }: { searchParams: Promise<{ m?: string; done?: string }> }) {
  const me = await pageUser("lider");
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : shiftMonth(today().slice(0, 7), 1);
  return <EscalaView month={month} me={me} edit done={sp.done} />;
}
