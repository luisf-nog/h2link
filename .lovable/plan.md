
Resumo do diagnóstico (com evidência real do projeto):

1) O número “37” no Radar não é o total bruto de matches
- Hoje o frontend filtra e esconde tudo que já está na fila:
  - Em `frontend/src/pages/Radar.tsx`, `fetchMatches()` busca `radar_matched_jobs` e depois remove jobs que existem em `my_queue` (bloco com `queuedSet`).
- Situação atual do seu usuário:
  - `radar_matched_jobs` total: 79
  - Desses, já na fila: 42
  - Restantes visíveis no Radar: 37
- Isso explica exatamente o “79 no backend vs 37 no front”.

2) Os 37 e os 42 vieram de momentos diferentes
- Consulta no banco mostrou:
  - 37 com `auto_queued=false` em ~13:00
  - 42 com `auto_queued=true` em ~17:03
- Ou seja: não foi “o mesmo lote”. Foram ciclos diferentes de matching/autoqueue.

3) O autopilot de envio está quebrando no processamento
- Logs do `process-queue` estão falhando repetidamente com:
  - `ReferenceError: job is not defined`
- Esse erro acontece dentro do bloco de erro, interrompe o loop e deixa itens em `processing`/`pending`.
- Resultado: vagas entram na fila, mas não seguem para envio como esperado.

4) Há inconsistência de regras entre Radar e Autopilot
- `process-radar` não aplica todos os critérios que o sistema usa em outros pontos:
  - faltam filtros como `max_experience` e `randomization_group`
  - limite fixo de 50 (`.limit(50)`) distorce leitura e consistência de contagem
- Isso abre margem para “o que aparece/conta no Radar” ≠ “o que o autopilot considera”.

Plano de correção (implementação):

Fase 1 — Consertar o gargalo crítico de envio automático
1. Corrigir `process-queue` para não quebrar no catch:
- Declarar variável do job fora do `try` (escopo seguro para `catch`).
- Garantir que logging de erro nunca lance exceção.
- Garantir que cada falha de item atualize status corretamente sem derrubar o processamento inteiro.

2. Tornar o loop resiliente por usuário:
- No modo cron, isolar erro por usuário (try/catch por usuário) para um usuário com erro não parar todos.
- Manter retorno consolidado de `processed/sent/failed`.

3. Recuperar itens presos:
- Adicionar rotina de “requeue” de itens `processing` estagnados (ex.: `processing_started_at` antigo) para `pending`, com `last_error` explicativo.
- Aplicar isso no início da execução do `process-queue` (ou em migration única + proteção contínua).

Fase 2 — Unificar critérios para “as informações se conversarem 100%”
4. Alinhar `process-radar` com a mesma regra de matching do Radar:
- Aplicar `max_experience`.
- Aplicar `randomization_group`.
- Manter exclusões (`job_reports`, banidas/inativas, já em fila).
- Remover ou revisar `limit(50)` (ou usar limite técnico maior com paginação/chunk), para não truncar universo de vagas.

5. Garantir comportamento esperado do autopilot:
- Se `auto_send=true`, todo match válido deve:
  - ir para `my_queue`
  - entrar no pipeline de envio automático sem ação manual na tela Queue
- O delay por plano continua no `process-queue` (já existe regra por tier).

Fase 3 — Transparência no front para não gerar confusão de números
6. Ajustar métricas do Radar para exibir 3 números explícitos:
- “Total matches detectados” (bruto)
- “Enviados para fila / em processamento”
- “Disponíveis no Live Feed” (não enfileirados)
Assim o usuário entende claramente por que 79 total pode aparecer como 37 no feed.

7. Exibir status visual de autopilot:
- Badge/linha: “Autopilot enviou X para fila nesta rodada”.
- Opcional: mini lista “Movidos para fila recentemente”.

Fase 4 — Validação ponta a ponta
8. Testes funcionais obrigatórios:
- Cenário A: Manual → gerar matches → ligar autopilot → confirmar que os matches válidos vão para fila automaticamente.
- Cenário B: Confirmar que a fila sai de `pending`/`processing` para `sent/failed` sem travar.
- Cenário C: Alterar filtro (ex. experiência) e validar que novos matches e autoqueue respeitam exatamente o critério selecionado.
- Cenário D: Verificar que os contadores (bruto, na fila, visível) batem com banco.

Ordem de execução sugerida (segura):
1) Fix `process-queue` + proteção de itens travados (impacto imediato no envio).
2) Corrigir critérios do `process-radar` (consistência de regra).
3) Melhorar transparência de contagem no Radar UI.
4) Rodar validação E2E com você.

Resultado esperado após correção:
- Sem divergência “misteriosa” entre Radar e fila.
- Autopilot realmente automático (sem precisar ação manual na Queue).
- Critérios aplicados de forma consistente em toda a cadeia.
- Números claros na interface: o que foi detectado, o que foi para fila e o que ainda está no feed.
