import { redirect } from "next/navigation";
import { currentUser, teamOk } from "@/lib/auth";
import { all } from "@/lib/db";
import { splitRoles } from "@/lib/roles";
import Entrar from "./Entrar";

export const dynamic = "force-dynamic";

/** Entrada: senha do grupo → quem é você. */
export default async function EntrarPage() {
  if (await currentUser()) redirect("/calendario");
  const ok = await teamOk();
  const people = ok
    ? (await all<{ id: number; name: string; roles: string }>("SELECT id, name, roles FROM members WHERE active=1 ORDER BY name"))
        .map((p) => ({ id: Number(p.id), name: p.name, roles: splitRoles(p.roles).join(", ") }))
    : [];
  return <Entrar team={ok} people={people} />;
}
