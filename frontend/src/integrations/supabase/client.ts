import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// --- CONFIGURAÇÃO MANUAL (Hardcoded para evitar erros do Lovable) ---
// Chaves fixas para garantir que o site não quebre
const SUPABASE_URL = "https://dalarhopratsgzmmzhxx.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ";

// Cria o cliente usando as chaves fixas
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

console.log("Supabase Reconectado Manualmente ✅");
