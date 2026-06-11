# 🏆 Leigos da Bola | Copa 2026

App do bolão entre amigos: **apostas de placar** + **Monte sua Seleção** (estilo Cartola), com **ranking combinado** e **premiação por colocação**. Estética clean (Apple-like). Toda a configuração é editável pelos admins no painel, sem mexer em código.

As regras completas estão em [`DOCUMENTACAO.md`](./DOCUMENTACAO.md).

## Stack

- **Next.js 14** (App Router) + **React**
- **Tailwind CSS** (visual clean)
- **Prisma** + **SQLite** (dev). Pronto para trocar por Postgres/Supabase em produção.

## Como rodar (primeira vez)

Precisa de [Node.js 18+](https://nodejs.org). No terminal, dentro desta pasta:

```bash
npm install      # instala dependências
npm run setup    # cria o banco e popula com dados de exemplo
npm run dev      # sobe o app
```

Abra **http://localhost:3000**.

Senha do painel de Admin: **`copa2026`** (mude no arquivo `.env`).

## Páginas

- **/** — Ranking geral + premiação calculada
- **/apostas** — palpites de placar (travam quando o jogo começa)
- **/selecao** — montar o time de 11 com formação e capitão
- **/admin** — editar pontos, regras da seleção, pesos do ranking, premiação, participantes, jogos (lançar resultados) e jogadores (scout)

## O que o Admin edita

Critérios de pontos do placar · multiplicadores por fase · bônus zebra · formações, scout, orçamento e capitão da seleção · pesos do ranking final · % de premiação por colocação · participantes (e valor de entrada de cada um) · jogos e resultados · jogadores e scout.

## Próximos passos (para produção)

1. **Banco:** em `prisma/schema.prisma`, troque `provider = "sqlite"` por `"postgresql"` e ponha a `DATABASE_URL` do Supabase/Neon no `.env`. Rode `npm run db:push`.
2. **Login de verdade:** hoje o acesso de participante é por seleção de nome e o admin por senha simples (`.env`). Para multiplayer real, adicionar autenticação (ex: Supabase Auth ou NextAuth).
3. **Placares automáticos:** criar um job que consome uma API de resultados (ex: API-Football) e atualiza `Match.homeScore/awayScore` e o scout dos jogadores. Os pontos já recalculam sozinhos.
4. **Deploy:** publicar na Vercel (frontend + API) apontando para o Postgres.

## Sincronização automática de placares (API-Football)

O app pode atualizar sozinho os placares dos jogos. Os pontos das apostas recomputam automaticamente; o scout da seleção continua sendo lançado no Admin.

1. Crie uma conta gratuita em **https://www.api-football.com/** e copie sua **API key**.
2. Cole a chave no arquivo `.env`: `APIFOOTBALL_KEY="sua_chave"`.
3. Teste sem gravar nada: `npm run sync:dry` (mostra os jogos que casaram).
4. Aplicar de verdade: `npm run sync`.

### Rodar todo dia de madrugada (Windows)

Para atualizar automaticamente às 05:00 (após o fim dos jogos da véspera, horário BRT), abra o **Prompt de Comando como Administrador** e rode:

```
schtasks /Create /SC DAILY /ST 05:00 /TN "BolaoCopaSync" /TR "\"C:\Users\leogu\Documents\Claude\Projects\Bolão da Copa do Mundo\scripts\sync.bat\""
```

Isso cria uma tarefa diária. Para testar agora: `schtasks /Run /TN "BolaoCopaSync"`. Para remover: `schtasks /Delete /TN "BolaoCopaSync" /F`.

> Observação: o sync escreve direto no banco SQLite local, então o app **não precisa estar aberto** na hora. Se um dia você publicar o app num servidor, use um cron lá em vez do Agendador do Windows.

### Scout dos jogadores (opcional, experimental)

O mesmo script também sabe puxar as estatísticas por jogador (gols, assistências, cartões, gol contra, jogo sem sofrer gol, defesas):

```
npm run sync:stats     # placares + scout dos jogadores
```

O casamento de jogador é por nome+seleção (best-effort) — quem não casar é listado no log para ajuste. Para validar a lógica sem chave/Internet (usa dados de exemplo no banco): `npm run sync:test`.
