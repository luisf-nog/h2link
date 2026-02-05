import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// --- CONFIGURAÇÃO DEFINITIVA (Resgatada do seu código) ---
const SUPABASE_URL = "https://dalarhopratsgzmmzhxx.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ";

console.log("Supabase Conectado em:", SUPABASE_URL);

// Cria o cliente usando as chaves diretas
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
