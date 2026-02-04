# 🌐 Configuração do Domínio h2linker.com

## 📋 Objetivo

Configurar o domínio customizado **h2linker.com** para que os links de compartilhamento fiquem amigáveis:

**Atual:** `https://visa-type-badge-fix.preview.emergentagent.com/job/123`
**Desejado:** `https://h2linker.com/job/123`

---

## 🎯 Como Funciona o Sistema de Compartilhamento

### **1. Usuário Compartilha Vaga:**
```
Usuário vê vaga → Clica "Compartilhar" → Copia link
```

### **2. Link é Colado no WhatsApp:**
```
WhatsApp busca preview → Backend gera meta tags → Mostra:
├─ Nome da vaga
├─ Quantidade de vagas
├─ Localização
├─ Salário
└─ Logo H2 Linker
```

### **3. Alguém Clica no Link:**
```
Acessa URL → Backend redireciona → SharedJobView mostra detalhes completos
```

---

## 🔧 Configuração do Domínio

### **Passo 1: Registrar/Verificar Domínio**

Se ainda não tem o domínio `h2linker.com`:
1. Registre em um provedor (Namecheap, GoDaddy, etc.)
2. Aguarde propagação DNS (24-48h)

---

### **Passo 2: Configurar DNS**

No painel do seu provedor de domínio, adicione os registros DNS:

#### **Para Lovable (Preview):**
```
Type: CNAME
Name: @
Value: <seu-app>.preview.emergentagent.com
TTL: 3600
```

#### **Para Vercel (Produção):**
```
Type: CNAME
Name: @
Value: cname.vercel-dns.com
TTL: 3600
```

#### **Subdomínio WWW (opcional):**
```
Type: CNAME
Name: www
Value: h2linker.com
TTL: 3600
```

---

### **Passo 3: Configurar no Lovable**

1. **Vá para o Dashboard do Lovable:**
   - https://lovable.dev

2. **Abra seu projeto "H2 Linker"**

3. **Vá em Settings → Custom Domain:**
   - Clique em "Add Custom Domain"
   - Digite: `h2linker.com`
   - Clique em "Verify"

4. **Configure SSL:**
   - Lovable vai provisionar SSL automaticamente
   - Aguarde 5-10 minutos

5. **Teste:**
   ```bash
   curl -I https://h2linker.com
   ```

---

### **Passo 4: Atualizar Variáveis de Ambiente**

#### **Backend (.env):**
```env
APP_URL="https://h2linker.com"
VITE_BACKEND_URL="https://api.h2linker.com"  # ou usar subdomínio
```

#### **Frontend (.env):**
```env
VITE_BACKEND_URL="https://h2linker.com"
```

#### **Aplicar mudanças:**
```bash
cd /app
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

---

### **Passo 5: Atualizar Código de Compartilhamento**

Atualizar URLs no código para usar o novo domínio:

**Arquivo:** `src/pages/Jobs.tsx` e `src/pages/SharedJobView.tsx`

```typescript
// ANTES
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://visa-type-badge-fix.preview.emergentagent.com';

// DEPOIS  
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://h2linker.com';
```

---

## 🧪 Como Testar

### **Teste 1: DNS Propagado**
```bash
nslookup h2linker.com
# Deve retornar o IP correto
```

### **Teste 2: SSL Funcionando**
```bash
curl -I https://h2linker.com
# Deve retornar: HTTP/2 200
```

### **Teste 3: Compartilhamento**
1. Acesse https://h2linker.com/jobs
2. Clique em uma vaga
3. Clique em "Compartilhar"
4. Cole no WhatsApp
5. **Verifique preview:**
   - ✅ Nome da vaga aparece
   - ✅ Quantidade de vagas
   - ✅ Localização
   - ✅ Salário
   - ✅ Logo H2 Linker

### **Teste 4: Link Direto**
```bash
curl "https://h2linker.com/job/1281a942-0fec-4783-8e07-9b0464812d60" | grep "og:title"
```

Deve retornar meta tags corretos.

---

## 📊 Estrutura de URLs

### **URLs do Domínio:**

```
https://h2linker.com/              → Homepage/Auth
https://h2linker.com/jobs          → Lista de vagas
https://h2linker.com/job/[id]      → Meta tags + Redirect
https://h2linker.com/queue         → Fila do usuário
https://h2linker.com/dashboard     → Dashboard
```

### **Backend API (mesma URL):**

```
https://h2linker.com/api/          → API do FastAPI
https://h2linker.com/job/[id]      → Geração de meta tags
```

---

## 🔒 SSL/HTTPS

### **Lovable (Auto SSL):**
- Lovable provisiona SSL automaticamente via Let's Encrypt
- Renovação automática
- Sem configuração manual

### **Vercel (Auto SSL):**
- Vercel também provisiona SSL automaticamente
- Edge Network global
- Sem configuração manual

---

## 🚀 Deploy em Produção

### **Opção 1: Lovable**

1. Configurar domínio no Lovable
2. Sync do GitHub
3. Deploy automático

### **Opção 2: Vercel**

1. Conectar repositório GitHub
2. Configurar build:
   ```json
   {
     "buildCommand": "cd frontend && yarn build",
     "outputDirectory": "frontend/build",
     "framework": "vite"
   }
   ```
3. Adicionar domínio customizado
4. Deploy automático

---

## 📝 Checklist de Configuração

### **DNS:**
- [ ] Domínio registrado
- [ ] Registro CNAME adicionado
- [ ] Propagação DNS verificada (24-48h)
- [ ] WWW redirecionando para apex

### **Plataforma (Lovable/Vercel):**
- [ ] Domínio customizado adicionado
- [ ] SSL provisionado e ativo
- [ ] Verificação de domínio concluída

### **Backend:**
- [ ] APP_URL atualizado para h2linker.com
- [ ] VITE_BACKEND_URL configurado
- [ ] Backend reiniciado

### **Frontend:**
- [ ] VITE_BACKEND_URL atualizado
- [ ] Código de compartilhamento atualizado
- [ ] Frontend rebuildo e reiniciado

### **Testes:**
- [ ] DNS resolve corretamente
- [ ] HTTPS funciona sem erros
- [ ] Compartilhamento no WhatsApp mostra preview
- [ ] Link direto mostra detalhes da vaga
- [ ] Meta tags corretos (og:title, og:image, etc.)

---

## 🆘 Troubleshooting

### **DNS não propaga**
- Aguardar 24-48h
- Verificar registros no provedor
- Usar ferramenta: https://dnschecker.org

### **SSL não funciona**
- Aguardar 5-10 minutos após adicionar domínio
- Verificar se CNAME está correto
- Forçar reprovisioning no dashboard

### **Preview não aparece no WhatsApp**
- Limpar cache: https://developers.facebook.com/tools/debug/
- Verificar meta tags: `curl -I url`
- Testar backend: `curl backend-url/job/id`

### **Redirecionamento não funciona**
- Verificar se backend está rodando
- Conferir logs: `tail -f /var/log/supervisor/backend.err.log`
- Testar rota diretamente: `curl backend/job/id`

---

## 📞 Suporte

Se precisar de ajuda:
1. Verifique logs do backend e frontend
2. Teste URLs diretamente com curl
3. Use Facebook Debugger para meta tags
4. Consulte documentação da plataforma (Lovable/Vercel)

---

**Status:** ⚠️ Aguardando configuração do domínio customizado
**Próximo:** Configurar h2linker.com no Lovable ou Vercel
