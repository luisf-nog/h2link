-- Fix migration: Postgres doesn't support CREATE POLICY IF NOT EXISTS.

-- 1) Base table
create table if not exists public.smtp_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  provider text not null,
  email text not null,
  has_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smtp_credentials_provider_check check (provider in ('gmail','outlook'))
);

create index if not exists idx_smtp_credentials_user_id on public.smtp_credentials(user_id);

alter table public.smtp_credentials enable row level security;

-- policies (drop + recreate to be idempotent)
drop policy if exists "Users can view own smtp credentials" on public.smtp_credentials;
drop policy if exists "Users can insert own smtp credentials" on public.smtp_credentials;
drop policy if exists "Users can update own smtp credentials" on public.smtp_credentials;
drop policy if exists "Users can delete own smtp credentials" on public.smtp_credentials;

create policy "Users can view own smtp credentials"
on public.smtp_credentials
for select
using (auth.uid() = user_id);

create policy "Users can insert own smtp credentials"
on public.smtp_credentials
for insert
with check (auth.uid() = user_id);

create policy "Users can update own smtp credentials"
on public.smtp_credentials
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own smtp credentials"
on public.smtp_credentials
for delete
using (auth.uid() = user_id);

-- triggers
DROP TRIGGER IF EXISTS update_smtp_credentials_updated_at ON public.smtp_credentials;
create trigger update_smtp_credentials_updated_at
before update on public.smtp_credentials
for each row
execute function public.update_updated_at_column();


-- 2) Secrets table (no SELECT policy)
create table if not exists public.smtp_credentials_secrets (
  user_id uuid primary key,
  password text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smtp_credentials_secrets_user_id_fk
    foreign key (user_id) references public.smtp_credentials(user_id)
    on delete cascade
);

alter table public.smtp_credentials_secrets enable row level security;

drop policy if exists "Users can insert own smtp secret" on public.smtp_credentials_secrets;
drop policy if exists "Users can update own smtp secret" on public.smtp_credentials_secrets;
drop policy if exists "Users can delete own smtp secret" on public.smtp_credentials_secrets;

create policy "Users can insert own smtp secret"
on public.smtp_credentials_secrets
for insert
with check (auth.uid() = user_id);

create policy "Users can update own smtp secret"
on public.smtp_credentials_secrets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own smtp secret"
on public.smtp_credentials_secrets
for delete
using (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_smtp_credentials_secrets_updated_at ON public.smtp_credentials_secrets;
create trigger update_smtp_credentials_secrets_updated_at
before update on public.smtp_credentials_secrets
for each row
execute function public.update_updated_at_column();


-- 3) Sync has_password
create or replace function public.sync_smtp_has_password()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    update public.smtp_credentials
      set has_password = false,
          updated_at = now()
    where user_id = old.user_id;
    return old;
  else
    update public.smtp_credentials
      set has_password = true,
          updated_at = now()
    where user_id = new.user_id;
    return new;
  end if;
end;
$$;

DROP TRIGGER IF EXISTS trg_sync_smtp_has_password_insupd ON public.smtp_credentials_secrets;
create trigger trg_sync_smtp_has_password_insupd
after insert or update on public.smtp_credentials_secrets
for each row
execute function public.sync_smtp_has_password();

DROP TRIGGER IF EXISTS trg_sync_smtp_has_password_del ON public.smtp_credentials_secrets;
create trigger trg_sync_smtp_has_password_del
after delete on public.smtp_credentials_secrets
for each row
execute function public.sync_smtp_has_password();
