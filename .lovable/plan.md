

# Otimização do process-queue: Respeitar limite de 5 envios/dia para Free

## Problema

O plano aprovado anteriormente bloqueava usuários free completamente. Porém, o plano Free permite até 5 emails/dia. As 3 correções precisam ser ajustadas.

## Correção 1: Fan-out inteligente (process-queue/index.ts)

**Linhas ~1480-1490** — Substituir a query simples por uma que filtra free users que já atingiram o limite:

```sql
-- Buscar users com pending items, EXCLUINDO free users que já enviaram 5+ hoje
SELECT DISTINCT q.user_id 
FROM my_queue q
JOIN profiles p ON p.id = q.user_id
WHERE q.status = 'pending'
AND NOT (
  p.plan_tier = 'free' 
  AND (
    SELECT COUNT(*) FROM my_queue mq 
    WHERE mq.user_id = q.user_id 
    AND mq.status = 'sent' 
    AND mq.sent_at >= CURRENT_DATE
  ) >= 5
)
LIMIT 200
```

Implementação no TypeScript: usar `serviceClient.rpc()` com uma nova RPC `get_eligible_queue_users` que encapsula essa lógica, ou fazer a query via raw SQL. A abordagem mais limpa é criar uma RPC.

**Linha 814** — Remover o `return` para free e substituir por lógica de limite:
```typescript
// Em vez de: if (p.plan_tier === "free") return { processed: 0, sent: 0, failed: 0 };
// Usar a mesma lógica de dailyLimit que já existe (linhas 830-838)
// O get_effective_daily_limit já retorna 5 para free + referral_bonus
```

**Arquivos**: `supabase/functions/process-queue/index.ts` + espelho `frontend/supabase/functions/process-queue/index.ts`

## Correção 2: Cleanup parcial (Migration SQL via insert tool)

Em vez de bloquear TODOS os pendentes de free, manter até 5 e bloquear o excedente:

```sql
WITH ranked AS (
  SELECT q.id, q.user_id,
    ROW_NUMBER() OVER (PARTITION BY q.user_id ORDER BY q.created_at ASC) as rn,
    (SELECT COUNT(*) FROM my_queue mq 
     WHERE mq.user_id = q.user_id AND mq.status = 'sent' 
     AND mq.sent_at >= CURRENT_DATE) as sent_today
  FROM my_queue q
  JOIN profiles p ON p.id = q.user_id
  WHERE q.status = 'pending' AND p.plan_tier = 'free'
)
UPDATE my_queue SET status = 'blocked_free_tier', 
  last_error = 'Free plan: daily limit exceeded (max 5/day)'
WHERE id IN (SELECT id FROM ranked WHERE rn + sent_today > 5)
```

## Correção 3: Trigger preventivo ajustado (Migration SQL)

O trigger conta pendentes + enviados hoje. Só bloqueia se total >= 5:

```sql
CREATE OR REPLACE FUNCTION block_free_tier_pending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER 
SET search_path TO 'public' AS $$
DECLARE
  v_tier plan_tier;
  v_today_total integer;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT plan_tier INTO v_tier FROM profiles WHERE id = NEW.user_id;
    IF v_tier = 'free' THEN
      SELECT COUNT(*) INTO v_today_total FROM my_queue
      WHERE user_id = NEW.user_id
      AND (
        (status = 'pending')
        OR (status = 'sent' AND sent_at >= CURRENT_DATE)
      );
      IF v_today_total >= 5 THEN
        NEW.status := 'blocked_free_tier';
        NEW.last_error := 'Free plan: daily limit exceeded (max 5/day)';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
```

## RPC auxiliar para fan-out (Migration SQL)

```sql
CREATE OR REPLACE FUNCTION get_eligible_queue_users()
RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
  SELECT DISTINCT q.user_id
  FROM my_queue q
  JOIN profiles p ON p.id = q.user_id
  LEFT JOIN smtp_credentials sc ON sc.user_id = q.user_id
  WHERE q.status = 'pending'
  AND (
    p.plan_tier != 'free'
    OR (SELECT COUNT(*) FROM my_queue mq 
        WHERE mq.user_id = q.user_id AND mq.status = 'sent' 
        AND mq.sent_at >= CURRENT_DATE) < 5
  )
  AND (
    p.plan_tier = 'free' -- free users don't need SMTP
    OR (p.smtp_verified = true AND sc.has_password = true)
  )
  LIMIT 200;
$$;
```

## Resumo dos arquivos

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | RPC `get_eligible_queue_users` + trigger `block_free_tier_pending` + cleanup parcial |
| `supabase/functions/process-queue/index.ts` | Fan-out usa RPC; remove bloqueio total de free na linha 814 |
| `frontend/supabase/functions/process-queue/index.ts` | Espelho |

## Impacto

- Free users com < 5 envios/dia continuam funcionando normalmente
- Free users que já enviaram 5 não disparam workers (economia de ~95% das invocações atuais)
- Paid users sem SMTP continuam filtrados
- Cron schedule permanece em 10 min conforme aprovado anteriormente

