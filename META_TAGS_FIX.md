# 🔗 Configuração de Meta Tags para Compartilhamento

## Problema Identificado

Os meta tags do Open Graph (OG) não funcionam em SPAs (Single Page Applications) React porque:
- WhatsApp, Facebook, Twitter e outros crawlers **não executam JavaScript**
- Eles apenas leem o HTML estático inicial
- React Helmet injeta meta tags via JavaScript **DEPOIS** do crawl

## Solução Implementada

Criamos uma **Supabase Edge Function** que:
1. Gera HTML estático com meta tags corretos para cada vaga
2. Redireciona automaticamente para a página React
3. Permite que crawlers leiam os meta tags antes do redirecionamento

---

## 📁 Arquivos Criados

### `/frontend/supabase/functions/render-job-meta/index.ts`
Edge Function que:
- Busca dados da vaga no Supabase
- Gera HTML com meta tags dinâmicos
- Redireciona para a aplicação React

---

## 🚀 Como Fazer o Deploy

### 1. Fazer deploy da Edge Function no Supabase

```bash
# Na raiz do projeto
cd frontend

# Login no Supabase CLI (se ainda não estiver logado)
supabase login

# Link ao seu projeto
supabase link --project-ref dalarhopratsgzmmzhxx

# Deploy da função
supabase functions deploy render-job-meta
```

### 2. Configurar variáveis de ambiente

No dashboard do Supabase:
1. Vá para **Project Settings** → **Edge Functions**
2. Adicione as variáveis:
   - `APP_URL`: `https://h2linker.com` (ou seu domínio)
   - `SUPABASE_URL`: (já configurado automaticamente)
   - `SUPABASE_SERVICE_ROLE_KEY`: (já configurado automaticamente)

### 3. Testar a função

```bash
# Teste local
supabase functions serve render-job-meta

# Teste com curl
curl "http://localhost:54321/functions/v1/render-job-meta?jobId=ALGUM_ID_DE_VAGA"
```

---

## 🔗 Como Usar

### Opção 1: Redirecionamento Automático (Recomendado)

Configure sua rota `/job/:id` para primeiro chamar a Edge Function:

**No seu servidor/CDN/Vercel:**
```nginx
# Exemplo de configuração Nginx
location ~* ^/job/([a-zA-Z0-9-]+)$ {
    proxy_pass https://dalarhopratsgzmmzhxx.supabase.co/functions/v1/render-job-meta?jobId=$1;
}
```

**Ou no Vercel (`vercel.json`):**
```json
{
  "rewrites": [
    {
      "source": "/job/:id",
      "destination": "https://dalarhopratsgzmmzhxx.supabase.co/functions/v1/render-job-meta?jobId=:id"
    }
  ]
}
```

### Opção 2: Link Direto (Alternativa)

Ao compartilhar vagas, use o link da Edge Function:
```
https://dalarhopratsgzmmzhxx.supabase.co/functions/v1/render-job-meta?jobId=VAGA_ID
```

---

## 🧪 Como Testar

### 1. Teste com Facebook Debugger
```
https://developers.facebook.com/tools/debug/
```
Cole o link: `https://seu-dominio.com/job/VAGA_ID`

### 2. Teste com WhatsApp
1. Envie o link para você mesmo no WhatsApp
2. Verifique se o preview aparece com:
   - Título da vaga
   - Descrição (localização, salário, etc.)
   - Imagem (logo H2 Linker)

### 3. Teste com Twitter Card Validator
```
https://cards-dev.twitter.com/validator
```

---

## 🎯 Resultado Esperado

Quando você compartilhar um link de vaga:

**Antes:** 🚫
```
h2linker.com
Generic site description
Generic logo
```

**Depois:** ✅
```
H-2A: Crop Worker - ABC Farm
Job opportunity H-2A • Miami, FL • $15.50/hr
[Logo H2 Linker]
```

---

## 🔧 Manutenção

### Atualizar a função
```bash
cd frontend
supabase functions deploy render-job-meta
```

### Ver logs
```bash
supabase functions logs render-job-meta
```

---

## 📝 Notas Importantes

1. **Cache**: Redes sociais fazem cache dos meta tags. Para forçar atualização:
   - Facebook: Use o Debugger Tool
   - WhatsApp: Adicione `?v=2` no final do link

2. **Performance**: A Edge Function é serverless e muito rápida (~100-300ms)

3. **Fallback**: Se a função falhar, o HTML tem um redirecionamento JavaScript como backup

4. **SEO**: Esta solução também melhora o SEO para Google/Bing

---

## 🆘 Troubleshooting

### Meta tags não aparecem
1. Verifique se a função está deployada
2. Teste diretamente a URL da função
3. Limpe o cache do WhatsApp/Facebook

### Erro 404
- Verifique se o `jobId` existe no banco
- Confirme que a tabela `public_jobs` está acessível

### Redirect não funciona
- Verifique se `APP_URL` está configurado corretamente
- Teste o meta refresh e o JavaScript redirect

---

**Status:** ⚠️ **Configuração Pendente** - Aguardando deploy no Supabase
