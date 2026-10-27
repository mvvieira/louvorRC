"use client";
import { useState } from "react";

/** Liga/desliga o tema escuro (Noite) neste aparelho; desligado = visual oficial claro (Sereno). Troca na hora, sem recarregar. */
export default function ThemeSwitch({ dark: initial }: { dark: boolean }) {
  const [dark, setDark] = useState(initial);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.cookie = next ? "rc_tema=noite; path=/; max-age=31536000; samesite=lax" : "rc_tema=; path=/; max-age=0; samesite=lax";
    if (next) document.documentElement.dataset.tema = "noite";
    else delete document.documentElement.dataset.tema;
  };
  return (
    <button type="button" role="switch" aria-checked={dark} className="theme-switch" onClick={toggle}
      title={dark ? "Mudar para o tema claro" : "Mudar para o tema escuro"} aria-label="Tema escuro">
      <span className="ts-ic" aria-hidden="true">☀︎</span>
      <span className="ts-track" aria-hidden="true"><span className="ts-knob" /></span>
      <span className="ts-ic" aria-hidden="true">☾</span>
    </button>
  );
}
