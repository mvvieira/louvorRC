import { run } from "./db";

/* Log de acesso: quem entrou e quais páginas abriu (visível só para o administrador, em /acessos). */

/** "iPhone · Safari", "Android · Chrome", "Mac · Chrome"… a partir do user-agent. */
export function device(ua: string): string {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "outro";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return br ? `${os} · ${br}` : os;
}

/** Entrada pelo "Quem é você?". */
export async function logEntry(memberId: number, ua: string) {
  await run("INSERT INTO access_log (member_id, kind, path, device) VALUES (?, 'entrada', '/entrar', ?)", [memberId, device(ua)]);
}

/** Página aberta: a mesma página da mesma pessoa conta no máximo uma vez a cada 10 minutos. */
export async function logPage(memberId: number, path: string, ua: string) {
  await run(
    `INSERT INTO access_log (member_id, kind, path, device)
     SELECT ?, 'pagina', ?, ? WHERE NOT EXISTS (
       SELECT 1 FROM access_log WHERE member_id=? AND kind='pagina' AND path=? AND at > datetime('now', '-10 minutes'))`,
    [memberId, path, device(ua), memberId, path],
  );
}
