import { redirect } from "next/navigation";
import { one } from "@/lib/db";
import { today } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Abre direto o próximo culto, como a agenda do app. */
export default async function Home() {
  const next = await one<{ id: number }>("SELECT id FROM services WHERE date >= ? ORDER BY date, id LIMIT 1", [today()]);
  redirect(next ? `/cultos/${next.id}` : "/cultos");
}
