import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Fallback para evitar tela branca se a variável falhar
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://dalarhopratsgzmmzhxx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "placeholder-key";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
