

# Correcao: Radar Autopilot nao processa vagas automaticamente

## Diagnostico

Comparei a funcao SQL `trigger_immediate_radar` (chamada quando voce liga/desliga o Radar) com a Edge Function `process-radar` (cron automatico a cada 5 min) e encontrei **3 diferencas criticas** que explicam por que voce precisa desligar e ligar o radar manualmente:

### Bug 1: Cron pula o usuario quando creditos acabam (e nunca mais volta)

A Edge Function `process-radar` tem este trecho:

```text
if (creditsRemaining <= 0) {
  console.log("Skipping user: no credits remaining");
  continue;  // PULA O USUARIO INTEIRO
}
```

Quando seus creditos do dia acabam, o cron **para de detectar novas vagas** para voce. Ele nao registra os matches, nao faz nada. No dia seguinte, quando os creditos resetam, ele deveria voltar a funcionar, mas se entre ontem e hoje chegaram vagas novas, elas ja podem ter saido do top 500 (veja Bug 2).

A funcao SQL `trigger_immediate_radar` (do botao) **nao tem essa limitacao** -- ela encontra e enfileira tudo, independente de creditos.

### Bug 2: Cron ve apenas 500 vagas (`.limit(500)`)

A Edge Function filtra vagas com `.limit(500)` ordenando por data. Se existem mais de 500 vagas que batem com seus criterios, as vagas mais antigas ficam **invisiveis** para o cron.

A funcao SQL `trigger_immediate_radar` faz `JOIN` sem limite -- ela ve TODAS as vagas.

### Bug 3: Cron duplicado (menor)

Existem **dois cron jobs** chamando `process-radar`:
- `process-radar-every-30min` (job 4) -- a cada 30 min
- `invoke-process-radar-every-5min` (job 9) -- a cada 5 min

O de 30 min e redundante e desperdiça recursos.

## Evidencia nos dados

```text
02:05 UTC - Cron enfileira 6 vagas
02:06 UTC - Cron enfileira 13 vagas  
06:00 UTC - Auto-import roda (novas vagas entram)
06:05 a 12:22 UTC - ZERO vagas enfileiradas pelo cron (10+ horas)
12:22 UTC - Voce desliga/liga o radar -> 14 vagas enfileiradas
12:25 UTC - Cron roda agora e encontra 276 (porque trigger_immediate_radar limpou os matches antigos)
```

## Plano de Correcao

### 1. Separar deteccao de matches do enfileiramento

O cron deve SEMPRE detectar e registrar matches em `radar_matched_jobs`, mesmo quando os creditos acabam. Apenas a insercao na fila (`my_queue`) deve respeitar o limite de creditos. Assim, quando creditos ficarem disponiveis novamente, as vagas ja estarao marcadas e prontas para envio.

```text
ANTES: creditos = 0 -> pula usuario inteiro (nao detecta nada)
DEPOIS: creditos = 0 -> detecta e registra matches, mas nao enfileira
```

### 2. Remover o `.limit(500)` da query de vagas

Substituir por uma busca sem limite fixo (ou pelo menos `.limit(2000)`), para garantir que todas as vagas que batem com os criterios sejam detectadas, nao apenas as 500 mais recentes.

### 3. Remover cron duplicado

Deletar o cron job 4 (`process-radar-every-30min`) que e redundante com o job 9 (a cada 5 min).

### 4. Melhorar logging

O contador `totalQueued` hoje conta o tamanho do array (tentativas), nao insercoes reais. Vamos usar o retorno do upsert para logar quantas vagas REALMENTE foram inseridas.

## Arquivos a alterar

- `frontend/supabase/functions/process-radar/index.ts` -- correcoes 1, 2 e 4
- `supabase/functions/process-radar/index.ts` -- espelhar as mesmas correcoes
- Migracao SQL -- remover cron duplicado (job 4)

## Detalhes tecnicos

Mudanca principal no `process-radar/index.ts`:

```text
// ANTES: pula usuario inteiro se sem creditos
if (creditsRemaining <= 0) {
  continue;
}

// DEPOIS: separa deteccao de enfileiramento
const canQueue = creditsRemaining > 0;

// Sempre registra matches
await supabase.from("radar_matched_jobs").upsert(matchRecords, {
  onConflict: "user_id,job_id",
});

// So enfileira se tem creditos
if (canQueue && radar.auto_send) {
  const jobsToQueue = jobsToProcess.slice(0, creditsRemaining);
  // ... insere em my_queue
}
```

Para a query de vagas:

```text
// ANTES:
.limit(500)

// DEPOIS:
.limit(2000)
```

SQL para remover cron duplicado:

```sql
SELECT cron.unschedule('process-radar-every-30min');
```

