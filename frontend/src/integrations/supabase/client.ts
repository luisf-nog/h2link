import { createClient } from "@supabase/supabase-js";

// Tenta pegar do ambiente, mas se falhar, usa os seus valores reais
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dalarhopratsgzmmzhxx.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ";

// Validação final para o console
if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
  console.error("Erro Crítico: Supabase URL não configurada.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
