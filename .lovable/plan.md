
# Corrigir Autopilot: 36 matches nao enviados + itens travados

## Diagnostico

Encontrei **dois problemas** causando as 36 vagas paradas:

### Problema 1: Insert em lote falha por duplicata
O `process-radar` tenta inserir todos os matches de uma vez na fila (`my_queue`) usando `.insert()`. Se **uma unica vaga** ja existir na fila (constraint `my_queue_user_id_job_id_key`), o **lote inteiro falha** e nenhuma vaga entra.

Evidencia nos logs:
```
Queue insert error: duplicate key value violates unique constraint "my_queue_user_id_job_id_key"
Key (user_id, job_id)=(09cc9f10..., 174ade02...) already exists.
```

Resultado: 36 matches marcados como `auto_queued=true` em `radar_matched_jobs`, mas **zero** inseridos em `my_queue`.

### Problema 2: 6 itens `failed` com erro antigo
Ha 6 itens na fila com `last_error: supabaseUrl is not defined` de uma versao anterior do codigo. Estes precisam ser resetados para `pending`.

## Plano de correcao

### 1. Corrigir `process-radar` - usar upsert ao inves de insert
Trocar `.insert(queueRecords)` por `.upsert(queueRecords, { onConflict: "user_id,job_id", ignoreDuplicates: true })` na insercao em `my_queue`. Isso garante que duplicatas sao ignoradas silenciosamente sem derrubar o lote inteiro.

Arquivos: `supabase/functions/process-radar/index.ts` e `frontend/supabase/functions/process-radar/index.ts`

### 2. Recuperar os 36 matches perdidos
Inserir na `my_queue` os 36 jobs que foram marcados `auto_queued=true` em `radar_matched_jobs` mas nunca chegaram a fila. Usar um SQL direto para isso.

### 3. Resetar os 6 itens failed
Atualizar os 6 itens com erro `supabaseUrl is not defined` de volta para `pending` com `last_error` limpo, para que sejam reprocessados com o codigo corrigido.

### 4. Re-deploy da Edge Function
Deploy do `process-radar` corrigido.

## Detalhes tecnicos

Mudanca principal no `process-radar/index.ts`:
```typescript
// ANTES (falha no lote inteiro se 1 duplicata):
const { error: queueError } = await supabase
  .from("my_queue")
  .insert(queueRecords);

// DEPOIS (ignora duplicatas silenciosamente):
const { error: queueError } = await supabase
  .from("my_queue")
  .upsert(queueRecords, {
    onConflict: "user_id,job_id",
    ignoreDuplicates: true
  });
```

SQL de recuperacao:
```sql
-- Inserir os 36 matches perdidos na fila
INSERT INTO my_queue (user_id, job_id, status)
SELECT rm.user_id, rm.job_id, 'pending'
FROM radar_matched_jobs rm
WHERE rm.user_id = '09cc9f10-574e-4525-8dd3-5e9b3ed383e8'
  AND rm.auto_queued = true
  AND NOT EXISTS (SELECT 1 FROM my_queue mq WHERE mq.user_id = rm.user_id AND mq.job_id = rm.job_id);

-- Resetar os 6 failed com erro antigo
UPDATE my_queue SET status = 'pending', last_error = NULL, last_attempt_at = NULL
WHERE user_id = '09cc9f10-574e-4525-8dd3-5e9b3ed383e8'
  AND status = 'failed'
  AND last_error LIKE '%supabaseUrl is not defined%';
```
