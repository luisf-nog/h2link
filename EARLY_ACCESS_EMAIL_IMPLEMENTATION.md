# Instruções para Implementação: Early Access Email Generation

## 📋 Objetivo
Modificar a Edge Function `generate-job-email` para gerar e-mails personalizados para vagas **H-2A (Early Access)** com abordagem proativa.

## 🎯 Regras de Negócio

### 1. Detecção de Early Access
```typescript
const isEarlyAccess = job.visa_type?.trim() === 'H-2A (Early Access)';
```

### 2. Comportamento da IA

#### Para Vagas **Early Access**:
- ✅ Tom proativo e estratégico
- ✅ Mencionar que o candidato está ciente do registro recente no DOL
- ✅ Expressar interesse **antes** da certificação final
- ✅ **OBRIGATÓRIO**: Texto puro (sem Markdown, sem asteriscos, sem negritos)
- ✅ Usar competências reais do currículo (`resume_data`)

#### Para Vagas **Normais** (H-2A/H-2B):
- ✅ Tom padrão de candidatura
- ✅ Texto puro (sem Markdown)
- ✅ Usar competências reais do currículo

## 📝 Estrutura do E-mail Early Access

### Subject Line (Exemplos):
```
Proactive Interest: Job Order recently filed for [Job Title] - [Company Name]
```

```
Early Application: [Job Title] position - [Company Name] (Recently filed with DOL)
```

### Body Template (Português):
```
Prezado(a) time de recrutamento da [Company Name],

Escrevo para expressar meu forte interesse na posição de [Job Title] em [City], [State]. Tenho conhecimento de que seu Job Order foi registrado recentemente e está atualmente em estágio inicial de processamento junto ao Departamento de Trabalho (DOL), e gostaria de demonstrar meu interesse de forma proativa antes que a certificação oficial seja finalizada.

[Parágrafo personalizado com experiência relevante do currículo]

Estou altamente motivado(a) para integrar sua equipe e contribuir para o sucesso desta temporada. Agradeço seu tempo e consideração à minha candidatura proativa.

Atenciosamente,

[Nome Completo]
[Telefone]
```

### Body Template (Inglês):
```
Dear [Company Name] Recruiting Team,

I am writing to express my strong interest in the [Job Title] position in [City], [State]. I am aware that your Job Order was recently filed and is currently in the initial processing stage with the Department of Labor (DOL), and I wanted to reach out proactively to express my interest before the official certification is finalized.

[Personalized paragraph with relevant experience from resume]

I am highly motivated to join your team and contribute to the success of this upcoming season. Thank you for your time and for considering my proactive application.

Best regards,

[Full Name]
[Phone Number]
```

### Body Template (Espanhol):
```
Estimado equipo de reclutamiento de [Company Name],

Le escribo para expresar mi fuerte interés en el puesto de [Job Title] en [City], [State]. Tengo conocimiento de que su Job Order fue registrado recientemente y se encuentra actualmente en etapa inicial de procesamiento con el Departamento de Trabajo (DOL), y quería contactarlos proactivamente para expresar mi interés antes de que se finalice la certificación oficial.

[Párrafo personalizado con experiencia relevante del currículum]

Estoy altamente motivado(a) para unirme a su equipo y contribuir al éxito de esta próxima temporada. Gracias por su tiempo y por considerar mi aplicación proactiva.

Atentamente,

[Nombre Completo]
[Teléfono]
```

## 🔧 Implementação Técnica (Supabase Edge Function)

### Localização
```
/supabase/functions/generate-job-email/index.ts
```

### Pseudo-código
```typescript
// 1. Buscar dados do job e do usuário
const job = await getJobData(queueId);
const user = await getUserData(userId);
const resumeData = user.resume_data;

// 2. Detectar Early Access
const isEarlyAccess = job.visa_type?.trim() === 'H-2A (Early Access)';

// 3. Construir prompt para IA
let systemPrompt = "";
let userPrompt = "";

if (isEarlyAccess) {
  systemPrompt = `You are an expert job application writer. Generate a PROACTIVE job application email for an H-2A Early Access position. 
  
  CRITICAL RULES:
  - The candidate KNOWS the Job Order was recently filed with DOL
  - Express interest BEFORE official certification
  - Use PLAIN TEXT only (NO Markdown, NO asterisks, NO bold)
  - Use the candidate's real skills from their resume
  - Be strategic and professional
  - Show market awareness
  
  Language: ${user.language || 'en'}`;
  
  userPrompt = `Generate a proactive application email for:
  
  Job: ${job.job_title} at ${job.company}
  Location: ${job.city}, ${job.state}
  Visa: H-2A (Early Access - recently filed)
  
  Candidate resume data:
  ${JSON.stringify(resumeData, null, 2)}
  
  Generate:
  1. Subject line (proactive, mentions recent filing)
  2. Email body (plain text, proactive tone, mentions DOL filing)`;
  
} else {
  // Prompt normal para vagas regulares
  systemPrompt = `You are an expert job application writer. Generate a professional job application email.
  
  CRITICAL RULES:
  - Use PLAIN TEXT only (NO Markdown, NO asterisks, NO bold)
  - Use the candidate's real skills from their resume
  - Be professional and direct
  
  Language: ${user.language || 'en'}`;
  
  userPrompt = `Generate an application email for:
  
  Job: ${job.job_title} at ${job.company}
  Location: ${job.city}, ${job.state}
  
  Candidate resume data:
  ${JSON.stringify(resumeData, null, 2)}
  
  Generate:
  1. Subject line
  2. Email body (plain text)`;
}

// 4. Chamar IA (OpenAI/Claude/etc)
const aiResponse = await callAI({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.7
});

// 5. Parsear resposta
const { subject, body } = parseAIResponse(aiResponse);

// 6. Validar: garantir que não tem Markdown
const cleanBody = removeMarkdownFormatting(body);

// 7. Retornar
return {
  success: true,
  subject: subject,
  body: cleanBody
};
```

## ✅ Checklist de Validação

- [ ] E-mail detecta Early Access corretamente
- [ ] Subject line menciona "recently filed" ou "proactive"
- [ ] Body menciona conhecimento do registro recente no DOL
- [ ] Tom é proativo, não passivo
- [ ] **Nenhum Markdown** no texto final (sem **, sem *, sem #)
- [ ] Usa dados reais do `resume_data`
- [ ] Funciona nos 3 idiomas (pt, en, es)
- [ ] Fallback para template funciona se IA falhar

## 🧪 Casos de Teste

### Teste 1: Early Access com Resume
```json
{
  "job": {
    "visa_type": "H-2A (Early Access)",
    "job_title": "General Farm Laborer",
    "company": "Iowa Select Farms, LLLP",
    "city": "Riceville",
    "state": "IA"
  },
  "user": {
    "language": "en",
    "resume_data": {
      "experience": "Agricultural operations, manual labor, 5 years"
    }
  }
}
```

**Esperado**: E-mail proativo mencionando DOL filing

### Teste 2: Vaga Normal
```json
{
  "job": {
    "visa_type": "H-2B",
    "job_title": "Landscaper",
    "company": "Green Spaces Inc",
    "city": "Miami",
    "state": "FL"
  }
}
```

**Esperado**: E-mail padrão sem menção a DOL

## 📚 Referências

- Documento original: [User Request sobre Early Access]
- Frontend já implementado: disclaimer visual + helper functions
- `isEarlyAccess()` e `getEarlyAccessDisclaimer()` em `/src/lib/visaTypes.ts`

---

**Prioridade**: Alta  
**Impacto**: Diferenciação competitiva para usuários H2 Linker  
**Dependências**: Edge Function `generate-job-email` precisa ser atualizada
