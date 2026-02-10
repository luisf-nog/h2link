import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// --- CONFIGURAÇÃO MANUAL (Fallbacks) ---
// Usamos estes valores caso as variáveis de ambiente (import.meta.env) falhem no carregamento.
const PROJECT_URL = "https://dalarhopratsgzmmzhxx.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ";

// Tenta pegar do .env, se não existir, usa o valor direto (Hardcoded)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PROJECT_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ANON_KEY;

// Log para confirmar que carregou (pode remover depois se quiser limpar o console)
console.log(
  `✅ Supabase Client initialized via: ${import.meta.env.VITE_SUPABASE_URL ? "Environment Variables" : "Hardcoded Fallback"}`,
);

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERRO CRÍTICO: Credenciais do Supabase não encontradas.");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
