import { pageUser } from "@/lib/auth";
import NewServiceForm from "./NewServiceForm";

export default async function NovoCulto() {
  const me = await pageUser();
  if (me.access !== "lider") {
    return <p className="muted">Escolha um culto na agenda para ver o repertório, a escala e a mensagem do WhatsApp.</p>;
  }
  return (
    <>
      <h2 style={{ fontSize: 22 }}>Novo culto</h2>
      <p className="muted" style={{ marginTop: 6 }}>
        Escolha um culto na agenda ou crie um novo para montar repertório, escala e a mensagem do WhatsApp.
      </p>
      <NewServiceForm />
    </>
  );
}
