"use client";
import { useRef } from "react";

/** Formulário que salva sozinho quando um campo muda (ao sair do campo de texto ou ao trocar a data). */
export default function AutoForm({ action, className, children }: {
  action: (f: FormData) => void | Promise<void>; className?: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={action}
      className={className}
      onFocus={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        t.dataset.before = t.value;
      }}
      onBlur={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.name && t.dataset.before !== undefined && t.dataset.before !== t.value) ref.current?.requestSubmit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    >
      {children}
    </form>
  );
}
