# 🏆 Leigos da Bola | Copa 2026 — Documentação de Regras

> Documento vivo. Tudo marcado com **[EDITÁVEL]** pode ser ajustado pelos admins no painel do app, sem mexer em código. Os valores são a **proposta inicial** — ajustem com a galera.

---

## Visão geral

Duas competições paralelas que somam no **ranking final**:

1. **Apostas de placar** — palpite no placar de todos os jogos (preenchidos após cada partida).
2. **Monte sua Seleção** — cada jogador escala um time que pontua ao longo de toda a Copa.

O **ranking final** combina as duas, com pesos definidos pelos admins.

---

## Etapa 1 — Apostas de placar

Palpite no placar de cada jogo antes do apito inicial (trava quando a bola rola).

### Critérios de pontos  **[EDITÁVEL]**

| Acerto | Pontos |
|---|---|
| Placar exato | **10** |
| Vencedor + saldo de gols | **7** |
| Só o resultado (vitória/empate/derrota) | **5** |
| Errou o resultado | **0** |

### Multiplicador por fase  **[EDITÁVEL]**

Grupos ×1.0 · Oitavas ×1.5 · Quartas ×2.0 · Semi ×2.5 · Final/3º ×3.0

---

## Etapa 2 — Monte sua Seleção

Cada jogador monta um time de **16 jogadores**: **11 titulares** (conforme a formação) + **5 reservas** (1 de cada posição: GOL, ZAG, LAT, MEI, ATA). A pontuação total e o patrimônio gasto somam os **16 jogadores**.

### Formações  **[EDITÁVEL via código]**

`4-3-3` · `4-4-2` · `3-4-3` · `3-5-2` · `4-5-1` · `5-3-2`

Os 11 titulares seguem a formação (o goleiro é fixo; os defensores se dividem em zagueiros e laterais conforme o esquema). O campinho desenha as vagas delimitadas por posição de acordo com a formação escolhida.

### Preços — 5 níveis (Fibonacci, em ¢)  **[EDITÁVEL]**

| Nível | Preço |
|---|---|
| Comum | **1¢** |
| Bom | **2¢** |
| Muito bom | **3¢** |
| Fundamental | **5¢** |
| Craque | **8¢** |

### Orçamento  **[EDITÁVEL]**

Teto sugerido: **50¢** para os 16 jogadores. Força escolhas — dá pra ter alguns craques e completar com mais baratos. Ajustável no painel.

### Camisa 10

Cada jogador escolhe um **camisa 10**: a pontuação dele conta **em dobro** (×2). **[EDITÁVEL]**

### Pontuação por scout  **[EDITÁVEL]**

| Evento | GOL | ZAG | LAT | MEI | ATA |
|---|---|---|---|---|---|
| Gol | +12 | +12 | +11 | +9 | +8 |
| Assistência | +5 | +5 | +5 | +5 | +5 |
| Jogo sem sofrer gol | +5 | +5 | +5 | — | — |
| Defesa difícil / pênalti | +7 | — | — | — | — |
| Cartão amarelo | −1 | −1 | −1 | −1 | −1 |
| Cartão vermelho | −3 | −3 | −3 | −3 | −3 |
| Gol contra | −5 | −5 | −5 | −5 | −5 |

### Jogadores

A base vem das **48 seleções convocadas** (fonte: CNN Brasil, jun/2026). Posições (zagueiro × lateral) e preços são um ponto de partida e podem ser editados/excluídos no painel de Admin (com busca e filtros).

---

## Etapa 3 — Ranking final combinado

Cada etapa é **normalizada** (% do líder) antes de aplicar o peso.

### Pesos  **[EDITÁVEL]**

Apostas de placar **60%** · Monte sua Seleção **40%**

---

## Premiação  **[EDITÁVEL]**

Bolo = soma das entradas (cada um pode pagar valor diferente). Proposta de divisão:

| Colocação | % do bolo |
|---|---|
| 1º | 60% |
| 2º | 25% |
| 3º | 15% |

---

## Decisões em aberto (discutir com a galera)

- [ ] Valores de pontos do placar e multiplicadores por fase
- [ ] Teto de orçamento da seleção (sugestão: 50¢)
- [ ] Níveis de preço dos jogadores (revisar craque/fundamental/etc.)
- [ ] Pesos 60/40 do ranking
- [ ] Percentuais de premiação por colocação
