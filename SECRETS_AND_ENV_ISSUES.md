# 🔒 Relatório de Problemas com Secrets e Variáveis de Ambiente

## ⚠️ PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. **SECRETS HARDCODED NO FRONTEND** 🔴 CRÍTICO
**Arquivo:** `frontend/src/integrations/supabase/client.ts`

**Problema:**
```typescript
// Chaves hardcoded expostas no código
const SUPABASE_URL = "https://dalarhopratsgzmmzhxx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

**Risco:** 
- Secrets expostos no código fonte
- Qualquer pessoa pode ver as chaves no repositório
- Violação de segurança grave

**Solução Necessária:**
- Usar variáveis de ambiente: `import.meta.env.VITE_SUPABASE_URL`
- Adicionar validação para garantir que as variáveis existem

---

### 2. **USO DE NON-NULL ASSERTION (`!`)** 🟡 MÉDIO
**Arquivos Afetados:** Múltiplas Edge Functions

**Problema:**
Muitas funções usam `Deno.env.get("VAR")!` sem verificar se a variável existe:
```typescript
// Exemplo problemático
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
```

**Risco:**
- Se a variável não existir, retorna `undefined` e causa erro em runtime
- Dificulta diagnóstico de problemas de configuração

**Arquivos Afetados:**
- `frontend/supabase/functions/send-email-custom/index.ts` (6 ocorrências)
- `frontend/supabase/functions/process-queue/index.ts` (4 ocorrências)
- `frontend/supabase/functions/track-email-open/index.ts` (2 ocorrências)
- `frontend/supabase/functions/save-smtp-credentials/index.ts` (4 ocorrências)
- `frontend/supabase/functions/reset-daily-credits/index.ts` (2 ocorrências)
- `frontend/supabase/functions/render-job-meta/index.ts` (2 ocorrências)
- `frontend/supabase/functions/generate-template/index.ts` (4 ocorrências)
- `frontend/supabase/functions/import-jobs/index.ts` (2 ocorrências)
- `frontend/supabase/functions/parse-resume/index.ts` (4 ocorrências)
- `frontend/supabase/functions/generate-job-email/index.ts` (4 ocorrências)
- `frontend/supabase/functions/generate-email-template/index.ts` (4 ocorrências)
- `frontend/supabase/functions/apply-referral-code/index.ts` (4 ocorrências)
- `frontend/supabase/functions/check-dns-mx/index.ts` (2 ocorrências)

**Solução Necessária:**
- Validar variáveis antes de usar
- Retornar erros claros se faltarem variáveis

---

### 3. **BACKEND PYTHON - KeyError Potencial** 🟡 MÉDIO
**Arquivo:** `backend/server.py`

**Problema:**
```python
# Linha 27-29: Pode lançar KeyError se variável não existir
mongo_url = os.environ['MONGO_URL']  # ❌ KeyError se não existir
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]  # ❌ KeyError se não existir
```

**Risco:**
- Aplicação não inicia se variáveis estiverem faltando
- Erro não é claro sobre qual variável está faltando

**Solução Necessária:**
- Usar `os.environ.get()` com valores padrão ou validação
- Adicionar mensagens de erro claras

---

### 4. **FALTA DE VALIDAÇÃO DE VARIÁVEIS CRÍTICAS** 🟡 MÉDIO

**Problemas Encontrados:**

#### a) `LOVABLE_API_KEY` sem validação adequada
- `process-queue/index.ts` linha 647: Verifica mas não retorna erro claro
- `parse-resume/index.ts` linha 82: Retorna erro genérico
- `generate-template/index.ts` linha 143: Não verifica antes de usar

#### b) `STRIPE_SECRET_KEY` com fallback vazio
- `stripe-webhook/index.ts` linha 5: `Deno.env.get("STRIPE_SECRET_KEY") || ""`
- `reprocess-upgrade/index.ts` linha 10: Similar
- `create-payment/index.ts` linha 30: Similar

**Risco:**
- Stripe pode falhar silenciosamente se a chave estiver vazia
- Dificulta diagnóstico

---

## 📋 VARIÁVEIS DE AMBIENTE NECESSÁRIAS

### Edge Functions (Deno)
- `SUPABASE_URL` ✅ (usado em todas as funções)
- `SUPABASE_ANON_KEY` ✅ (usado em várias funções)
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (usado em várias funções)
- `LOVABLE_API_KEY` ⚠️ (usado mas não sempre validado)
- `STRIPE_SECRET_KEY` ⚠️ (usado com fallback vazio)
- `STRIPE_WEBHOOK_SECRET` ⚠️ (usado com fallback vazio)
- `APP_URL` ⚠️ (usado com fallback)

### Backend Python
- `MONGO_URL` ❌ (pode causar KeyError)
- `DB_NAME` ❌ (pode causar KeyError)
- `SUPABASE_URL` ✅ (validado)
- `SUPABASE_KEY` ✅ (validado)
- `APP_URL` ✅ (tem fallback)
- `CORS_ORIGINS` ✅ (tem fallback)

### Frontend
- `VITE_SUPABASE_URL` ⚠️ (não usado, hardcoded)
- `VITE_SUPABASE_PUBLISHABLE_KEY` ⚠️ (não usado, hardcoded)

---

## ✅ RECOMENDAÇÕES DE CORREÇÃO

### Prioridade ALTA 🔴
1. **Remover secrets hardcoded** de `client.ts`
2. **Adicionar validação** para todas as variáveis críticas nas Edge Functions
3. **Corrigir backend Python** para usar `.get()` com validação

### Prioridade MÉDIA 🟡
4. **Criar função helper** para validar variáveis de ambiente
5. **Adicionar logs** quando variáveis estiverem faltando
6. **Documentar** todas as variáveis necessárias em `.env.example`

### Prioridade BAIXA 🟢
7. **Adicionar testes** para verificar configuração
8. **Criar script** de validação de ambiente

---

## 📝 EXEMPLO DE CORREÇÃO

### Antes (❌ Problemático):
```typescript
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
```

### Depois (✅ Seguro):
```typescript
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}
```

---

## 🔍 ARQUIVOS PARA REVISAR

1. `frontend/src/integrations/supabase/client.ts` - **CRÍTICO**
2. `backend/server.py` - **MÉDIO**
3. Todas as Edge Functions em `frontend/supabase/functions/` - **MÉDIO**

---

**Data do Relatório:** $(date)
**Total de Problemas Encontrados:** 4 categorias principais
**Arquivos Afetados:** ~15 arquivos

