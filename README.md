# RC Louvor

App do Louvor Rasgando os Céus: catálogo de músicas (vozes + cifras do Drive), repertório dos cultos com texto pronto para WhatsApp e escala da equipe.

Stack: Next.js (App Router) + libSQL/SQLite. Roda local com arquivo e vai para a Vercel trocando só o `DATABASE_URL` para um banco Turso.

## Rodar local

    npm install
    npm run dev

Abra http://localhost:3000. O banco é criado em `data/louvor.db` e já vem com as músicas das pastas do Drive.

## Subir na Vercel (depois)

1. `turso db create rc-louvor` e `turso db tokens create rc-louvor`
2. Na Vercel, defina `DATABASE_URL=libsql://...` e `DATABASE_AUTH_TOKEN=...`
3. Deploy do repositório.
