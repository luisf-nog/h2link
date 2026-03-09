import { describe, it, expect } from "vitest";

// Replica da função do edge function para teste
// Edge functions rodam em Deno, testes frontend em Node/Vitest
type PlanTier = "free" | "gold" | "diamond" | "black";

function getDelayMs(planTier: PlanTier): number {
  if (planTier === "gold") return 15_000; // 15s fixo
  if (planTier === "diamond") return 60_000 + Math.floor(Math.random() * 120_001); // 1-3 minutos
  if (planTier === "black") return 60_000 + Math.floor(Math.random() * 240_001); // 1-5 minutos
  return 0; // free: sem delay
}

describe("getDelayMs", () => {
  it("retorna 0ms para plano free", () => {
    expect(getDelayMs("free")).toBe(0);
  });

  it("retorna 15000ms fixo para plano gold", () => {
    expect(getDelayMs("gold")).toBe(15_000);
  });

  it("retorna entre 1-3 minutos para plano diamond", () => {
    for (let i = 0; i < 100; i++) {
      const delay = getDelayMs("diamond");
      expect(delay).toBeGreaterThanOrEqual(60_000);
      expect(delay).toBeLessThanOrEqual(180_000);
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
