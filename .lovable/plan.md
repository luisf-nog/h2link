
Objetivo: eliminar de vez os timeouts do H2A, aceitando processamento longo (até ~1h de ponta a ponta) sem quebrar a atualização automática da madrugada.

1) Diagnóstico confirmado (causa raiz real)
- Hoje existem 2 problemas simultâneos:
  1. Timeout “falso” no frontend:
     - A tela `/admin/import` força falha após 5 minutos (`waitForJob`), e ainda marca jobs antigos como failed no mount.
     - Isso gera erro visual mesmo quando o backend ainda poderia continuar.
  2. Timeout “real” no backend:
     - `auto-import-jobs` processa tudo em uma execução só (via `waitUntil`).
     - Pelos logs, H2A para no meio (~1115/1940) e o runtime encerra (`shutdown`) antes de concluir.
     - Reduzir chunk ajuda, mas não resolve limite de duração da execução.

2) Estratégia definitiva (resumível por etapas)
Vamos transformar o importador em “job resumível” com checkpoints, em vez de “uma execução gigante”.

2.1 Mudanças de banco (migration)
- Evoluir `import_jobs` para suportar retomada:
  - `run_id` (uuid/text para correlacionar tentativas)
  - `phase` (`queued | downloading | processing | finalizing | completed | failed`)
  - `cursor` (inteiro: quantos itens já processados)
  - `last_heartbeat_at` (timestamp)
  - `attempt_count` (int)
  - `meta` (jsonb opcional com métricas)
- Índices úteis:
  - `(status, source, created_at desc)`
  - `(phase, last_heartbeat_at)`

2.2 Refatorar `supabase/functions/auto-import-jobs/index.ts`
- Novo fluxo por “janela de trabalho” (ex.: 60–90s por invocação):
  - Recebe `{ source, job_id?, cursor? }`.
  - Se `job_id` não vier, cria job novo em `queued/processing`.
  - Processa só uma fatia de lotes por invocação (não o arquivo inteiro).
  - Atualiza checkpoint (`cursor`, `processed_rows`, `last_heartbeat_at`) a cada progresso.
  - Antes de estourar orçamento de tempo, agenda/encadeia próxima invocação com mesmo `job_id`.
- Finalização:
  - Quando cursor alcançar total, roda `deactivate_expired_jobs`, marca `completed`.
- Resiliência:
  - Mantém retry em sub-lotes pequenos para statement timeout.
  - Em erro persistente: salva `error_message`, `failed`, com contexto de cursor.
- Proteção de concorrência:
  - Não permitir 2 execuções ativas para mesma source/job (lock lógico por status/phase).

2.3 Agendamento da madrugada (evitar contenção)
- Ajustar cron para não sobrepor fontes pesadas:
  - Exemplo seguro: JO 06:00, H2A 06:30, H2B 07:00 UTC
  - Ou manter disparo inicial e deixar o próprio job-chain continuar sem colisão.
- Se já existir job ativo da source, cron apenas “não duplica” e sai com log claro.

3) Correções de frontend (tirar falsos negativos)
Arquivo: `frontend/src/pages/AdminImport.tsx`
- Remover marcação automática de failed após 5 minutos:
  - Eliminar timeout fixo de `waitForJob` (ou aumentar para modo “sem timeout hard”, só avisar “ainda processando”).
  - Remover cleanup agressivo no mount que falha jobs com `created_at < 5min`.
- Trocar por lógica de “stale inteligente”:
  - Só considerar travado se `last_heartbeat_at` estiver muito antigo (ex.: >20–30 min) E status ainda processing.
- Histórico:
  - Exibir fase (`phase`) e “último heartbeat”, deixando claro que H2A pode levar mais tempo.

4) Observabilidade para fechar o problema
- Logs estruturados por job_id/source:
  - início, progresso (cursor/total), retries, fim.
- Mensagens de erro mais úteis:
  - distinguir timeout SQL vs runtime cutoff vs falha de autenticação.
- (Opcional) badge no histórico: “retomado X vezes”.

5) Sequência de implementação (ordem segura)
1. Migration de `import_jobs` (campos de checkpoint/heartbeat/phase).
2. Refactor do `auto-import-jobs` para execução resumível com encadeamento.
3. Ajuste dos cron jobs para evitar overlap e duplicidade.
4. Ajustes de UI em `AdminImport.tsx` para remover timeout de 5 min e ler heartbeat/phase.
5. Validação com teste real H2A:
   - disparar manualmente,
   - confirmar progresso contínuo por várias invocações,
   - confirmar `completed` e histórico correto sem “failed” falso.

6) Resultado esperado após aprovação
- H2A deixa de “morrer no meio” por limite de execução.
- Jobs longos continuam por múltiplas etapas até concluir (mesmo levando 30–60 min).
- Histórico passa a refletir estado real (sem falso timeout de 5 min).
- Rotina da madrugada fica estável e previsível.
