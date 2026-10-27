import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { monthData } from "@/lib/distribute-data";
import { MESES, shiftMonth as shift, today } from "@/lib/format";
import Distributor from "./Distributor";

export const dynamic = "force-dynamic";

export default async function Distribuir({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await pageUser("lider");
  const sp = await searchParams;
  const t = today();
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : shift(t.slice(0, 7), 1);
  const [y, m] = month.split("-");
  const mesNome = MESES[Number(m) - 1];

  const data = await monthData(month);
  const cs = data.services.filter((c) => c.date >= t);

  return (
    <>
      <div className="esc-top">
        <div className="month">
          <Link className="btn icon" href={`/escala/distribuir?m=${shift(month, -1)}`} aria-label="Mês anterior">‹</Link>
          <h2>Distribuir {mesNome} {y}</h2>
          <Link className="btn icon" href={`/escala/distribuir?m=${shift(month, 1)}`} aria-label="Próximo mês">›</Link>
        </div>
        <Link className="btn" href={`/escala/montar?m=${month}`}>← Voltar para Montar escala</Link>
      </div>
      {cs.length === 0 ? (
        <p className="empty-month">Nenhum culto por vir em {mesNome}. Crie os cultos na aba <Link href="/cultos">Cultos</Link>.</p>
      ) : (
        <Distributor key={month} month={month} {...data} targets={cs.map((c) => c.id)} />
      )}
    </>
  );
}
