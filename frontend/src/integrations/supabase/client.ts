import { createClient } from "@supabase/supabase-js";

// Pegando as variáveis do ambiente Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Tentamos pegar a ANON_KEY ou a PUBLISHABLE_KEY (comum em alguns templates)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Verificação de segurança para evitar o erro de "required"
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "ERRO: Supabase URL ou Anon Key não encontradas. Verifique seu arquivo .env ou as configurações de segredos do projeto.",
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
