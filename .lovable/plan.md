

## Plan: Replace SendingStatusCard with Discrete Sending Badge + Pause Button

### Problems Identified

1. **Flickering SendingStatusCard**: The condition `processingItems.length > 0 || (sending && pendingItems.length > 0)` causes the card to appear/disappear constantly because realtime updates change item statuses between `processing`/`sent`/`pending` rapidly. The card is also too large and intrusive.

2. **No pause mechanism**: Once sending starts, there's no way to stop the loop. The user wants a pause button.

3. **Realtime updates overwrite local state**: The realtime subscription's `debouncedFetch` can overwrite optimistic UI state mid-send, causing visual inconsistencies.

### Solution

#### 1. Replace `SendingStatusCard` with a small inline badge (Queue.tsx)

Remove the large card. Add a small sticky/inline badge at the top of the queue (next to the action buttons) that shows:
- A subtle animated dot + "Sending... (3/15)" text
- A "Pause" button that stops the loop

#### 2. Add pause/cancel mechanism (Queue.tsx)

Use a `useRef` flag (`sendCancelledRef`) that the send loop checks before each iteration. When the user clicks "Pause", set the flag to `true`. The loop will stop gracefully, leaving remaining items in their current status (not converting them to pending if using lazy activation).

#### 3. Suppress realtime refetch during active sending

While `sending === true`, skip the `debouncedFetch` in the realtime handler to avoid overwriting local optimistic state. Only apply the inline `UPDATE` patch.

### Files to edit

| File | Change |
|------|--------|
| `frontend/src/pages/Queue.tsx` | (1) Add `sendCancelledRef` for pause. (2) Replace `SendingStatusCard` render with a small badge+pause button. (3) Check `sendCancelledRef` in `sendQueueItems` loop. (4) Skip `debouncedFetch` while `sending`. |
| `frontend/src/components/queue/SendingStatusCard.tsx` | Delete or repurpose — will no longer be used. |

### Badge Design

A small bar below the header buttons:
```
[● Sending 3/15 emails...  ⏸ Pause]
```
- Green pulsing dot
- Compact, single line
- Pause button stops the loop and shows toast "Sending paused. X emails sent."

