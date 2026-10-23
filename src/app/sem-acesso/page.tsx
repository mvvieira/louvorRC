export default async function SemAcesso({ searchParams }: { searchParams: Promise<{ invalido?: string }> }) {
  const { invalido } = await searchParams;
  return (
    <div className="sheet noaccess">
      <h2>{invalido ? "Link sem acesso" : "Acesso pelo seu link"}</h2>
      <p>
        {invalido
          ? "Este link não vale mais (ou foi trocado). Peça um link novo para a liderança do louvor."
          : "O app do louvor abre pelo link pessoal que a liderança manda no WhatsApp. Toque no seu link uma vez e o celular fica conectado."}
      </p>
      <p className="muted">Não tem o link? Fale com a liderança do louvor.</p>
    </div>
  );
}
