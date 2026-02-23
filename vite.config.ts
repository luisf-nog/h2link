import { defineConfig, loadEnv, type ConfigEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "node:url";
import { componentTagger } from "lovable-tagger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }: ConfigEnv) => {
  const env = loadEnv(mode, __dirname, "");

  const SUPABASE_URL = env.VITE_SUPABASE_URL || "https://dalarhopratsgzmmzhxx.supabase.co";
  const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ";
  const SUPABASE_PROJECT_ID = env.VITE_SUPABASE_PROJECT_ID || "dalarhopratsgzmmzhxx";

  return {
    base: '/',
    envDir: __dirname,
    build: { outDir: "dist" },
    server: { port: 8080, host: '0.0.0.0', allowedHosts: true as const },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(SUPABASE_KEY),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(SUPABASE_PROJECT_ID),
    },
    plugins: [react(), mode === "development" ? componentTagger() : undefined].filter(Boolean) as unknown as PluginOption[],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
