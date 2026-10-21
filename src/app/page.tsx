import { redirect } from "next/navigation";

/** A página inicial é o calendário do mês, com o dia de hoje em destaque. */
export default function Home() {
  redirect("/calendario");
}
