

## Investigação: Circuit Breaker no `send-email-custom` pausa itens já enviados

### Problema Confirmado

O código em `send-email-custom/index.ts` (linhas 837-842) tem um bug crítico:

```typescript
// Pause all pending queue items
await serviceClient
  .from("my_queue")
  .update({ status: "paused" })
  .eq("user_id", userId)
  .eq("status", "pending");
```

Quando o circuit breaker dispara (3+ `consecutive_errors`), ele pausa **todos** os itens com `status = "pending"` do usuário. Isso inclui itens que já foram enviados anteriormente e cujo status foi resetado para `"pending"` via o botão "Reenviar". Esses itens carregam dados de tracking antigos (`opened_at`, `email_open_count`, `profile_viewed_at`) que não são limpos, gerando a inconsistência visual que você viu: vagas "pausadas" mostrando "2x visualização".

### Cenário completo do bug

1. Item enviado com sucesso (status `sent`, tracking acumula aberturas)
2. Usuário clica "Reenviar" → status volta para `pending`, mas `opened_at`, `email_open_count`, `profile_viewed_at` **não são resetados**
3. Outro envio falha com erro SMTP crítico
4. `consecutive_errors` chega a 3
5. Circuit breaker pausa todos os `pending` → esse item volta a `paused` com dados de tracking "fantasma"

### Mesmo problema no `process-queue`

O `process-queue/index.ts` (linhas 980-989) tem a mesma lógica:
```typescript
if (consecutiveErrors >= 3) {
  await serviceClient.from("my_queue")
    .update({ status: "paused", last_error: "..." })
    .eq("user_id", userId)
    .eq("status", "pending");
}
```

### Plano de Correção

#### 1. Limpar dados de tracking ao reenviar (Frontend - `Queue.tsx`)

Quando o usuário clica "Reenviar", resetar os campos de tracking junto com o status:
- `opened_at: null`
- `email_open_count: 0`
- `profile_viewed_at: null`
- `send_count: 0` (ou manter para o limite de tentativas)
- `tracking_id: crypto.randomUUID()` (gerar novo tracking para não misturar dados)

#### 2. Adicionar `paused_reason` ao circuit breaker (Edge Functions)

Nos dois edge functions (`send-email-custom` e `process-queue`), ao pausar itens, incluir no `last_error` uma flag clara como `"[CIRCUIT_BREAKER]"` para que o frontend saiba diferenciar "pausado pelo sistema" vs "outro motivo".

#### 3. Validar status no tracker (`track-email-open`)

Adicionar verificação: só incrementar `email_open_count` e `opened_at` no `my_queue` se o item tem `status = 'sent'`. Isso previne que tracking de emails antigos polua itens que voltaram a `pending`/`paused`.

#### 4. Resetar `consecutive_errors` após sucesso

Verificar se o `send-email-custom` reseta `consecutive_errors = 0` após um envio bem-sucedido. Se não, corrigir para evitar que o circuit breaker dispare prematuramente em sessões futuras.

### Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `frontend/src/pages/Queue.tsx` | Limpar tracking ao reenviar (handleSendOne + handleRetryAllPaused) |
| `frontend/supabase/functions/send-email-custom/index.ts` | Resetar `consecutive_errors=0` após sucesso; melhorar `last_error` no circuit breaker |
| `frontend/supabase/functions/process-queue/index.ts` | Melhorar `last_error` no circuit breaker |
| `frontend/supabase/functions/track-email-open/index.ts` | Validar `status='sent'` antes de atualizar tracking |

