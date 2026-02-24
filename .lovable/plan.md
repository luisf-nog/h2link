

# Travas de Seguranca Anti-Desperdicio de IA

## Visao Geral

Implementar duas travas de seguranca que impedem chamadas de IA quando o SMTP nao esta funcional, eliminando custos desnecessarios. O usuario sera informado de forma clara sobre o motivo do bloqueio e como resolver.

## Trava 1: Verificacao Obrigatoria de SMTP (Pre-Flight Check)

### Como funciona

O usuario so consegue enviar emails ou acionar a IA apos validar seu SMTP com sucesso (enviando um email de teste real). Enquanto nao validar, os botoes de envio ficam desabilitados com mensagem explicativa.

### Fluxo do usuario

```text
1. Usuario configura SMTP (email + senha de app)
2. Clica em "Testar e Ativar" (substitui o botao "Salvar" atual)
3. Sistema envia email de teste real para o proprio usuario
4. Se sucesso: smtp_verified = true, botoes de envio liberados
5. Se falha: mensagem de erro explicativa, botoes permanecem bloqueados
```

### Alteracoes

**Banco de dados (migracao SQL):**
- Adicionar `smtp_verified boolean DEFAULT false` na tabela `profiles`
- Adicionar `last_smtp_check timestamptz` na tabela `profiles`

**Frontend - EmailSettingsPanel.tsx:**
- Substituir botao "Salvar" + "Testar Conexao" por um unico botao "Testar e Ativar"
- Ao clicar: salvar credenciais, enviar email de teste, e se sucesso, setar `smtp_verified = true` no perfil
- Mostrar badge verde "SMTP Verificado" quando ativo

**Frontend - Queue.tsx:**
- No `ensureCanSend()`, verificar `profile.smtp_verified === true`
- Se falso, exibir alerta explicativo com botao que leva para `/settings/email`:
  - Titulo: "SMTP nao verificado"
  - Mensagem: "Voce precisa testar e ativar sua conexao de email antes de enviar. Va em Configuracoes > Email e clique em 'Testar e Ativar'."

**Backend - generate-job-email/index.ts:**
- Adicionar verificacao: se `smtp_verified !== true`, retornar erro 403 com mensagem `smtp_not_verified`
- Isso impede que a IA seja chamada mesmo via manipulacao direta

**Frontend - AuthContext.tsx:**
- Adicionar `smtp_verified` na interface `Profile`
- Incluir campo na query de `fetchProfile`

**Frontend - SetupChecklist (useSetupChecklist.ts):**
- Adicionar step "smtp_verified" que verifica `profile.smtp_verified`
- Diferente do step "smtp" existente (que so verifica se tem senha salva)

## Trava 2: Disjuntor Automatico (Circuit Breaker)

### Como funciona

Durante o envio em massa, se 5 falhas SMTP consecutivas ocorrerem, o sistema para imediatamente, reseta `smtp_verified = false`, e exibe alerta critico.

### Fluxo

```text
1. Usuario inicia envio em massa
2. Contador de falhas consecutivas: 0
3. Email enviado com sucesso -> contador reseta para 0
4. Email falha -> contador += 1
5. Se contador >= 5:
   a. Para o loop imediatamente
   b. Atualiza profiles.smtp_verified = false
   c. Exibe alerta: "Envio pausado: detectamos 5 falhas consecutivas.
      Seu SMTP pode estar bloqueado ou suas credenciais expiraram.
      Va em Configuracoes > Email e revalide sua conexao."
   d. Usuario precisa re-testar SMTP para desbloquear
```

### Alteracoes

**Frontend - Queue.tsx (funcao sendQueueItems):**
- Adicionar variavel `consecutiveSmtpFailures = 0`
- No bloco catch: incrementar contador. No bloco de sucesso: resetar para 0
- Se `consecutiveSmtpFailures >= 5`:
  - Chamar `supabase.from("profiles").update({ smtp_verified: false }).eq("id", profile.id)`
  - Exibir toast destrutivo com mensagem explicativa e botao para configuracoes
  - Fazer `break` no loop

## Mensagens ao Usuario (i18n)

Novas chaves de traducao nos 3 idiomas (en, pt, es):

| Chave | PT | EN | ES |
|-------|----|----|-----|
| `smtp.not_verified_title` | SMTP nao verificado | SMTP not verified | SMTP no verificado |
| `smtp.not_verified_desc` | Teste e ative sua conexao de email em Configuracoes antes de enviar. | Test and activate your email connection in Settings before sending. | Pruebe y active su conexion de email en Configuracion antes de enviar. |
| `smtp.circuit_breaker_title` | Envio pausado automaticamente | Sending paused automatically | Envio pausado automaticamente |
| `smtp.circuit_breaker_desc` | Detectamos 5 falhas consecutivas. Revalide seu SMTP em Configuracoes > Email. | We detected 5 consecutive failures. Re-validate your SMTP in Settings > Email. | Detectamos 5 fallos consecutivos. Revalide su SMTP en Configuracion > Email. |
| `smtp.verify_and_activate` | Testar e Ativar | Test and Activate | Probar y Activar |
| `smtp.verified_badge` | SMTP Verificado | SMTP Verified | SMTP Verificado |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| Nova migracao SQL | `smtp_verified` e `last_smtp_check` em `profiles` |
| `frontend/src/contexts/AuthContext.tsx` | Adicionar `smtp_verified` na interface Profile |
| `frontend/src/components/settings/EmailSettingsPanel.tsx` | Botao "Testar e Ativar", badge de verificado |
| `frontend/src/pages/Queue.tsx` | Verificacao em `ensureCanSend()` + circuit breaker no loop |
| `frontend/supabase/functions/generate-job-email/index.ts` | Bloquear chamadas se `smtp_verified = false` |
| `frontend/src/hooks/useSetupChecklist.ts` | Novo step de verificacao SMTP |
| `frontend/src/locales/en.json` | Novas chaves i18n |
| `frontend/src/locales/pt.json` | Novas chaves i18n |
| `frontend/src/locales/es.json` | Novas chaves i18n |

## Impacto Esperado

- **Custo zero em erros**: IA nunca sera chamada se SMTP estiver offline
- **Protecao em tempo real**: circuit breaker para o envio antes de acumular centenas de falhas
- **Clareza para o usuario**: mensagens explicitas sobre o que fazer para resolver
- **Seguranca no backend**: edge function rejeita chamadas mesmo se o frontend for burlado

