
# Fix: Auto-Send do Radar

## Problema
O `trigger_immediate_radar` insere matches apenas na tabela `radar_matched_jobs`, mas nunca move esses matches para a `my_queue`. Quando o `process-queue` e chamado, ele nao encontra nada pendente para enviar.

## Solucao

Adicionar a etapa faltante no `auto-import-jobs`: depois de chamar `trigger_immediate_radar`, inserir os matches novos na `my_queue` com `status = 'pending'` antes de chamar `process-queue`.

## Mudancas

### 1. Edge Function `supabase/functions/auto-import-jobs/index.ts`

No bloco que roda apos o radar match (linhas ~196-236), adicionar logica para:

1. Buscar os jobs recem-inseridos em `radar_matched_jobs` que ainda NAO estao na `my_queue`
2. Inserir esses jobs na `my_queue` com `status = 'pending'` usando o service role client (que bypassa RLS)
3. So entao disparar o `process-queue`

```text
Fluxo corrigido:

Import DOL -> trigger_immediate_radar (radar_matched_jobs)
                    |
                    v
           [NOVO] Insert into my_queue (status=pending)
                    |
                    v
           [auto_send=true?] -> process-queue
```

### Detalhes tecnicos

- A query para buscar matches novos:
  ```sql
  SELECT job_id FROM radar_matched_jobs
  WHERE user_id = ? AND job_id NOT IN (
    SELECT job_id FROM my_queue WHERE user_id = ? AND job_id IS NOT NULL
  )
  ```
- Insert na `my_queue` usando o service role client (sem RLS):
  ```ts
  await supabase.from("my_queue").insert(
    newJobIds.map(jobId => ({
      user_id: radar.user_id,
      job_id: jobId,
      status: "pending",
    }))
  );
  ```
- Respeitar o limite de creditos diarios do usuario chamando `get_effective_daily_limit` e limitando o numero de insercoes

### 2. Nenhuma migracao necessaria

Todas as tabelas e colunas ja existem. A unica mudanca e na logica da Edge Function.
