"use client";
import { useRef } from "react";

/** Botão "Adicionar música" que abre o formulário num diálogo. */
export default function NewSongDialog({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn primary" onClick={() => ref.current?.showModal()}>Adicionar música</button>
      <dialog ref={ref} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        {children}
      </dialog>
    </>
  );
}

export function CloseDialog() {
  return (
    <button type="button" className="btn" onClick={(e) => (e.currentTarget.closest("dialog") as HTMLDialogElement)?.close()}>
      Cancelar
    </button>
  );
}
