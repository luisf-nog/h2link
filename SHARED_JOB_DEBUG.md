# 🔍 Debug: Tela Branca no SharedJobView

## Correções Aplicadas

### 1. Logs de Debug Adicionados
Adicionei console.logs detalhados no useEffect do SharedJobView para diagnosticar:
- Se o jobId está sendo recebido
- Resposta do Supabase
- Erros específicos

### 2. Como Verificar no Console

Abra o DevTools (F12) e procure por:
```
Fetching job with ID: [uuid]
Supabase response: {...}
Job loaded successfully: {...}
```

Se aparecer erro, verá:
```
Supabase error: {...}
Error fetching job: {...}
```

## Possíveis Causas da Tela Branca

### Causa 1: JobId Inválido
- URL: `https://h2linker.com/job/INVALID-ID`
- Solução: Verificar se o UUID está correto

### Causa 2: Tabela `public_jobs` Vazia
- Problema: Nenhuma vaga foi importada ainda
- Solução: Importar vagas via Admin → Import

### Causa 3: Permissões RLS (Row Level Security)
- Problema: Tabela pode não ter acesso público
- SQL para verificar:
```sql
-- Verificar RLS policies
SELECT * FROM pg_policies WHERE tablename = 'public_jobs';

-- Deve ter policy de SELECT público:
CREATE POLICY "Public jobs are viewable by anyone"
ON public_jobs FOR SELECT
USING (true);
```

### Causa 4: JavaScript Error
- Verificar console para erros de:
  - Import faltando
  - Componente quebrado
  - undefined/null reference

## Teste Manual no Supabase

```sql
-- 1. Verificar se tabela existe
SELECT COUNT(*) FROM public_jobs;

-- 2. Pegar um ID válido
SELECT id, job_title FROM public_jobs LIMIT 1;

-- 3. Testar acesso público
SELECT * FROM public_jobs WHERE id = '[uuid-aqui]';
```

## Solução Rápida

### Se a tabela estiver vazia:
1. Ir para Admin → Import
2. Importar arquivo JSON/ZIP de vagas
3. Aguardar processamento
4. Testar novamente o link

### Se houver erro de permissão:
```sql
-- No Supabase SQL Editor
ALTER TABLE public_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
ON public_jobs FOR SELECT
USING (true);
```

## Como Testar Localmente

```bash
# 1. Abrir preview local
cd /app
yarn dev

# 2. Acessar URL de teste
http://localhost:8080/job/[uuid-valido]

# 3. Verificar console
```

## Próximos Passos

1. ✅ Logs de debug adicionados
2. ⏳ Verificar console do browser
3. ⏳ Confirmar se tabela tem dados
4. ⏳ Verificar RLS policies
5. ⏳ Testar com UUID válido

---

**Importante**: Por favor, abra o DevTools (F12) → Console e compartilhe os logs que aparecem quando tenta acessar o link.
