

# Plano: Teste Unitário para getDelayMs + Delay Black 1-5 minutos

## Resumo

Criar teste unitário para a função `getDelayMs` e atualizar o delay do plano Black para o intervalo de 1-5 minutos (60.000ms - 300.000ms).

## Alterações Necessárias

### 1. Atualizar função getDelayMs no Edge Function

**Arquivo:** `supabase/functions/process-queue/index.ts`

Alterar a função atual:
```typescript
// ANTES (linha 453-457)
function getDelayMs(planTier: PlanTier): number {
  if (planTier === "gold") return 15_000;
  if (planTier === "diamond") return 15_000 + Math.floor(Math.random() * 30_001);
  return 0;
}
```

Para:
```typescript
// DEPOIS
function getDelayMs(planTier: PlanTier): number {
  if (planTier === "gold") return 15_000; // 15s fixo
  if (planTier === "diamond") return 15_000 + Math.floor(Math.random() * 30_001); // 15-45s
  if (planTier === "black") return 60_000 + Math.floor(Math.random() * 240_001); // 1-5 minutos
  return 0; // free: sem delay
}
```

**Regras por Plano:**
| Plano | Delay | Descrição |
|-------|-------|-----------|
| Free | 0s | Sem delay |
| Gold | 15s | Fixo |
| Diamond | 15-45s | Aleatório |
| Black | 60-300s (1-5 min) | Humano inteligente |

### 2. Criar Teste Unitário

**Arquivo:** `src/test/getDelayMs.test.ts`

```typescript
import { describe, it, expect } from "vitest";

// Replica da função do edge function para teste
type PlanTier = "free" | "gold" | "diamond" | "black";

function getDelayMs(planTier: PlanTier): number {
  if (planTier === "gold") return 15_000;
  if (planTier === "diamond") return 15_000 + Math.floor(Math.random() * 30_001);
  if (planTier === "black") return 60_000 + Math.floor(Math.random() * 240_001);
  return 0;
}

describe("getDelayMs", () => {
  it("retorna 0ms para plano free", () => {
    expect(getDelayMs("free")).toBe(0);
  });

  it("retorna 15000ms fixo para plano gold", () => {
    expect(getDelayMs("gold")).toBe(15_000);
  });

  it("retorna entre 15-45s para plano diamond", () => {
    for (let i = 0; i < 100; i++) {
      const delay = getDelayMs("diamond");
      expect(delay).toBeGreaterThanOrEqual(15_000);
      expect(delay).toBeLessThanOrEqual(45_000);
    }
  });

  it("retorna entre 1-5 minutos para plano black", () => {
    for (let i = 0; i < 100; i++) {
      const delay = getDelayMs("black");
      expect(delay).toBeGreaterThanOrEqual(60_000);
      expect(delay).toBeLessThanOrEqual(300_000);
    }
  });
});
```

O teste usa uma réplica da função porque edge functions rodam em Deno e os testes frontend rodam em Node/Vitest. Isso garante que a lógica esteja documentada e validada.

## Arquivos a Modificar

1. `supabase/functions/process-queue/index.ts` - Adicionar caso Black na função getDelayMs
2. `src/test/getDelayMs.test.ts` - Criar arquivo de teste

## Resultado Esperado

- Plano Black terá delay aleatório entre 1-5 minutos, simulando comportamento humano
- Testes validam todos os 4 planos com seus intervalos corretos
- Documentação clara da lógica de delay por plano

