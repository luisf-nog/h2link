
# Checklist de Go-Live - H2 Linker

Este checklist cobre todas as funcionalidades principais do sistema para garantir que está 100% funcional no lançamento.

---

## 1. Autenticacao e Onboarding

### 1.1 Cadastro de Usuario
- [ ] Cadastro com email, nome completo, idade, telefone e email de contato funciona
- [ ] Validacao de telefone internacional (E.164) funciona corretamente
- [ ] Confirmacao de email chega na caixa de entrada (verificar SPAM tambem)
- [ ] Codigo de indicacao (referral) e aplicado corretamente ao cadastrar
- [ ] Usuario e redirecionado para Onboarding apos confirmar email

### 1.2 Login
- [ ] Login com email/senha funciona
- [ ] Mensagem de erro clara para credenciais invalidas
- [ ] Sessao persiste apos refresh da pagina

### 1.3 Recuperacao de Senha
- [ ] Fluxo "Esqueci minha senha" envia email corretamente
- [ ] Link de redirecionamento `/reset-password` funciona
- [ ] Nova senha pode ser definida com sucesso
- [ ] Usuario consegue fazer login apos redefinir senha

### 1.4 Onboarding (SMTP + Warmup)
- [ ] Guia de criacao de senha de app (Gmail/Outlook) esta claro
- [ ] Credenciais SMTP sao salvas corretamente
- [ ] Selecao de perfil de risco (Conservative/Standard/Aggressive) funciona
- [ ] Usuario e redirecionado ao Dashboard apos completar onboarding

---

## 2. Dashboard

- [ ] Saudacao personalizada com nome do usuario
- [ ] Card de creditos exibe limite diario correto por plano
- [ ] Barra de progresso de uso diario atualiza apos envios
- [ ] Estatisticas (Enviados Hoje, Na Fila, Taxa de Sucesso, Este Mes)
- [ ] Widget de Email Warmup exibe status para planos pagos
- [ ] Promo Banner aparece apenas para usuarios Free (BRL)
- [ ] Metricas do mercado (H-2A/H-2B, vagas quentes, top categorias/estados) carregam

---

## 3. Hub de Vagas (Jobs)

### 3.1 Listagem e Filtros
- [ ] Vagas carregam corretamente da tabela `public_jobs`
- [ ] Filtro por tipo de visto (H-2A/H-2B) funciona
- [ ] Busca por texto (cargo, empresa, cidade, estado) funciona
- [ ] Filtro por estado funciona
- [ ] Filtro por cidade funciona
- [ ] Filtro por categoria funciona
- [ ] Filtro por faixa salarial funciona
- [ ] Ordenacao por colunas funciona
- [ ] Paginacao funciona corretamente

### 3.2 Adicionar a Fila
- [ ] Botao "+" adiciona vaga a fila com feedback visual
- [ ] Check de DNS/MX valida email antes de adicionar (planos pagos)
- [ ] Vagas ja adicionadas mostram icone de check
- [ ] Dialogo de detalhes da vaga exibe todas informacoes
- [ ] Botoes de SMS/Ligar funcionam no dialogo de detalhes
- [ ] WhatsApp so aparece para paises com alta adocao (BR, MX, etc.)

### 3.3 Importacao de Vagas (Admin)
- [ ] Dialogo de importacao via arquivo Excel funciona
- [ ] Mapeamento de colunas funciona corretamente

---

## 4. Fila de Envios (Queue)

### 4.1 Listagem
- [ ] Itens da fila carregam corretamente
- [ ] Status exibido corretamente (Pendente, Enviado, Falhou)
- [ ] Data/hora de envio exibida corretamente
- [ ] Coluna "CV" mostra quando recrutador visualizou resume (Diamond/Black)
- [ ] Historico de envios acessivel via botao

### 4.2 Gerenciamento
- [ ] Adicionar vaga manual funciona (dialogo com campos)
- [ ] Remover item da fila funciona
- [ ] Selecao multipla funciona
- [ ] Envio em lote respeita limite diario

### 4.3 Envio de Emails
- [ ] Envio individual funciona
- [ ] Envio em lote funciona
- [ ] Template e aplicado corretamente (Free/Gold/Diamond)
- [ ] IA gera email dinamico por vaga (Black)
- [ ] Resume e anexado automaticamente
- [ ] Link do Smart Profile e incluido no email
- [ ] Delay entre envios respeita configuracao do plano:
  - Gold: 15s fixo
  - Diamond: 15-45s aleatorio
  - Black: 1-5 minutos (humano)
- [ ] Creditos sao decrementados apos envio
- [ ] Status atualiza para "Enviado" ou "Falhou"

---

## 5. Configuracoes (Settings)

### 5.1 Perfil
- [ ] Edicao de nome, idade, telefone, email de contato funciona
- [ ] Validacao de campos funciona
- [ ] Upload de resume (PDF) funciona
- [ ] Preview do resume carrega corretamente
- [ ] Parser de resume extrai dados (planos pagos)

### 5.2 Conta
- [ ] Plano atual exibido corretamente
- [ ] Creditos usados hoje exibido
- [ ] Data de cadastro exibida
- [ ] Botao "Gerenciar Plano" redireciona para pagina de planos

### 5.3 Email (SMTP)
- [ ] Credenciais SMTP podem ser atualizadas
- [ ] Troca de provedor (Gmail/Outlook) funciona
- [ ] Perfil de risco (warmup) pode ser alterado

### 5.4 Templates
- [ ] Listagem de templates funciona
- [ ] Criar novo template funciona
- [ ] Editar template existente funciona
- [ ] Deletar template funciona
- [ ] Geracao de template via IA funciona
- [ ] Limite de templates por plano e respeitado
- [ ] Alerta de termos de spam funciona

### 5.5 Preferencias de IA (Black)
- [ ] Configuracoes de tom, tamanho e estilo salvas corretamente

---

## 6. Planos e Pagamentos

### 6.1 Pagina de Planos
- [ ] Todos os 4 planos exibidos (Free, Gold, Diamond, Black)
- [ ] Precos corretos em BRL e USD
- [ ] Preco promocional exibido com risco (quando aplicavel)
- [ ] Countdown de promocao funciona (apenas BRL)
- [ ] Features de cada plano listadas corretamente
- [ ] Tooltips de delay por plano funcionam
- [ ] Botao "Assinar" abre checkout Stripe

### 6.2 Checkout Stripe
- [ ] Redirect para Stripe funciona
- [ ] Pagamento com cartao de credito funciona
- [ ] Webhook processa pagamento e atualiza plano
- [ ] Usuario retorna com plano atualizado
- [ ] Toast de sucesso exibido

### 6.3 Fallback de Pagamento (Admin)
- [ ] Ferramenta de reprocessamento de upgrade funciona

---

## 7. Indicacoes (Referrals) - Apenas Free

### 7.1 Pagina de Indicacoes
- [ ] Codigo de indicacao exibido
- [ ] Link de indicacao gerado corretamente
- [ ] Botao de copiar funciona
- [ ] Contador de indicacoes ativas (0-10)
- [ ] Bonus atual exibido (+5 creditos por indicacao)
- [ ] Lista de indicados exibida com status

### 7.2 Aplicacao de Codigo
- [ ] Codigo e aplicado ao cadastrar novo usuario
- [ ] Bonus incrementa para o indicador apos ativacao

---

## 8. Smart Profile (Pagina Publica)

- [ ] Rota `/v/:token` carrega corretamente
- [ ] Nome do candidato exibido
- [ ] Resume exibido em iframe (PDF)
- [ ] Botao WhatsApp funciona
- [ ] Botao SMS funciona
- [ ] Botao Ligar funciona
- [ ] Botao Download PDF funciona
- [ ] View tracking registra visualizacao
- [ ] Token invalido redireciona para 404

---

## 9. Internacionalizacao (i18n)

- [ ] Portugues (pt) - todas as strings traduzidas
- [ ] Ingles (en) - todas as strings traduzidas
- [ ] Espanhol (es) - todas as strings traduzidas
- [ ] Seletor de idioma funciona
- [ ] Idioma persiste apos refresh

---

## 10. Email Warmup System

- [ ] Limite diario calculado com base no perfil de risco
- [ ] Regra de 80% (aumento apenas se usou 80%+ do limite anterior)
- [ ] Circuit Breaker ativado em erros SMTP criticos (550, 421)
- [ ] Downgrade automatico do perfil de risco quando necessario
- [ ] Reset diario de creditos funciona (cron midnight UTC)

---

## 11. Edge Functions Criticas

| Funcao | Status |
|--------|--------|
| `process-queue` | [ ] Testado - processa fila em background |
| `send-email-custom` | [ ] Testado - envia emails via SMTP |
| `generate-job-email` | [ ] Testado - gera email por IA (Black) |
| `generate-template` | [ ] Testado - gera template por IA |
| `parse-resume` | [ ] Testado - extrai dados do resume |
| `check-dns-mx` | [ ] Testado - valida dominio de email |
| `create-payment` | [ ] Testado - cria checkout Stripe |
| `stripe-webhook` | [ ] Testado - processa pagamentos |
| `apply-referral-code` | [ ] Testado - aplica codigo de indicacao |
| `save-smtp-credentials` | [ ] Testado - salva credenciais SMTP |
| `track-email-open` | [ ] Testado - tracking de abertura |
| `reset-daily-credits` | [ ] Testado - reset diario de creditos |
| `import-jobs` | [ ] Testado - importa vagas em lote |
| `reprocess-upgrade` | [ ] Testado - reprocessa upgrade manual |

---

## 12. Responsividade

- [ ] Dashboard responsivo (mobile/tablet/desktop)
- [ ] Jobs responsivo (cards mobile, tabela desktop)
- [ ] Queue responsivo (cards mobile, tabela desktop)
- [ ] Settings responsivo
- [ ] Plans responsivo
- [ ] Sidebar colapsavel no desktop, sheet no mobile

---

## 13. Seguranca

### ✅ Verificacao Executada em 28/01/2026

**RLS (Row Level Security):**
- [x] RLS ativo em TODAS as 12 tabelas (verificado via Supabase Linter)
- [x] Nenhum problema critico de RLS detectado
- [x] `smtp_credentials_secrets` - nega SELECT (senhas nunca vazam)
- [x] `app_settings` - nega TODAS operacoes (cron_token protegido)
- [x] `user_roles` - nega INSERT/UPDATE/DELETE (previne escalacao de privilegios)

**Edge Functions JWT:**
- [x] `send-email-custom` - valida JWT via getClaims()
- [x] `create-payment` - valida JWT via getUser()
- [x] `apply-referral-code` - valida JWT via getClaims()
- [x] `save-smtp-credentials` - valida JWT via getClaims()
- [x] `generate-job-email` - valida JWT via getClaims()
- [x] `generate-template` - valida JWT via getClaims()
- [x] `parse-resume` - valida JWT via getClaims()

**Edge Functions Publicas (sem JWT):**
- [x] `stripe-webhook` - valida assinatura Stripe (STRIPE_WEBHOOK_SECRET)
- [x] `process-queue` - valida x-cron-token vs app_settings.cron_token
- [x] `track-email-open` - apenas tracking, sem dados sensiveis
- [x] `check-dns-mx` - apenas validacao DNS, sem dados sensiveis

**Smart Profile (/v/:token) - Design Intencional:**
- [x] Politica RLS permite SELECT publico quando public_token IS NOT NULL
- [x] Aplicacao usa EXCLUSIVAMENTE RPC `track_profile_view` (SECURITY DEFINER)
- [x] RPC retorna APENAS: id, full_name, phone_e164, resume_url, contact_email
- [x] NAO expoe: email, age, stripe_customer_id, referral_code, resume_data

**SMTP Vault:**
- [x] Senhas armazenadas em `smtp_credentials_secrets` (tabela separada)
- [x] SELECT negado via RLS - usuarios nao conseguem ler senhas
- [x] Apenas edge functions com SERVICE_ROLE_KEY acessam senhas

---

## 14. Performance

- [ ] Tempo de carregamento inicial aceitavel (<3s)
- [ ] Paginacao evita carregar dados em excesso
- [ ] Queries otimizadas (indices em colunas filtradas)

---

## 15. Testes Finais de Usuario

### Fluxo Completo Usuario Free
1. [ ] Cadastrar nova conta
2. [ ] Confirmar email
3. [ ] Completar onboarding SMTP
4. [ ] Fazer upload de resume
5. [ ] Navegar no Hub de Vagas
6. [ ] Adicionar 3 vagas a fila
7. [ ] Enviar 1 email
8. [ ] Verificar email recebido pelo destinatario

### Fluxo Completo Usuario Pago
1. [ ] Fazer upgrade para Gold/Diamond/Black
2. [ ] Verificar limites atualizados
3. [ ] Enviar emails em lote
4. [ ] Verificar delay entre envios
5. [ ] (Black) Verificar geracao de email por IA
6. [ ] Verificar resume anexado
7. [ ] Verificar link do Smart Profile no email

---

## Notas Adicionais

**URLs do Projeto:**
- Preview: https://id-preview--0b51cbd2-552c-421d-9f76-6db0bd641565.lovable.app
- Producao: https://h2link.lovable.app

**Stripe:**
- Testar com cartao de teste: `4242 4242 4242 4242`
- Data: qualquer data futura
- CVC: qualquer 3 digitos

**Cron Jobs:**
- `reset-daily-credits`: Deve rodar diariamente a meia-noite UTC
