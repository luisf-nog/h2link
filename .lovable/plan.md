
# Plano: Otimização dos Modelos de IA nas Edge Functions

## Resumo
Atualizar todas as Edge Functions de IA para usar modelos mais eficientes e estáveis do Lovable AI Gateway, reduzindo custos sem sacrificar qualidade.

## Alterações por Arquivo

### 1. `supabase/functions/parse-resume/index.ts`
**Linha 101**: Trocar modelo
```
De: "google/gemini-3-flash-preview"
Para: "google/gemini-2.5-flash-lite"
```

**Justificativa**: Extração de JSON estruturado é uma tarefa simples. O modelo Lite é suficiente e mais barato/rápido.

---

### 2. `supabase/functions/generate-template/index.ts`
**Linha 145**: Trocar modelo
```
De: "google/gemini-3-flash-preview"
Para: "google/gemini-2.5-flash-lite"
```

**Justificativa**: Templates genéricos não requerem raciocínio complexo. Modelo Lite atende bem.

---

### 3. `supabase/functions/generate-job-email/index.ts`
**Linha 433**: Trocar modelo
```
De: "google/gemini-3-flash-preview"
Para: "google/gemini-2.5-flash"
```

**Justificativa**: Escrita criativa de emails personalizados requer qualidade maior. Usamos o Flash standard (não Lite) para manter a qualidade, mas removemos o "-preview" para estabilidade.

---

## Comparativo de Modelos

| Modelo | Custo | Velocidade | Qualidade | Uso Ideal |
|--------|-------|------------|-----------|-----------|
| `gemini-2.5-flash-lite` | Muito baixo | Muito rápida | Boa | JSON, classificação, tarefas simples |
| `gemini-2.5-flash` | Baixo | Rápida | Muito boa | Escrita criativa, raciocínio moderado |

---

## Configuração

Nenhuma configuração adicional é necessária. O `LOVABLE_API_KEY` já está pré-configurado no Lovable Cloud e funciona com todos os modelos suportados pelo gateway.

---

## Deploy

Após as alterações, as Edge Functions serão redeployadas automaticamente.
