// src/integrations/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

// Tentamos pegar das variáveis de ambiente primeiro (boa prática)
// Se falhar, usamos os valores que você forneceu para não travar o app
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dalarhopratsgzmmzhxx.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ";

// Criamos o cliente garantindo que os valores não sejam vazios
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Log para te ajudar a debugar no console do navegador se as variáveis estão vindo do ambiente ou do código
if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn("Aviso: VITE_SUPABASE_URL não encontrada no ambiente. Usando URL de fallback.");
}
