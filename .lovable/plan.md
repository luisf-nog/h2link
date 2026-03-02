
Objetivo: parar definitivamente o travamento do H2A no meio, mesmo que o processo demore até 1h, adotando uma abordagem “contrária” ao desenho atual.

Resumo do que encontrei (evidência real)
1) O padrão de falha é consistente:
- H2A para em `processed_rows=1050`, `attempt_count=1`, `last_heartbeat_at` ~3-4 min após início.
- JO e H2B concluem normalmente.
- Isso aconteceu ao menos 2 vezes no mesmo ponto (1050/1928), então não é aleatório.

2) O encadeamento atual não está efetivamente retomando:
- Se houvesse retomada real, `attempt_count` deveria subir para 2+.
- Como fica em 1, a próxima execução não acontece (ou não persiste).

3) O erro real está sendo mascarado pelo frontend:
- `AdminImport.tsx` atualiza jobs “stale” para failed e sobrescreve `error_message`.
- Resultado: perdemos a causa raiz e enxergamos apenas “sem heartbeat por 20 min”.

4) Gargalo provável técnico:
- O loop de processamento pode ficar preso em uma chamada RPC longa (ou bloqueada) e não volta para executar `selfChain`.
- Como a verificação de deadline ocorre “entre batches”, uma chamada bloqueada pode matar a função antes do encadeamento.

Estratégia “fora da caixa” (recomendada)
Parar de depender de self-chain HTTP interno. Em vez disso:
“Pull-based resume” com cron frequente + lock de banco + janelas curtas.

Ideia central:
- Um cron roda a cada 1 minuto por fonte (ou um dispatcher único).
- Cada execução pega o job ativo da fonte e processa só uma fatia curta (ex.: 20–40s).
- Salva checkpoint e sai.
- Próximo tick continua do cursor.
- Sem auto-invocação HTTP entre funções.

Por que isso é melhor aqui:
- Remove o ponto frágil principal (função chamando a si mesma).
- Evita dependência de rede interna, DNS, permissões, timeout de fetch interno.
- Deixa retomada garantida por scheduler, não por “best effort” da mesma execução.

Plano de implementação
Fase 1 — Blindar diagnóstico (não mascarar erro)
1. Backend
- Em `auto-import-jobs`, gravar erro estruturado em `meta`:
  - `last_stage`, `last_batch_start`, `last_batch_size`, `last_exception`, `chain_status` (se ainda existir).
- Em falhas, nunca perder erro anterior: concatenar/append em `meta.errors[]`.

2. Frontend
- Em `AdminImport.tsx`, parar de sobrescrever `error_message` ao marcar stale.
- Se precisar marcar stale, usar:
  - `status='failed'`,
  - `phase='failed'`,
  - `error_message = COALESCE(error_message, 'Stale ...')`.
- Exibir `meta.last_stage` e “erro original” no histórico.

Fase 2 — Troca de arquitetura (contrária ao self-chain)
1. Refactor da função `supabase/functions/auto-import-jobs/index.ts`
- Remover dependência do `selfChain`.
- Novo modo padrão:
  - resolve/abre job ativo da source (ou cria novo),
  - processa janela curta com deadline rígido,
  - salva `cursor_pos`, `processed_rows`, `last_heartbeat_at`, `phase`,
  - retorna 200 com `done=true/false`.
- Se `done=false`, não invoca nada; só encerra.
- No próximo cron tick, a função reentra e continua.

2. Lock de concorrência por source
- Garantir um único worker por source:
  - lock lógico via status/phase + atualização atômica de “lease” no job,
  - (opcional forte) advisory lock por source.
- Se lock ocupado, responder “skip already running”.

3. Timeout explícito por batch RPC
- Envolver cada chamada RPC com timeout via `AbortController` (ex.: 15–25s).
- Se timeout:
  - quebrar batch em sub-batch menor,
  - registrar no `meta`,
  - continuar sem travar a execução inteira.
- Isso evita “morrer preso” no mesmo ponto 1050.

Fase 3 — Scheduler resiliente
1. Cron
- Manter horários de início (JO 06:00, H2B 06:10, H2A 06:30), mas adicionar ticks de continuidade:
  - Ex.: a cada minuto entre 06:30 e 07:30 para H2A, chamando mesma função/source.
  - A função só trabalha se houver job pendente/processing.
- Alternativa mais limpa: 1 cron/min por source 24h, com early-exit instantâneo se não há trabalho.

2. Critério de stale no backend (não no frontend)
- Criar rotina backend de watchdog:
  - stale só quando `last_heartbeat_at` muito antigo E `attempt_count` não mudou E sem lock ativo.
- UI passa a refletir, não decidir estado final.

Fase 4 — UX/observabilidade
1. Histórico admin
- Mostrar:
  - fase,
  - heartbeat age,
  - tentativa atual,
  - último erro técnico (sem truncar demais),
  - “retomado por cron” badge.
2. Contador
- Manter countdown já existente e incluir:
  - “janela de continuidade ativa” quando houver job long-running.

Riscos e mitigação
- Risco: aumentar chamadas cron.
  Mitigação: early-exit em <100ms quando não há job ativo.
- Risco: duplicidade de processamento.
  Mitigação: lock por source + cursor monotônico + idempotência via fingerprint no UPSERT.
- Risco: jobs presos sem erro claro.
  Mitigação: timeout por batch + meta de estágio + watchdog backend.

Critérios de sucesso (aceite)
1) H2A completa sem travar em 1050 em 3 execuções consecutivas.
2) `attempt_count` cresce ao longo do job (retomadas reais).
3) Sem “failed por stale” enquanto houver progresso por cron.
4) Erro original preservado no histórico (sem sobrescrita cega).
5) JO e H2B permanecem estáveis.

Arquivos que serão alterados
- `supabase/functions/auto-import-jobs/index.ts` (arquitetura pull-resume + timeout RPC + lock)
- `frontend/src/pages/AdminImport.tsx` (não sobrescrever erro, exibir meta/estado técnico)
- SQL de cron/data (ajuste de agendamentos para continuidade)
- (Opcional) migration leve para colunas de lease/watchdog, caso necessário

Sequência segura de execução
1. Ajustar frontend para não mascarar erro.
2. Refatorar função para modo pull-resume sem self-chain.
3. Ajustar cron de continuidade.
4. Rodar validação controlada com H2A manual e automática.
5. Ajustar thresholds finos (janela, timeout batch, sub-batch size) baseado em métricas reais.
