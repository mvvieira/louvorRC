import NewServiceForm from "./NewServiceForm";

export default function NovoCulto() {
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
