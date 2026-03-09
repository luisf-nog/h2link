

## Diagnosis Confirmed

The **bulk-pause circuit breaker in `process-queue`** is alive and well. Here's the exact problematic code at line 981-990:

```typescript
if (consecutiveErrors >= 3) {
  await serviceClient
    .from("my_queue")
    .update({
      status: "paused",
      last_error: "[CIRCUIT_BREAKER] Pausado por 3+ erros consecutivos...",
    })
    .eq("user_id", userId)
    .eq("status", "pending");  // ← BULK PAUSE: all pending items
  break;
}
```

**The scenario you described is exactly what happens:**
1. Cron processes user's queue, hits 3 bad emails (550 user unknown, mailbox full, etc.)
2. `consecutiveErrors` reaches 3
3. **ALL remaining pending items** are bulk-paused with `[CIRCUIT_BREAKER]`
4. User sees 149+ items suddenly paused with no clear explanation

**Additional problem:** The `isCircuitBreakerError()` function (line 73-85) counts **550 errors** (invalid recipient) as circuit-breaker-worthy. But "550 user unknown" is a **per-recipient** problem, not an SMTP credential problem. The user's SMTP is fine; it's just that 3 bad email addresses in a row kill the entire queue.

### Two separate circuit breakers with different behavior:

| Aspect | Backend (process-queue) | Frontend (Queue.tsx) |
|--------|------------------------|---------------------|
| Threshold | 3 errors | 5 errors |
| Action | Bulk-pause ALL pending | Stop loop + reset smtp_verified |
| Error types | 550, 551, 552, 553, 554, auth, AI errors | Any error at all |
| Scope | Persisted via `profiles.consecutive_errors` (survives across cron runs) | Local variable (session only) |

---

## Plan

### 1. Fix `isCircuitBreakerError()` in process-queue — only count SMTP auth/config errors

Remove recipient-specific errors (550 user unknown, mailbox full) from the circuit breaker trigger. Only true SMTP credential/config failures should count:

- Keep: 535, 534, 530 (auth failures), timeouts, AI gateway errors
- Remove: 550, 551, 552, 553, 554 (these are per-recipient, not systemic)

### 2. Remove the bulk-pause from process-queue

Replace the bulk `UPDATE ... SET status = 'paused' WHERE status = 'pending'` with a simple `break` — stop processing for this cron run but don't touch the remaining items. The next cron run will re-check `consecutive_errors` and skip if still high.

### 3. Add descriptive `last_error` on failed items

The error message is already being saved per-item via `classifySmtpError()`. The frontend already displays it with tooltips (`parseSmtpError`). No change needed here — the per-item error display already works. What's missing is the **badge-level summary** when the circuit breaker fires.

### 4. Show circuit breaker reason in the sending badge

When the backend circuit breaker fires (or frontend detects 5+ errors), show the **last error type** in the progress badge so the user understands why sending stopped. Example: "Envio pausado: Senha SMTP incorreta" or "Envio pausado: 3 falhas consecutivas de autenticação".

### 5. Sync frontend circuit breaker to also only count auth errors

Update `Queue.tsx` to only increment `consecutiveSmtpFailures` for auth/config errors (not for "550 user unknown" which is a per-recipient issue). Individual bad-address failures should mark that item as `failed` and move on.

### Files to edit:
- `supabase/functions/process-queue/index.ts` — fix `isCircuitBreakerError`, remove bulk-pause
- `frontend/supabase/functions/process-queue/index.ts` — same (mirror)
- `frontend/src/pages/Queue.tsx` — filter which errors count toward circuit breaker, show reason in badge
- `frontend/src/lib/smtpErrorParser.ts` — add helper to classify error as "systemic" vs "per-recipient"

