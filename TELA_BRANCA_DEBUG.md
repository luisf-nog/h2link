# 🔍 Diagnóstico: Tela Branca no Lovable

## Problema Reportado
Após as correções, a aplicação mostra tela branca no Lovable.

## Possíveis Causas

### 1. Variáveis de Ambiente Faltando
**Sintoma**: Supabase client falha ao inicializar
**Solução Aplicada**: 
- Adicionados fallbacks com valores padrão em `src/integrations/supabase/client.ts`
- Agora usa as chaves originais se env vars não estiverem disponíveis

### 2. Erro de Inicialização do React
**Solução Aplicada**:
- Adicionado error boundary em `src/main.tsx`
- Se houver erro, mostra mensagem de erro em vez de tela branca

### 3. Caminho de Assets Incorreto
**Verificado**: 
- `index.html` correto com script apontando para `/src/main.tsx`
- Build gerando corretamente em `dist/`

## Como Diagnosticar no Lovable

### Passo 1: Abrir Console do Navegador
1. Pressione F12 ou Ctrl+Shift+I
2. Vá para a aba "Console"
3. Procure por erros em vermelho

### Passo 2: Verificar Network
1. Na aba "Network" do DevTools
2. Recarregue a página
3. Verifique se todos os assets carregam (status 200)
4. Procure por arquivos 404 ou com erro

### Passo 3: Variáveis de Ambiente
No painel do Lovable, verifique se estas variáveis estão configuradas:
```
VITE_SUPABASE_URL=https://dalarhopratsgzmmzhxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=dalarhopratsgzmmzhxx
VITE_BACKEND_URL=https://codebase-sync-69.preview.emergentagent.com
VITE_APP_DOMAIN=h2linker.com
```

## Testes Locais Realizados

✅ Build: Sucesso
✅ Preview local: Funciona
✅ Assets gerados: Todos presentes em dist/
✅ JavaScript: Sem erros de sintaxe

## Próximos Passos

1. **Verificar Console**: O erro específico estará no console do navegador
2. **Rebuild**: Forçar um novo build no Lovable (limpar cache)
3. **Env Vars**: Confirmar configuração no painel do Lovable
4. **Base Path**: Se o Lovable usar subdomínio/subpath, pode precisar configurar base

## Configuração Adicional Necessária?

Se o Lovable usar um subpath (ex: `lovable.app/seu-projeto`), adicionar ao vite.config.ts:

```typescript
export default defineConfig(({ mode }: ConfigEnv) => ({
  base: './', // ou o caminho específico
  // ... resto da config
}));
```

---

**Para debug imediato**: Por favor, envie screenshot do console do navegador (F12) mostrando os erros em vermelho.
