
# Fix: Sistema de Rastreamento de Abertura de Email (Pixel Tracking)

## Diagnostico

Apos analise detalhada, foram identificados os seguintes problemas:

1. **A funcao `track-email-open` NAO esta deployada** -- ao chamar a URL do pixel, retorna erro 404. Isso significa que NENHUM evento de abertura real esta sendo registrado.
2. **Tabela `pixel_open_events` tem 0 registros** -- consequencia direta do deploy faltante.
3. **Tabela `ip_blacklist` tem 0 registros** -- idem, nunca foi populada pois a funcao nunca executou.
4. **`my_queue.opened_at` tem dados inconsistentes** -- 790 de 835 itens enviados mostram como "abertos", mas com `email_open_count = 0`. Esses dados sao legados/corrompidos, nao vieram do pixel.
5. **`queue_send_history.open_count` e sempre 0** -- confirma que o pixel nunca funcionou.

## Solucao

### 1. Deploy da Edge Function `track-email-open`

A funcao ja existe em `frontend/supabase/functions/track-email-open/index.ts` com toda a logica necessaria (suspicion score, blacklist, debounce, bot detection). So precisa ser deployada.

### 2. Limpar dados corrompidos de `opened_at`

Resetar `my_queue.opened_at` para NULL nos registros onde `email_open_count = 0`, para que o sistema parta de um estado limpo e confiavel. Isso evita falsos positivos na interface.

```sql
UPDATE my_queue
SET opened_at = NULL
WHERE opened_at IS NOT NULL
AND email_open_count = 0;
```

### 3. Adicionar RLS na tabela `pixel_open_events`

A tabela `pixel_open_events` nao tem RLS configurada. Precisamos adicionar politicas para que usuarios vejam apenas seus proprios eventos (via join com `queue_send_history`).

### 4. Adicionar RLS na tabela `ip_blacklist`

Similarmente, `ip_blacklist` precisa de protecao. Apenas a service role deve ler/escrever nela.

### 5. Timestamp de envio (`s` parameter) no link do pixel

Atualmente o pixel no `process-queue` NAO inclui o parametro `s` (timestamp de envio) na URL. Embora o `track-email-open` use o `sent_at` da `queue_send_history` para o calculo de antivirus delay (que funciona corretamente), garantir consistencia e importante.

## Resumo das Mudancas

| Arquivo/Recurso | Acao |
|---|---|
| `track-email-open` | Deploy (ja existe, so falta deploy) |
| Migration SQL | Limpar `opened_at` corrompidos + RLS em `pixel_open_events` e `ip_blacklist` |
| Nenhuma mudanca de codigo | A logica do pixel e do `send-email-custom`/`process-queue` ja estao corretas |

## Resultado Esperado

Apos o deploy, o fluxo completo sera:
1. Email enviado com pixel (URL do `track-email-open` com `tracking_id`)
2. Empregador abre o email, pixel dispara
3. `track-email-open` calcula suspicion score, filtra bots
4. Aberturas genuinas atualizam `queue_send_history.open_count` e `my_queue.email_open_count`
5. Bots sao registrados em `pixel_open_events` com `is_genuine = false` e IPs suspeitos vao para `ip_blacklist`
6. Interface mostra dados de abertura confiaveis

Com isso funcionando, sera possivel calcular o percentual real de entrega/abertura e decidir se faz sentido focar no curriculo (Smart Profile) quando abaixo de 80%.
