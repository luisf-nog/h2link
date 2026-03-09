

# Análise: Por que o envio de pausadas sempre para

## Diagnóstico — Causa Raiz Encontrada

Identifiquei **3 bugs** que juntos causam o problema. O principal é um **desalinhamento entre o limite que o frontend calcula e o limite que o backend aplica**.

---

## Bug 1 — Limite errado no Queue.tsx (CAUSA PRINCIPAL)

**O que acontece:**
- `Queue.tsx` (linha 107-109) calcula o limite diário usando o **teto do plano** (`PLANS_CONFIG[planTier].limits.daily_emails` = 150 para Gold, 350 para Diamond)
- Mas a Edge Function `send-email-custom` (linha 621-631) usa o **limite efetivo de warm-up** via `get_effective_daily_limit()`, que pode ser **20** (perfil conservativo no início do warm-up)
- Resultado: o frontend acha que tem 150 créditos, envia 20, e o servidor começa a rejeitar **todos os seguintes** com `daily_limit_reached`

**Prova:** O `Dashboard.tsx` (linha 62-68) já faz isso corretamente — usa `warmup.effectiveLimit` para planos pagos. Mas o `Queue.tsx` não usa.

**Fluxo do problema:**
```text
Retry All Paused (116 items)
  → Frontend: creditsRemaining = 150 (hard cap do plano)
  → Envia item 1... 20 → servidor aceita
  → Item 21 → servidor rejeita: "daily_limit_reached"
  → Frontend: abre diálogo de "upgrade" e para o loop
  → Usuário vê que parou, tenta de novo
  → Agora credits_used_today = 20 no banco
  → TODA tentativa seguinte falha no item 1
```

**Correção:** Usar `useWarmupStatus()` no `Queue.tsx` para calcular `remainingToday` com o limite efetivo (igual ao Dashboard).

---

## Bug 2 — `sendCancelled` nunca atualiza durante o loop

**O que acontece:**
- `sendCancelled` é desestruturado do Zustand no escopo de render (linha 89)
- Dentro do `sendQueueItems` (async), a variável é uma closure estática — nunca reflete updates da store
- O botão "Pausar" do `GlobalSendingBadge` atualiza a store, mas o loop não vê a mudança

**Consequência dupla:**
1. O botão "Pausar" não funciona para parar o envio
2. Se `sendCancelled` ficou `true` de uma pausa anterior, o próximo batch pode herdar esse valor no momento da chamada (antes do React re-renderizar após `setSendCancelled(false)`)

**Correção:** Usar `useQueueStore.getState().sendCancelled` dentro do loop para ler o valor atual da store.

---

## Bug 3 — Diálogo "Upgrade" enganoso

**O que acontece:**
- Quando o servidor retorna `daily_limit_reached`, o frontend abre `setUpgradeDialogOpen(true)` (linha 546)
- Mas o limite atingido é o de **warm-up**, não o do plano
- O usuário vê "faça upgrade" quando já está num plano pago, o que confunde

**Correção:** Diferenciar entre "limite de warm-up atingido" (mostrar progresso do warm-up) e "limite do plano atingido" (sugerir upgrade).

---

## Plano de Implementação

### 1. Queue.tsx — Usar limite efetivo de warm-up
- Importar `useWarmupStatus` 
- Substituir `PLANS_CONFIG[planTier].limits.daily_emails` pelo `effectiveLimit` do warm-up para planos pagos
- Manter o cálculo atual apenas para free tier

### 2. Queue.tsx — Corrigir closure de `sendCancelled`
- Dentro do loop `sendQueueItems`, trocar `if (sendCancelled)` por `if (useQueueStore.getState().sendCancelled)`
- Isso lê o valor atual da store a cada iteração, sem depender da closure

### 3. Queue.tsx — Melhorar feedback de `daily_limit_reached`
- Quando o servidor retorna `daily_limit_reached`, mostrar toast explicando o limite de warm-up em vez de abrir o diálogo de upgrade
- Incluir o limite atual e quantos foram enviados

### Arquivos afetados
- `frontend/src/pages/Queue.tsx` — único arquivo que precisa de alterações

