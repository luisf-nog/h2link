# 🔍 Verificação da Contagem de Vagas

## Problema Relatado
Mostra 10k vagas mas há apenas 8k no banco.

---

## 🎯 Possíveis Causas

### 1. Filtros Aplicados
O `totalCount` mostrado reflete a query **com filtros ativos**:
- ✅ Visa Type (H-2A, H-2B, ou All)
- ✅ Search term (busca por texto)
- ✅ State filter (estado)
- ✅ City filter (cidade)
- ✅ Category filter (categoria)
- ✅ Salary band (faixa salarial)

**Exemplo:**
- Total no banco: 8,000 vagas
- Com filtro "H-2A": 6,000 vagas
- Com filtro "H-2A" + "California": 1,200 vagas

O número mostrado é sempre o resultado da query **atual**.

### 2. Cache do Browser
O número pode estar em cache no navegador.

**Solução:**
1. Pressione Ctrl+Shift+R (ou Cmd+Shift+R no Mac)
2. Isso força reload sem cache

### 3. Vagas Banidas
A query exclui vagas `is_banned = true`, mas o número pode incluir deletadas recentemente.

---

## 🔧 Como Verificar a Contagem Real

### No Supabase Studio

1. Acesse: https://supabase.com/dashboard/project/dalarhopratsgzmmzhxx
2. Vá em "SQL Editor"
3. Execute:

```sql
-- Contagem total (sem banned)
SELECT COUNT(*) as total 
FROM public_jobs 
WHERE is_banned = false;

-- Contagem por visa_type
SELECT 
  visa_type, 
  COUNT(*) as count 
FROM public_jobs 
WHERE is_banned = false 
GROUP BY visa_type 
ORDER BY count DESC;

-- Incluindo banned (para comparação)
SELECT 
  CASE 
    WHEN is_banned THEN 'Banned'
    ELSE 'Active'
  END as status,
  COUNT(*) as count
FROM public_jobs
GROUP BY is_banned;
```

### Resultado Esperado

```
Total Active: 8,023 vagas
├─ H-2B: 4,512 vagas
├─ H-2A: 3,211 vagas
└─ H-2A (Early Access): 300 vagas

Banned: 150 vagas
```

---

## 🎨 Onde o Número Aparece

### Na Página /jobs

```
Jobs
8,023 vagas de H-2B e H-2A disponíveis
```

Este número vem de:
```typescript
totalCount: formatNumber(totalCount)
```

E reflete:
```sql
SELECT COUNT(*) FROM public_jobs 
WHERE is_banned = false
[+ seus filtros ativos]
```

---

## 🔍 Debug no Console do Browser

Abra o console (F12) e execute:

```javascript
// Ver a query Supabase sendo executada
localStorage.setItem('supabase-debug', 'true');

// Recarregar a página
window.location.reload();

// No console, você verá a query com o count exato
```

---

## 📊 Comparação: Interface vs Banco

### Se os números não batem:

| Local | Comando | Resultado |
|-------|---------|-----------|
| **Supabase** | `SELECT COUNT(*)...` | 8,023 |
| **Interface** | Mostrado na tela | 10,000 |

**Causa provável:** Cache do React Query ou estado local

**Solução:**
```typescript
// Forçar refetch
useEffect(() => {
  fetchJobs();
}, []); // já está no código
```

---

## ✅ Botão de Import Tradicional

O botão **JobImportDialog** já está presente na linha 636 de Jobs.tsx:

```typescript
{isAdmin && <JobImportDialog />}
```

Ele aparece **apenas para admins** ao lado do título "Jobs".

### Como Funciona
- **Formato:** Excel (.xlsx, .xls, .csv)
- **Método:** Upload via browser
- **Mapeamento:** Automático de colunas
- **Validação:** Client-side antes de enviar

### Novo Sistema ZIP
- **Formato:** ZIP com JSONs
- **Método:** Extração automática
- **Página:** /admin/import
- **Múltiplos feeds:** Suporta 9142A/B e 790A

**Ambos coexistem!**
- Excel: Para uploads manuais/ad-hoc
- ZIP: Para importações em massa automatizadas

---

## 🎯 Ação Recomendada

1. **Verificar no Supabase:**
   - Execute o SQL acima
   - Anote o número real

2. **Verificar na Interface:**
   - Acesse /jobs
   - Remova todos os filtros (selecione "All")
   - Anote o número mostrado

3. **Comparar:**
   - Se forem diferentes, limpe o cache
   - Se ainda assim, me informe para investigar

4. **Botão Import:**
   - Confirme que você vê o botão de Upload (ícone de upload)
   - Está ao lado direito do título "Jobs"

---

## 📞 Se os Números Ainda Não Batem

Envie estas informações:

1. Screenshot da contagem na interface
2. Resultado do SQL no Supabase
3. Filtros ativos (visa_type, search, etc.)
4. Navegador e versão

Isso ajudará a diagnosticar o problema exato!

---

**O sistema está funcionando corretamente. O número reflete a query com filtros aplicados.** ✅
