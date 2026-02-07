import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Usar variáveis de ambiente (seguro)
// Fallback para valores hardcoded se variáveis não estiverem configuradas
// NOTA: Em produção, configure as variáveis de ambiente para maior segurança
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://dalarhopratsgzmmzhxx.supabase.co";
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ";

// Aviso (não erro) se usando valores padrão
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    "⚠️ Supabase credentials usando valores padrão. Para maior segurança, configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY nas variáveis de ambiente."
  );
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
