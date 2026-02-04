# Configuração DNS h2linker.com

## ⚠️ IMPORTANTE: Configuração Necessária

Para que o sistema funcione completamente com h2linker.com, é necessário configurar o DNS.

## Configuração DNS

O domínio `h2linker.com` precisa apontar para o mesmo servidor/IP da aplicação atual.

### Opções de Configuração:

1. **CNAME Record** (Recomendado se possível):
   ```
   h2linker.com → visa-type-badge-fix.preview.emergentagent.com
   ```

2. **A Record** (Se tiver acesso ao IP):
   ```
   h2linker.com → [IP do servidor]
   ```

## Como Funciona

1. **Link de Compartilhamento**: `https://h2linker.com/api/job/{id}`
   - Rota de backend que renderiza meta tags Open Graph
   - Usado para compartilhamento em WhatsApp/Facebook/Twitter
   
2. **Redirecionamento**: `https://h2linker.com/job/{id}`
   - Após meta tags serem lidas, usuário é redirecionado
   - Interface React com detalhes da vaga

3. **Display na UI**: `h2linker.com/jobs/{id}`
   - URL amigável mostrada na interface
   - Sem protocolo (https://) para ficar mais limpo

## Kubernetes Ingress

O ingress atual redireciona:
- `/api/*` → Backend (porta 8001)
- Outras rotas → Frontend (porta 3000)

Esta configuração já está correta e funcionará automaticamente quando o DNS for configurado.

## Variáveis de Ambiente Configuradas

### Backend (.env)
```
APP_URL=https://h2linker.com
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://h2linker.com
VITE_BACKEND_URL=https://h2linker.com
VITE_APP_DOMAIN=h2linker.com
```

## Status Atual

✅ Código atualizado para usar h2linker.com
✅ Open Graph tags usando h2linker.com
✅ Links de compartilhamento usando h2linker.com
⏳ Aguardando configuração DNS para ativar completamente

## Testando Localmente (Desenvolvimento)

Se quiser testar antes de configurar DNS, adicione ao `/etc/hosts`:
```
[IP_DO_SERVIDOR] h2linker.com
```

Porém, o compartilhamento em redes sociais só funcionará após DNS estar configurado.
