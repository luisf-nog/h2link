import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "node:url";
import { componentTagger } from "lovable-tagger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  envDir: __dirname,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify("https://dalarhopratsgzmmzhxx.supabase.co"),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhbGFyaG9wcmF0c2d6bW16aHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODM5NDksImV4cCI6MjA4NDY1OTk0OX0.CIV7u2pMSudse-Zpfqf8OHLkm_exZn0EaYXVEFwoXTQ"),
    'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify("dalarhopratsgzmmzhxx"),
  },
  build: {
    outDir: 'build'
  },

  // Server configuration
  server: {
    port: 8080,
    host: '0.0.0.0',
    allowedHosts: true
  },
  
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/integrations/supabase/client": path.resolve(__dirname, "./src/lib/supabaseClient.ts"),
    },
  },
}));
