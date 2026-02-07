#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  1. No banco de dados foi incluído um novo tipo de visa_type (Early Access) porém na tabela de vagas não aparece esse novo badge. 
     Aparentemente duplicou a mesma vaga em dois tipos diferentes (H2A e H2B). Verificar e ajustar.
  2. Melhorar visualização do link de compartilhamento de vagas e mascarar URL para formato h2linker.com/jobs/id
  3. Melhorar mensagens de erro de envio de email SMTP para diagnóstico sem acesso a logs do Supabase

backend:
  - task: "Support for Early Access visa type"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Backend já tinha suporte via migration SQL, não necessita mudanças"

frontend:
  - task: "SMTP Error Parser utility"
    implemented: true
    working: true
    file: "frontend/src/lib/smtpErrorParser.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Criado parser que classifica erros SMTP em categorias user-friendly (auth_failed, connection_timeout, recipient_rejected, etc.)"

  - task: "Improved error display in Queue page"
    implemented: true
    working: true
    file: "frontend/src/pages/Queue.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Adicionado last_error na interface e query. Badge de Failed agora mostra tooltip com erro classificado. Toasts mostram mensagem específica ao invés de genérica."

  - task: "Improved error display in Mobile Queue Card"
    implemented: true
    working: true
    file: "frontend/src/components/queue/MobileQueueCard.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Mobile cards também mostram tooltip com erro classificado no badge Failed."

  - task: "Improved error display in Email Settings test"
    implemented: true
    working: true
    file: "frontend/src/components/settings/EmailSettingsPanel.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Toast de erro no email de teste agora usa parseSmtpError para exibir mensagem classificada."

  - task: "SMTP error translations (pt/en/es)"
    implemented: true
    working: true
    file: "frontend/src/locales/pt.json, en.json, es.json"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Adicionadas traduções para 15+ categorias de erros SMTP em 3 idiomas."

  - task: "Edge Function send-email-custom error classifier"
    implemented: true
    working: "NA"
    file: "frontend/supabase/functions/send-email-custom/index.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Adicionado classifySmtpError() na edge function. Retorna userMessage, category e rawError. NECESSITA DEPLOY NO SUPABASE."

  - task: "Edge Function process-queue error classifier"
    implemented: true
    working: "NA"
    file: "frontend/supabase/functions/process-queue/index.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Adicionado classifySmtpError() para background processing. Erros salvos em last_error agora são mensagens user-friendly. NECESSITA DEPLOY NO SUPABASE."

  - task: "Add visa type utility helper"
    implemented: true
    working: true
    file: "frontend/src/lib/visaTypes.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Criado helper getVisaBadgeConfig para mapear visa_types para badges consistentemente - TESTADO E FUNCIONANDO"
  
  - task: "Update Jobs.tsx to support Early Access badge"
    implemented: true
    working: true
    file: "frontend/src/pages/Jobs.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Atualizado para usar helper, adicionado filtro para Early Access - TESTADO E FUNCIONANDO"
  
  - task: "Create share utils for friendly URLs"
    implemented: true
    working: true
    file: "frontend/src/lib/shareUtils.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Criadas funções getJobShareUrl e getShortShareUrl para URLs mascaradas com h2linker.com"
  
  - task: "Improve SharedJobView visual design"
    implemented: true
    working: true
    file: "frontend/src/pages/SharedJobView.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: "Redesenhado com gradientes, badges corretos, display de URL amigável visível na página"
  
  - task: "Add VITE_APP_DOMAIN env variable"
    implemented: true
    working: true
    file: "frontend/.env"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Adicionado VITE_APP_DOMAIN=h2linker.com para mascaramento de URLs"

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Testar visualização melhorada de SharedJobView"
    - "Verificar URL mascarada exibida corretamente"
    - "Confirmar badges Early Access em página compartilhada"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      TAREFA 2 IMPLEMENTADA - COMPARTILHAMENTO MELHORADO:
      
      ✅ Criado sistema de mascaramento de URL:
      - Novo arquivo: /app/frontend/src/lib/shareUtils.ts
      - Funções: getJobShareUrl() e getShortShareUrl()
      - URLs agora aparecem como: h2linker.com/jobs/{jobId}
      
      ✅ SharedJobView completamente redesenhado:
      - Design moderno com gradientes (azul/roxo)
      - Header melhorado com logo e tagline
      - Card hero com badges corretos (usando getVisaBadgeConfig)
      - Display proeminente do link de compartilhamento mascarado
      - Background com efeitos blur decorativos
      - Layout mais limpo e profissional
      
      ✅ Jobs.tsx e SharedJobView.tsx atualizados:
      - Importam e usam funções de shareUtils
      - URLs mascaradas em todo compartilhamento
      
      ✅ Variável de ambiente adicionada:
      - VITE_APP_DOMAIN=h2linker.com em frontend/.env
      
      MUDANÇAS VISUAIS:
      - Badge "Early Access" roxo agora aparece corretamente
      - Link de compartilhamento exibido como: h2linker.com/jobs/[id]
      - Design muito mais profissional e atraente
      - Gradiente azul-roxo no fundo
      - Cards com sombras e efeitos modernos
      
      PRÓXIMOS PASSOS:
      - Testar página compartilhada com vaga real
      - Verificar visual em mobile