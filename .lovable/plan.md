

# Plano Definitivo: Resolver "supabaseUrl is required"

## Diagnostico da Causa Raiz

O projeto tem **DUAS** estruturas Vite separadas:

```text
RAIZ (o que o Lovable USA de fato):
  vite.config.ts        <-- SEM define block, SEM fallbacks
  index.html            <-- <script src="/src/main.tsx">
  src/                  <-- codigo fonte real
  .env                  <-- auto-gerado pelo Lovable Cloud

FRONTEND (onde TODAS as correções foram aplicadas):
  frontend/vite.config.ts  <-- COM define block, COM fallbacks
  frontend/index.html
  frontend/src/
  frontend/.env
```

**Todas as 6 tentativas anteriores modificaram `frontend/vite.config.ts`** -- um arquivo que o Lovable **nao usa**. O ambiente Lovable roda a partir da raiz, usando o `vite.config.ts` da raiz, que nao tem nenhum `define` block nem fallbacks para as credenciais do Supabase.

## Solucao

Adicionar o bloco `define` com as credenciais publicas (anon key) diretamente no **`vite.config.ts` da raiz** -- o unico que o Lovable efetivamente usa.

## Mudancas Tecnicas

### Arquivo: `vite.config.ts` (RAIZ)

Adicionar `loadEnv` ao import e um bloco `define` com fallbacks hardcoded para as chaves publicas do Supabase:

```typescript
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
```

### Por que isso resolve

- A anon key do Supabase e uma chave **publica** (nao e um segredo), entao pode ficar no codigo
- O bloco `define` garante que `import.meta.env.VITE_SUPABASE_URL` sera substituido pelo valor correto durante o build/dev, independente de o `.env` ser encontrado ou nao
- Desta vez estamos editando o arquivo **certo** -- o da raiz

### Nenhuma outra mudanca necessaria

- `src/integrations/supabase/client.ts` -- NAO TOCAR (auto-gerado)
- `frontend/vite.config.ts` -- irrelevante para o ambiente Lovable
- `.env` -- auto-gerado pelo Lovable Cloud

