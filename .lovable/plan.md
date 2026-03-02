

# H2 Linker B2B Pivot -- Phase 1: Foundation

## Overview
Add an employer portal alongside the existing worker system. Phase 1 covers: database schema, role separation (RBAC), employer profiles, sponsored jobs, guest application flow, and Stripe subscription billing for employers.

## Pricing (USD only for employers, subscription model)

| Tier | Monthly | Annual |
|------|---------|--------|
| Essential | $49/mo | $470/yr |
| Professional | $99/mo | $950/yr |
| Enterprise | $149/mo | $1,430/yr |

---

## Step 1: Stripe Products & Prices

Create 6 Stripe prices (monthly + annual for each tier) using Stripe tools before writing any code.

---

## Step 2: Database Migration

### New Enum
```text
employer_tier: 'essential' | 'professional' | 'enterprise'
employer_status: 'active' | 'inactive'
```

### New Tables

**employer_profiles**
- id (uuid PK), user_id (uuid, references auth.users, unique), company_name, tier (employer_tier), is_verified (bool, default false), contact_email, contact_phone, status (employer_status, default 'active'), stripe_customer_id, stripe_subscription_id, created_at, updated_at
- Indexes: user_id, tier, status

**sponsored_jobs**
- id (uuid PK), employer_id (uuid FK -> employer_profiles), title, description, location, start_date, end_date, is_active (bool, default true), is_sponsored (bool, default true), priority_level (text: free/essential/professional/enterprise), req_english, req_experience, req_drivers_license, consular_only (booleans), view_count, click_count (integers, default 0), created_at
- Indexes: employer_id, is_active, priority_level, created_at

**job_applications** (immutable -- no delete)
- id (uuid PK), job_id (FK -> sponsored_jobs), full_name, email, phone, has_english, has_experience, has_license, is_in_us (booleans), citizenship_status (text enum), employer_status (text: new/contacted/rejected, default 'new'), rejection_reason, score_color (text: green/yellow/red), created_at
- UNIQUE(email, job_id)
- Indexes: job_id, employer_status, citizenship_status, created_at

**audit_logs** (immutable -- INSERT only, no UPDATE/DELETE)
- id (uuid PK), job_id, application_id, employer_id (uuid FK), action (text: contacted/rejected), reason, created_at

### Add 'employer' to existing app_role enum
```sql
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'employer';
```

### RLS Policies

- **employer_profiles**: SELECT/UPDATE only where user_id = auth.uid()
- **sponsored_jobs**: Employer CRUD on own jobs; Public SELECT where is_active = true
- **job_applications**: Anon INSERT only; Employer SELECT/UPDATE(employer_status only) on own jobs' applications
- **audit_logs**: Employer SELECT on own jobs; INSERT via server function only

### DB Functions
- `check_employer_job_limit(employer_id)`: enforces tier-based active job limits (1/3/5)
- `compute_application_score(job_id, application_id)`: server-side green/yellow/red scoring
- `deactivate_employer_jobs(employer_id)`: sets all sponsored jobs to free when subscription lapses

---

## Step 3: Edge Functions

### create-employer-checkout
- Accepts tier + billing_interval (month/year)
- Creates Stripe checkout session with mode: 'subscription'
- Stores user_id in metadata

### check-employer-subscription
- Queries Stripe for active subscription by customer email
- Returns: subscribed, tier, subscription_end
- Called on login + periodically

### employer-portal (customer portal)
- Creates Stripe billing portal session for subscription management

### submit-application (public, no auth)
- Validates honeypot field, rate limits by IP
- Normalizes email, checks UNIQUE(email, job_id)
- Computes score_color server-side
- Inserts into job_applications

### Update existing stripe-webhook
- Handle `customer.subscription.updated` and `customer.subscription.deleted` events
- On cancellation/failure: update employer_profiles.status = 'inactive', call deactivate_employer_jobs()
- On reactivation: restore status = 'active'

---

## Step 4: Frontend -- Role-Based Routing

### Auth Page Updates
- Add role selector on signup: "I'm looking for work" (worker) vs "I'm hiring" (employer)
- Store role in user_roles table on signup
- Worker signup keeps current flow (no SMTP required initially per spec -- but existing onboarding stays for now)
- Employer signup skips SMTP onboarding entirely

### Route Guards
- New `EmployerRoute` component that checks user role
- Worker routes remain unchanged
- Employer routes: /employer/dashboard, /employer/jobs, /employer/jobs/:id/applicants, /employer/plans, /employer/settings

---

## Step 5: Frontend -- Employer Pages

### Employer Plans Page (/employer/plans)
- 3 cards: Essential ($49/mo), Professional ($99/mo), Enterprise ($149/mo)
- Annual toggle showing discounted prices
- Checkout via create-employer-checkout edge function

### Employer Dashboard (/employer/dashboard)
- Active jobs count (with tier limit indicator)
- Total applications count
- Quick actions: Create Job, View Applicants
- When status = 'inactive': blurred dashboard with "Reactivate" CTA

### Create/Edit Job (/employer/jobs/new)
- Form: title, description, location, dates, screening toggles
- Tier limit enforcement (1/3/5 active jobs)

### Applicant Table (/employer/jobs/:id/applicants)
- Columns: Name, Email, Phone, Citizenship Badge, Score (traffic light), Status, Date
- Contact buttons (mailto, tel) that log to audit_logs
- Reject button with modal + reason dropdown
- Paginated, sortable

### Guest Application Page (/apply/:jobId)
- Public route, no login required
- Fetches job details, renders form based on screening toggles
- Honeypot field, basic rate limiting
- Success message after submission

---

## Step 6: Hub Integration

Update the existing Jobs page to display sponsored jobs with priority ordering:
1. Enterprise (Gold badge)
2. Professional (Silver badge)
3. Essential (Sponsored badge)
4. Free (existing DOL jobs)

Add "Sponsored" / "Verified Employer" badges to job cards.

---

## Technical Notes

- All existing worker functionality (mailing queue, worker plans, radar, etc.) remains completely untouched
- Employer billing is subscription-based (Stripe subscriptions), separate from worker one-time payments
- The profiles table is NOT modified -- employer data lives in employer_profiles
- Role check uses existing `has_role()` function and user_roles table
- Scoring computation happens server-side only (edge function), never on the client
- US citizen/permanent resident applications get "Priority Review" badge, pinned above others
- Compliance disclaimer shown on screening setup page

