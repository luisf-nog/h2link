import { defineConfig, type ConfigEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "node:url";
import { componentTagger } from "lovable-tagger";

// In some environments Vite config is evaluated as ESM, where __dirname is not defined.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }: ConfigEnv) => ({
  base: '/', // Use absolute paths from root (works with nested routes)
  build: {
    outDir: "dist",
  },

  // Server configuration
  server: {
    port: 8080,
    host: '0.0.0.0',
    allowedHosts: true as const,
  },
  
  plugins: [react(), mode === "development" ? componentTagger() : undefined].filter(Boolean) as unknown as PluginOption[],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
