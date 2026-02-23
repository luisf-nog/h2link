
# Plano: Arquitetura "Lean Edge + Heavy SQL"

## Problema
A Edge Function `auto-import-jobs` continua estourando o limite de CPU (WORKER_LIMIT) porque faz processamento pesado de dados em TypeScript: flatten de objetos, mapeamento de aliases, calculo de salarios, formatacao de datas, deduplicacao por fingerprint. Tudo isso consome muita RAM e CPU do Deno.

## Solucao
Mover toda a logica de transformacao para uma funcao PostgreSQL. A Edge Function vira um simples "motoboy" que:
1. Baixa o ZIP
2. Descompacta os JSONs
3. Envia o JSON bruto para o banco via RPC em batches

## Etapas

### 1. Criar funcao SQL `process_dol_raw_batch`

Uma funcao `plpgsql` que recebe:
- `p_raw_items jsonb` - array de objetos JSON brutos do DOL  
- `p_visa_type text` - tipo de visto (H-2A, H-2B, H-2A (Early Access))

A funcao fara internamente:

- **getVal** (fallback de campos): usando `COALESCE` com os mesmos aliases
- **getCaseBody** (fingerprint): usando `SPLIT_PART`, `TRIM`, `REPLACE`
- **calculateFinalWage**: usando `CASE WHEN` com logica numerica
- **formatToStaticDate**: usando cast `::date` nativo do Postgres
- **Flatten**: usando `||` para merge de objetos JSONB (`item || item->'clearanceOrder' || ...`)
- **Filtro de email valido**: `WHERE email IS NOT NULL AND email != 'N/A'`
- **INSERT ... ON CONFLICT (fingerprint) DO UPDATE**: upsert direto

Campos mapeados (todos os 20+ campos que o TypeScript faz hoje):

```text
job_id, fingerprint, visa_type, job_title, company, email, phone,
city, state, zip_code, salary, start_date, posted_date, end_date,
job_duties, job_min_special_req, wage_additional, rec_pay_deductions,
weekly_hours, category, openings, experience_months, education_required,
transport_provided, source_url, housing_info, was_early_access, is_active
```

### 2. Simplificar a Edge Function

O novo `auto-import-jobs/index.ts` fica drasticamente menor:

```text
1. Baixa o ZIP via fetch
2. Descompacta com JSZip
3. Para cada JSON no ZIP:
   - Parse do JSON
   - Envia em batches de 500 itens via supabase.rpc('process_dol_raw_batch', { p_raw_items, p_visa_type })
4. Atualiza import_jobs com progresso
5. Chama deactivate_expired_jobs
6. Se nao for skip_radar, dispara radar (mesma logica atual)
```

Beneficios chave:
- O Edge nao cria Map, nao faz loop de transformacao, nao calcula salarios
- Batch de 500 (em vez de 50) porque o SQL processa em massa
- Menos chamadas RPC = menos I/O overhead

### 3. Manter a UI de polling inalterada

A pagina AdminImport.tsx continua igual, fazendo polling na tabela `import_jobs`.

---

## Detalhes Tecnicos

### Funcao SQL completa (campos e aliases)

A funcao ira usar CTEs para:
1. Flatten dos objetos (merge de sub-objetos como `clearanceOrder`, `employer`, `jobRequirements.qualification`)
2. Extrair valores com COALESCE nos mesmos aliases usados hoje
3. Calcular fingerprint com a mesma logica de `getCaseBody`
4. Calcular salario com a mesma logica de `calculateFinalWage`
5. Filtrar registros sem email
6. Upsert com ON CONFLICT (fingerprint)

### Edge Function simplificada

- Remove: `processJobList`, `calculateFinalWage`, `formatToStaticDate`, `getCaseBody`, `getVal`
- Mantem: download ZIP, JSZip, `EdgeRuntime.waitUntil`, tracking via `import_jobs`, logica de radar
- Batch size sobe de 50 para 500 (o SQL faz o trabalho pesado)

### Migracao SQL

Uma unica migracao que:
1. Cria a funcao `process_dol_raw_batch(p_raw_items jsonb, p_visa_type text)`
2. Retorna `integer` (numero de registros processados)
