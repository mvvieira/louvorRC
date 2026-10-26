import { redirect } from "next/navigation";
import { currentUser, teamOk } from "@/lib/auth";
import { all, type Access } from "@/lib/db";
import { splitRoles } from "@/lib/roles";
import Entrar from "./Entrar";

export const dynamic = "force-dynamic";

/** Entrada: senha do grupo → quem é você → PIN (ministro e liderança). */
export default async function EntrarPage() {
  if (await currentUser()) redirect("/calendario");
  const ok = await teamOk();
  const people = ok
    ? (await all<{ id: number; name: string; roles: string; access: Access }>("SELECT id, name, roles, access FROM members WHERE active=1 ORDER BY name"))
        .map((p) => ({ id: Number(p.id), name: p.name, roles: splitRoles(p.roles).join(", "), pin: p.access !== "banda" }))
    : [];
  return <Entrar team={ok} people={people} />;
}
