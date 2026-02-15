import { createClient } from "@supabase/supabase-js";

// Pegando as variáveis do ambiente .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Validação de segurança para evitar o erro "is required"
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERRO CRÍTICO: Variáveis do Supabase não encontradas no .env");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co", // Fallback para não quebrar o build
  supabaseAnonKey || "placeholder-key",
);
