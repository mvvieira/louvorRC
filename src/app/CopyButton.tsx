"use client";
import { useState } from "react";

export default function CopyButton({ text, label = "Copiar mensagem", done = "Mensagem copiada", className = "btn primary" }: {
  text: string; label?: string; done?: string; className?: string;
}) {
  const [msg, setMsg] = useState("");
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          let ok = false;
          try { await navigator.clipboard.writeText(text); ok = true; } catch {}
          setMsg(ok ? done : "Selecione o texto e copie manualmente");
          setTimeout(() => setMsg(""), 2200);
        }}
      >
        {label}
      </button>
      <span className="toast" style={{ opacity: msg ? 1 : 0 }}>{msg}</span>
    </>
  );
}
