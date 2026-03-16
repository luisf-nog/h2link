

# Análise detalhada do consumo de Database Server (84%)

## Resumo executivo

O alto consumo do database server vem de **3 fontes principais**, todas ligadas a edge functions executadas via cron jobs. Não é o frontend ou usuários navegando — são os processos automatizados rodando em background.

---

## Os maiores consumidores (ranking por impacto)

### 1. `process-queue` (cron: **a cada 1 minuto**) — MAIOR VILÃO

Esta edge function roda **1.440 vezes por dia** e, com o padrão fan-out, dispara múltiplas sub-invocações paralelas (uma por usuário ativo). Cada invocação faz:

- Query na `my_queue` para buscar itens pendentes por usuário
- Query na `profiles` para buscar dados do usuário (plano, créditos, resume_data)
- Query na `smtp_credentials` e `smtp_credentials_secrets`
- Query na `email_templates`
- Query na `queue_send_history` para deduplicação
- Query na `public_jobs` para montar o email
- Updates na `profiles` (credits_used_today, consecutive_errors)
- Updates/inserts na `my_queue` (status)

**Números das tabelas afetadas:**
| Tabela | Sequential reads | Index reads | Updates |
|--------|-----------------|-------------|---------|
| `my_queue` | 44.6M rows | 14.7M | 8,868 |
| `public_jobs` | 23.2M rows | 71.2M | 42,319 |
| `profiles` | 6.8M rows (21K seq scans!) | 270K | 7,623 |
| `queue_send_history` | 6.3M rows | 640K | 1,547 |
| `email_templates` | 1.2M rows (20K seq scans!) | 272K | 2 |
| `smtp_credentials` | — | 235K | 570 |

**Problema crítico**: `profiles` tem **21.226 sequential scans** e `email_templates` tem **19.961 sequential scans**. Sequential scans leem a tabela inteira — isso significa que essas queries não estão usando índice, lendo todos os rows repetidamente.

### 2. `process-radar` (cron: **a cada 5 minutos**) — SEGUNDO MAIOR

Roda **288 vezes por dia**. Para cada perfil radar ativo:
- Busca até **2.000 jobs** da `public_jobs` (que tem 9.054 ativos de 19.735 totais)
- A tabela `public_jobs` ocupa **101 MB** — cada query pode ler uma porção significativa
- Faz **674.171 updates** na `radar_matched_jobs` (marcando `already_in_queue`, etc.)
- A `radar_matched_jobs` ocupa **43 MB** com apenas 1.538 rows atuais (inchaço por updates/deletes)

### 3. `auto-import-jobs` (cron: **múltiplas execuções por hora, horário 06:00-07:30**)

São **6 cron jobs** diferentes para importação:
- h2a, h2b, jo — cada um com 2 schedules (um pontual e um a cada minuto durante uma janela)
- Fazem inserts/updates massivos na `public_jobs` (42.319 updates, 1.674 inserts)

---

## Problemas estruturais identificados

### A. Sequential scans excessivos
- `profiles`: 21K seq scans para apenas 12 rows → **falta de índice** ou queries sem WHERE adequado
- `email_templates`: 20K seq scans para ~9 rows → mesmo problema
- `my_queue`: 13K seq scans → a query provavelmente não filtra por índice

### B. Tabela `public_jobs` inchada (101 MB)
- 19.735 rows ocupando 101 MB = ~5KB por row em média
- Com 42.319 updates, o PostgreSQL cria "dead tuples" que inflam o tamanho
- Cada query do radar puxa até 2.000 dessas rows

### C. `radar_matched_jobs` — 674K updates em 1.538 rows
- Média de **438 updates por row** — isso gera enorme churn de dead tuples
- 43 MB para 1.538 rows = ~28KB por row (extremamente inchado)

### D. Frequência excessiva dos crons
- `process-queue` a cada 1 min pode ser demais se não há items pendentes
- `process-radar` a cada 5 min com 2.000 jobs por profile é agressivo

---

## Recomendações de otimização (para implementar depois)

1. **Criar índices** em `profiles`, `email_templates`, `my_queue` para eliminar seq scans
2. **Reduzir frequência** do `process-queue` para cada 2-3 min
3. **Limitar** o `process-radar` — usar `LIMIT 500` com filtro `posted_date > now() - interval '7 days'`
4. **VACUUM FULL** na `public_jobs` e `radar_matched_jobs` para recuperar espaço
5. **Skip cron** quando não há items: adicionar uma query rápida de contagem antes do fan-out
6. Selecionar apenas colunas necessárias na `public_jobs` (em vez de `select("id")` + depois `select("*")`)

Quer que eu implemente alguma dessas otimizações?

