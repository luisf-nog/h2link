

## Root Cause Analysis

The problem is a **race condition between batch status reset and sequential processing**:

1. `handleRetryAllPaused` sets ALL eligible items to `"pending"` **upfront** (via `Promise.all`)
2. `sendQueueItems` then processes them **one by one** in a loop
3. If the 1st item fails with a critical SMTP error, `send-email-custom` increments `consecutive_errors` on the profile
4. If `consecutive_errors >= 3` (which is likely since previous errors weren't cleared), the server-side circuit breaker fires and **pauses ALL pending items** for the user — including items #2 through #N that were just set to pending but never attempted
5. Result: all items return to `paused` even though only 1 had a problem

The same happens with `handleSendOne` for individual resends if `consecutive_errors` was already at 2+ from prior sessions.

### Secondary issue
The `consecutive_errors` counter on the profile is **not reset** when the user initiates a manual resend. So stale error counts from previous sessions carry over and trigger the circuit breaker prematurely.

## Fix Plan

### 1. Reset `consecutive_errors` before resend batches (`Queue.tsx`)
Before calling `sendQueueItems` in `handleRetryAllPaused`, `handleSendOne` (for paused items), and `handleRetryAllFailed`, reset `consecutive_errors` to 0 on the profile. This prevents stale error counts from triggering the circuit breaker on the first failure.

### 2. Lazy status update — don't batch-set all items to pending upfront (`Queue.tsx`)
Change `handleRetryAllPaused` to NOT update all items to `"pending"` before processing. Instead, pass the items to `sendQueueItems` with a flag, and update each item's status to `"pending"` **just before** it's actually sent (inside the loop). This way, if the circuit breaker fires, only already-attempted items are affected — the rest remain `paused` safely.

Concretely:
- Remove the `Promise.all` batch update from `handleRetryAllPaused`
- In `sendQueueItems`, at the top of the loop for each item, if the item's status is not `"pending"`, update it to `"pending"` (with tracking reset) right before attempting to send

### 3. Same lazy approach for `handleRetryAllFailed` (`Queue.tsx`)
Apply the same pattern: don't batch-reset all failed items to pending upfront.

### Files to edit
| File | Change |
|------|--------|
| `frontend/src/pages/Queue.tsx` | (1) Reset `consecutive_errors` before resend flows. (2) Move per-item status reset into the `sendQueueItems` loop instead of batch-upfront. |

