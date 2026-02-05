import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Tenta pegar a URL
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Tenta pegar a chave com AMBOS os nomes comuns (para garantir que funcione)
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// 🕵️ DEBUG: Isso vai aparecer no Console do navegador (F12)
console.log("Supabase Debug:", {
  url_presente: !!SUPABASE_URL,
  key_presente: !!SUPABASE_KEY,
  url_valor: SUPABASE_URL ? "OK" : "VAZIO",
});

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERRO CRÍTICO: URL ou Chave do Supabase não encontradas. Verifique o arquivo .env ou Secrets.");
}

// Criação do cliente com tratamento de erro
export const supabase = createClient<Database>(SUPABASE_URL || "", SUPABASE_KEY || "", {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
