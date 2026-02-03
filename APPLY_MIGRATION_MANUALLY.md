# 🔧 Aplicar Migration Manualmente no Supabase

## ⚠️ A Migration Não Foi Aplicada Automaticamente

O Lovable não aplicou a migration SQL automaticamente. Você precisa aplicar manualmente no Supabase Studio.

---

## 📋 Passo a Passo

### 1. Acesse o Supabase Studio
```
URL: https://supabase.com/dashboard/project/dalarhopratsgzmmzhxx
```

### 2. Vá para SQL Editor
- Na barra lateral esquerda, clique em **"SQL Editor"**
- Ou acesse: https://supabase.com/dashboard/project/dalarhopratsgzmmzhxx/sql

### 3. Cole o SQL Abaixo

Clique em **"New Query"** e cole este SQL:

```sql
-- Add support for H-2A (Early Access) visa type
-- This allows importing jobs from the 790/790A feed with early access designation

CREATE OR REPLACE FUNCTION public.validate_public_jobs_visa_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.visa_type IS NULL THEN
    NEW.visa_type := 'H-2B';
  END IF;

  -- Now accepting: H-2B, H-2A, and H-2A (Early Access)
  IF NEW.visa_type NOT IN ('H-2B', 'H-2A', 'H-2A (Early Access)') THEN
    RAISE EXCEPTION 'Invalid visa_type: %. Allowed: H-2B, H-2A, H-2A (Early Access)', NEW.visa_type;
  END IF;

  RETURN NEW;
END;
$$;

-- Add comment explaining the new type
COMMENT ON FUNCTION public.validate_public_jobs_visa_type() IS 
'Validates visa_type for public_jobs. Accepts: H-2B, H-2A, H-2A (Early Access). 
The Early Access variant indicates jobs from the 790/790A feed with JO designation.';
```

### 4. Execute o SQL
- Clique no botão **"Run"** (ou pressione Ctrl+Enter)
- Aguarde a mensagem de sucesso: **"Success. No rows returned"**

### 5. Verifique a Aplicação
Execute este SQL para verificar:

```sql
-- Teste se a função aceita o novo visa_type
SELECT 'H-2A (Early Access)'::text IN (
  SELECT unnest(ARRAY['H-2B', 'H-2A', 'H-2A (Early Access)'])
) AS is_valid;
```

Deve retornar `true`.

---

## ✅ Após Aplicar

1. A importação vai funcionar imediatamente
2. Não precisa reiniciar o app
3. Pode fazer upload dos ZIPs

---

## 🔍 Se Der Erro

Se o SQL der erro, pode ser que a função já exista. Neste caso, execute:

```sql
-- Forçar recriação da função
DROP FUNCTION IF EXISTS public.validate_public_jobs_visa_type() CASCADE;

-- Depois cole e execute o SQL completo acima novamente
```

---

## 📞 Problemas?

Se ainda der erro após aplicar:
1. Verifique se você está no projeto correto (dalarhopratsgzmmzhxx)
2. Verifique se tem permissões de admin no Supabase
3. Tente pelo SQL Editor ao invés de migrations

---

**Aplique esta migration e depois teste a importação novamente!**
