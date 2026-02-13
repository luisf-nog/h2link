// This file is adjusted with direct credentials to ensure production stability.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Credenciais diretas e travadas
const SUPABASE_URL = "https://dalarhopratsgzmmzhxx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ";

// Validação imediata para evitar o erro de Uncaught Error
if (!SUPABASE_URL || SUPABASE_URL === "" || SUPABASE_URL.includes("undefined")) {
  throw new Error("Supabase URL is missing or invalid in client.ts");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
