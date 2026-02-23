import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "node:url";
import { componentTagger } from "lovable-tagger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from both frontend/ and project root
  const rootEnv = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const localEnv = loadEnv(mode, __dirname, "");
  
  const SUPABASE_URL = localEnv.VITE_SUPABASE_URL || rootEnv.VITE_SUPABASE_URL || "";
  const SUPABASE_KEY = localEnv.VITE_SUPABASE_PUBLISHABLE_KEY || rootEnv.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  const SUPABASE_PROJECT_ID = localEnv.VITE_SUPABASE_PROJECT_ID || rootEnv.VITE_SUPABASE_PROJECT_ID || "";

  return {
    build: {
      outDir: 'build'
    },
    server: {
      port: 8080,
      host: '0.0.0.0',
      allowedHosts: true
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(SUPABASE_KEY),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(SUPABASE_PROJECT_ID),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
