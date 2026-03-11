import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cachedCount: number | null = null;
let lastFetchedAt = 0;
const STALE_MS = 60_000;

export function useActiveJobCount(): number | null {
  const [count, setCount] = useState<number | null>(cachedCount);

  useEffect(() => {
    if (cachedCount !== null && Date.now() - lastFetchedAt < STALE_MS) {
      setCount(cachedCount);
      return;
    }
    supabase
      .from("public_jobs")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .then(({ count: c }) => {
        if (c !== null) {
          cachedCount = c;
          lastFetchedAt = Date.now();
          setCount(c);
        }
      });
  }, []);

  return count;
}

export function formatJobCount(count: number | null, locale: string = "en"): string {
  if (count === null) return "10,000+";
  const formatted = new Intl.NumberFormat(locale === "en" ? "en-US" : "pt-BR", {
    maximumFractionDigits: 0,
  }).format(count);
  return `${formatted}+`;
}
