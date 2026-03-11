

## Diagnosis: Migration Timeouts

### What's already done vs. what's pending

I checked each item from `run-pending-migrations` against the live database:

| Step | Migration | Status |
|------|-----------|--------|
| 1 | `set_sent_at_on_sent` trigger | **Already exists** |
| 2 | `sj_public_read` RLS policy | **Already exists** |
| 3 | `employer_tier` free enum | **Already exists** |
| 4 | `employer_profiles` default tier | Still `'essential'` — **needs update** |
| 5 | `dol_pdf_available` column | **Missing** — needs creation |
| 6 | `sponsored_jobs` new columns (`req_english` etc.) | **Missing** — needs creation |

### Why migrations time out

The issue is **not** SQL complexity. Each pending change is trivial (`ALTER TABLE ADD COLUMN`, `ALTER COLUMN SET DEFAULT`). The timeout comes from Lovable Cloud's migration tool having a short deadline when communicating with the database API. With ~19,000 rows in `public_jobs`, even a simple `ADD COLUMN` can take a few seconds, and the tool's gateway times out before getting a response.

This is a **Cloud infrastructure limitation**, not a code problem.

### Plan: Apply the 3 pending changes

We'll use the migration tool with **one tiny SQL per call** — the smallest possible statements. If the tool still times out, we fall back to the `run-pending-migrations` edge function (which connects directly to the DB and bypasses the gateway timeout).

**Migration 1** — `dol_pdf_available` column:
```sql
ALTER TABLE public.public_jobs ADD COLUMN IF NOT EXISTS dol_pdf_available boolean DEFAULT null;
```

**Migration 2** — `employer_profiles` default tier:
```sql
ALTER TABLE public.employer_profiles ALTER COLUMN tier SET DEFAULT 'free'::employer_tier;
```

**Migration 3** — `sponsored_jobs` new columns:
```sql
ALTER TABLE public.sponsored_jobs
  ADD COLUMN IF NOT EXISTS req_english boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS req_experience boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS req_drivers_license boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consular_only boolean NOT NULL DEFAULT false;
```

If any migration times out, we invoke `run-pending-migrations` edge function for the specific step as a fallback.

