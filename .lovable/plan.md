

# Diagnóstico: Por que a fila trava repetidamente

## Dados observados no banco (agora)

| Usuário | Paused | Erro | consecutive_errors | credits_used_today | limit |
|---------|--------|------|--------------------|--------------------|-------|
| Cassiano (9d1bf5d2) | 265 | `[CIRCUIT_BREAKER] Pausado por 3+ erros consecutivos` | **13** | 0 | 350 |
| Luís (09cc9f10) | 93 | `[PROCESSING_TIMEOUT]` | 0 | 158 | 350 |

---

## Bug 1 — CIRCUIT_BREAKER e PROCESSING_TIMEOUT são erros de código ANTIGO (causa principal)

Os 265 itens do Cassiano foram pausados em massa por uma versão ANTERIOR do `process-queue` que fazia bulk-pause (marcava todos os itens restantes como "paused" com erro CIRCUIT_BREAKER quando 3 erros consecutivos ocorriam). **Esse código já foi removido**, mas os itens permanecem no banco com esse status.

A migração `20260309130850` que deveria resetar esses itens **não foi executada** (migração timeout — o problema conhecido do Lovable Cloud).

Os 93 itens do Luís foram auto-recuperados pelo frontend (heartbeat de 10 minutos) — todos com o mesmo timestamp `14:02:12.78`, indicando que foram recuperados em lote. Provavelmente originados de uma sessão de envio onde o navegador foi fechado/backgrounded.

**Correção**: Executar a SQL pendente via `run-pending-migrations` ou SQL editor manual.

---

## Bug 2 — `consecutive_errors = 13` bloqueia o cron (backend)

O cron (`process-queue`) lê `consecutive_errors` do perfil (linha 838) e faz `break` se >= 3 (linha 991). O Cassiano tem **13**. Isso significa que toda execução do cron para ele é imediatamente abortada.

O frontend faz `resetConsecutiveErrors()` antes de cada retry manual, mas o cron não faz. Então, mesmo que o problema original (SMTP) já tenha sido resolvido, o cron nunca processa novos itens "pending" para esse usuário.

**Correção**: No início de `processOneUser`, se `last_usage_date < today` (novo dia), resetar `consecutive_errors` para 0.

---

## Bug 3 — Backend usa limite ERRADO (plan hard cap vs warm-up)

`process-queue` linha 825:
```text
const dailyLimit = getDailyEmailLimit(p.plan_tier) + referralBonus;
```
Isso retorna o TETO do plano (350 para Diamond), ignorando completamente o sistema de warm-up. Enquanto isso, o `send-email-custom` (chamado pelo frontend) usa `get_effective_daily_limit()` que respeita o warm-up.

Resultado: o cron pode enviar muito mais que o warm-up permite, causando rate limits no provedor SMTP → erros 421/429 → circuit breaker → bulk-pause (no código antigo).

**Correção**: Trocar `getDailyEmailLimit()` por `get_effective_daily_limit()` RPC no `processOneUser`.

---

## Bug 4 — Erros de Edge Function não ativam o circuit breaker

Os erros registrados para Luís incluem:
- `"Edge Function returned a non-2xx status code"`
- `"Failed to send a request to the Edge Function"`

Estes são erros de **infraestrutura** (função fora do ar, timeout do edge runtime). Mas `isSystemicSmtpError()` classifica-os como `'unknown'` e retorna `false`. O circuit breaker nunca dispara, e o loop continua tentando inutilmente item após item.

**Correção**: Adicionar "edge function" como padrão sistêmico no `smtpErrorParser.ts`.

---

## Bug 5 — Trigger `set_sent_at_on_sent` não executado

Todos os itens "sent" do Luís têm `sent_at = NULL`. O frontend (Queue.tsx) não define `sent_at` explicitamente — depende de um trigger de banco que foi criado como migração pendente mas nunca aplicado.

Isso causa o problema do "email visualizado antes de ser enviado" (opened_at tem valor mas sent_at é null).

**Correção**: Executar a migração pendente do trigger.

---

## Plano de Implementação

### 1. Migração de dados: resetar itens presos
SQL a executar (via `run-pending-migrations` ou SQL editor):
```sql
-- Reset CIRCUIT_BREAKER items
UPDATE my_queue SET status = 'pending', last_error = NULL
WHERE status = 'paused' AND last_error LIKE '%CIRCUIT_BREAKER%';

-- Reset PROCESSING_TIMEOUT items 
UPDATE my_queue SET status = 'pending', last_error = NULL
WHERE status = 'paused' AND last_error LIKE '%PROCESSING_TIMEOUT%';

-- Reset consecutive_errors
UPDATE profiles SET consecutive_errors = 0 WHERE consecutive_errors > 0;
```

### 2. `process-queue` — Usar warm-up limit + auto-reset errors
- Trocar `getDailyEmailLimit(p.plan_tier)` por chamada RPC `get_effective_daily_limit(userId)`
- No início de `processOneUser`, se é um novo dia, resetar `consecutive_errors` para 0

### 3. `smtpErrorParser.ts` — Classificar erros de Edge Function como sistêmicos
- Adicionar patterns para "edge function", "non-2xx", "failed to send a request" como categoria `connection_timeout` ou novo tipo `edge_function_error`
- Incluir na lista de `systemicCategories`

### 4. Trigger `set_sent_at_on_sent` — Executar migração pendente
- Verificar se o trigger existe; se não, executá-lo

### Arquivos afetados
- `supabase/functions/process-queue/index.ts` — bugs 2 e 3
- `frontend/src/lib/smtpErrorParser.ts` — bug 4
- Migrações SQL — bugs 1 e 5

