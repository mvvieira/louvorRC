import { pageUser } from "@/lib/auth";
import TrocarSenha from "./TrocarSenha";

export const dynamic = "force-dynamic";

/** Trocar a própria senha (qualquer pessoa). */
export default async function Senha() {
  const me = await pageUser();
  return <TrocarSenha name={me.name} />;
}
