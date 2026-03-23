

# Fix: Database Server ainda em 97% — 3 problemas identificados

## Diagnóstico

Os logs mostram que o cron continua disparando 4 workers a cada execução, todos para os mesmos 4 usuários free com `consecutive_errors = 3`. Cada worker faz ~5 queries antes do circuit breaker parar. São ~960 invocações inúteis/dia.

**3 causas raiz:**

1. **Cron ainda roda a cada 3 minutos** — a mudança para 10 min nunca foi aplicada no banco
2. **A RPC `get_eligible_queue_users` não filtra `consecutive_errors >= 3`** — esses 4 usuários passam pelo filtro porque são free com < 5 enviados hoje, mas sempre falham
3. **10 items pendentes antigos** criados antes do trigger existir nunca foram limpos

## Correções (1 migration + 0 code changes)

### Migration SQL única com 3 ações:

**1. Atualizar a RPC** para adicionar filtro de `consecutive_errors`:
```sql
-- Exclui users com 3+ erros consecutivos (circuit breaker no código)
AND p.consecutive_errors < 3
```

**2. Limpar os 10 items pendentes** dos 4 usuários problemáticos:
```sql
UPDATE my_queue SET status = 'blocked_free_tier', 
  last_error = 'Free plan: consecutive errors exceeded'
WHERE status = 'pending' AND user_id IN (
  SELECT id FROM profiles WHERE consecutive_errors >= 3
);
```

**3. Alterar o cron de 3 → 10 minutos:**
```sql
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'process-queue-every-minute'),
  '*/10 * * * *'
);
```

## Impacto esperado

| Métrica | Agora | Depois |
|---------|-------|--------|
| Workers/dia | ~1.920 | 0 (até haver users elegíveis) |
| Queries inúteis/dia | ~9.600 | 0 |
| Execuções cron/dia | 480 | 144 |
| DB Server estimado | 97% | ~15-25% |

## Nenhuma mudança nos Edge Functions

A RPC é a única coisa que precisa mudar — o código já usa `serviceClient.rpc('get_eligible_queue_users')`.

