import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Usar variáveis de ambiente (seguro)
// Fallback para valores hardcoded apenas em desenvolvimento local
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || (import.meta.env.DEV ? "https://dalarhopratsgzmmzhxx.supabase.co" : "");
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta.env.DEV
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ"
    : "");

// Validação: garantir que as variáveis existem em produção
if (!SUPABASE_URL || !SUPABASE_KEY) {
  const errorMsg =
    "Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables.";
  console.error(errorMsg);
  if (!import.meta.env.DEV) {
    throw new Error(errorMsg);
  }
}

// Cria o cliente usando variáveis de ambiente
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

if (import.meta.env.DEV) {
  console.log("Supabase client initialized ✅");
}
