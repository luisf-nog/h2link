import { createClient } from "@supabase/supabase-js";

// Tenta buscar por todos os nomes comuns que o Lovable/Vite usam
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Atenção: Variáveis de ambiente do Supabase não detectadas. Verifique o arquivo .env");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
