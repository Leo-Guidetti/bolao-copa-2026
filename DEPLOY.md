# 🚀 Deploy — Leigos da Bola | Copa 2026

App: Next.js + Prisma + Postgres (Supabase) + NextAuth (login email/senha). Hospedagem: Vercel.
Login por **convite** (código), e **admin** definido pelo seu email.

> O que **só você** pode fazer (não dá pra automatizar por mim): criar as contas (Supabase, Vercel) e colar as chaves. O código está todo pronto.

> ⚠️ **Antes de começar:** apague a pasta `.git` que ficou no projeto (foi criada numa tentativa minha e travou). No PowerShell, dentro da pasta do projeto: `Remove-Item -Recurse -Force .git` (ou apague pelo Explorer, ativando "itens ocultos"). Depois siga normalmente.

## 1. Banco de dados (Supabase)
1. Crie conta em https://supabase.com → **New project**. Guarde a senha do banco.
2. Em **Project Settings → Database → Connection string**:
   - **Connection pooling** (Transaction, porta 6543) → use como `DATABASE_URL` (acrescente `?pgbouncer=true`).
   - **Direct connection** (porta 5432) → use como `DIRECT_URL`.

## 2. Variáveis de ambiente (.env)
Preencha o `.env` (local) com os valores reais:
- `DATABASE_URL`, `DIRECT_URL` (do passo 1)
- `NEXTAUTH_URL` = `http://localhost:3000` (local) / a URL da Vercel (produção)
- `NEXTAUTH_SECRET` = string aleatória (gere: `openssl rand -base64 32`)
- `ADMIN_EMAILS` = seu email (separe por vírgula se incluir mais admins depois)
- `INVITE_CODE` = o código que você vai passar pros amigos
- `APIFOOTBALL_KEY` = sua chave (opcional, p/ sync de placares)

## 3. Criar as tabelas e popular (uma vez)
```
npm install
npx prisma db push      # cria/atualiza as tabelas no Supabase (inclui a coluna nova da FOTO de perfil)
npm run db:seed         # popula 48 seleções + calendário (SÓ se o banco ainda estiver vazio; não re-rode se já populou)
npm run dev             # testar local em http://localhost:3000
```

> 🔄 **Se você já tinha rodado o `db push` antes:** rode `npx prisma db push` de novo agora para criar a coluna da foto de perfil (`avatarUrl`). Sem isso, a página de perfil e o avatar no Admin dão erro.

## 4. Publicar na Vercel
1. Suba o projeto pro GitHub (ou use a Vercel CLI: `npm i -g vercel` e `vercel`).
2. Em https://vercel.com → **Add New Project** → importe o repositório.
3. Em **Settings → Environment Variables**, adicione TODAS as variáveis do `.env`
   (com `NEXTAUTH_URL` = a URL final da Vercel, ex.: `https://leigos-da-bola.vercel.app`).
4. **Deploy**. O build roda `prisma generate` automaticamente.
   - ⚠️ **Importante:** depois que a Vercel te der a URL final, confira que `NEXTAUTH_URL` está EXATAMENTE igual a ela (com `https://`, sem barra no fim) e refaça o deploy. Se estiver errada, o login quebra (redireciona errado).
5. Se for o primeiro deploy e as tabelas ainda não existem, rode localmente (com o `.env` apontando pro Supabase): `npx prisma db push && npm run db:seed`.

## 5. Primeiro acesso
- Abra a URL → **/login → Cadastrar**, use seu email (o de `ADMIN_EMAILS`) + o código de convite. Você entra como **admin** automaticamente.
- Seus amigos se cadastram com o **mesmo código de convite**. Eles entram como participantes comuns.
- Você define o valor de entrada de cada um em **Admin → Participantes**.

## 6. Atualização de placares (madrugada)
O `scripts/sync.mjs` usa Prisma com a `DATABASE_URL` — se o `.env` da sua máquina apontar pro Supabase, o agendamento do Windows (schtasks, ver README) atualiza o **banco na nuvem** direto, sem o app precisar estar aberto.

## Trocar admin / convite depois
- Novo admin: adicione o email em `ADMIN_EMAILS` (na Vercel) e redeploy.
- Trocar convite: mude `INVITE_CODE` na Vercel e redeploy.
