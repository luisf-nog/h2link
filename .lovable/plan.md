

## Diagnóstico: Emails enviados sendo marcados como "paused"

### Causa raiz encontrada

O problema é uma **race condition** entre o envio e o `fetchQueue`. Veja a sequência:

```text
1. sendQueueItems() marca item como "processing" (status = processing, processing_started_at = now)
2. Email é enviado com sucesso → item.id vai para sentIds[]
3. Loop continua com delay entre emails (até 5 min no Black)
4. DURANTE O DELAY: o setInterval de 30s dispara fetchQueue()
   → Mesmo com o guard sendingRef, o heartbeat PODE rodar entre envios
5. fetchQueue() roda a auto-recovery:
   → "qualquer item processing há >10 min → status = paused"
6. Mas o VERDADEIRO problema: os sentIds só são persistidos no banco DEPOIS do loop (linhas 718-733)
   → O item está "processing" no banco enquanto espera o loop terminar
   → Se o lote demora >10 min total, fetchQueue pausa itens que JÁ foram enviados
7. Linha 724: .update({ status: "sent" }).eq("id", sentId)
   → Mas o fetchQueue JÁ mudou para "paused" → o update para "sent" SOBRESCREVE
   → Ou pior: o fetchQueue roda DEPOIS do update para "sent" e não pega (pq filtrou por status=processing)
```

**O bug central:** O status "sent" é gravado no banco **em lote no final do loop** (linhas 718-733), não imediatamente após cada envio bem-sucedido. Enquanto isso, o item permanece como "processing" no banco e fica vulnerável à auto-recovery.

### Correção

**Mover a persistência de "sent" para dentro do loop**, imediatamente após cada envio bem-sucedido — eliminando a janela de tempo em que o item fica "processing" no banco após já ter sido enviado.

1. **Dentro do loop de envio** (após confirmação de sucesso): gravar `status: "sent"` e inserir `queue_send_history` imediatamente, em vez de acumular em `sentIds[]`
2. **Remover o loop final** (linhas 718-733) que faz batch update dos sentIds
3. **Manter sentIds** apenas para contagem/toast no final

### Arquivo a editar
- `frontend/src/pages/Queue.tsx` — mover persistência de "sent" para dentro do loop de envio

