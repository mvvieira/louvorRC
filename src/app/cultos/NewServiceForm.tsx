import { createService } from "../actions";
import { today } from "@/lib/format";

export default function NewServiceForm() {
  return (
    <form action={createService} className="new-form">
      <div className="grid2">
        <label className="f">Nome do culto<input type="text" name="title" placeholder="ex.: Domingo, Quinta que Estabelece" /></label>
        <label className="f">Data<input type="date" name="date" defaultValue={today()} required /></label>
      </div>
      <label className="f">
        Músicas (uma por linha, opcional)
        <textarea name="list" placeholder={"Nosso Deus\nEu Vou Construir\nA Cristo Seja a Glória"} />
      </label>
      <div><button className="btn primary">Criar culto</button></div>
    </form>
  );
}
