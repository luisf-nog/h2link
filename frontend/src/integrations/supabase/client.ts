import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Tenta pegar as variáveis. Se não existirem (ainda), usa uma string vazia.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// LOG DE DEPURAÇÃO (Aparecerá no console do navegador se falhar)
if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase Env Vars missing directly in client.ts. Using placeholders to prevent crash.");
}

// O TRUQUE: Usamos um fallback ('https://...') para que o construtor do createClient
// NÃO jogue o erro "supabaseUrl is required".
// Assim o app abre, e se a variável carregar depois ou se for erro de configuração,
// o erro aparecerá apenas quando você tentar fazer uma query, não na tela branca.
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder-project.supabase.co",
  supabaseKey || "placeholder-anon-key",
);
