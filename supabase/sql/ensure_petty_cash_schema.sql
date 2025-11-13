-- Ensure Petty Cash schema exists and has all required columns
-- NOTE: Review and adjust types to match your conventions. Run in Supabase SQL editor or via migrations.

-- 1) petty_cash_accounts
create table if not exists public.petty_cash_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  opening_balance numeric not null default 0,
  currency text not null default 'ZAR',
  low_balance_threshold numeric not null default 1000,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) petty_cash_transactions
create table if not exists public.petty_cash_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  account_id uuid not null references public.petty_cash_accounts(id) on delete cascade,
  amount numeric not null,
  type text not null check (type in ('expense','replenishment','adjustment')),
  category text,
  description text not null,
  reference_number text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  occurred_at timestamptz not null default now(),
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helpful composite indexes
create index if not exists idx_petty_cash_tx_school_created on public.petty_cash_transactions (school_id, created_at desc);
create index if not exists idx_petty_cash_tx_status on public.petty_cash_transactions (status);
create index if not exists idx_petty_cash_tx_type on public.petty_cash_transactions (type);

-- 3) petty_cash_receipts (for uploaded receipt files)
create table if not exists public.petty_cash_receipts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  transaction_id uuid not null references public.petty_cash_transactions(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  original_name text,
  content_type text,
  size_bytes integer,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

-- 4) petty_cash_reconciliations (cash counts)
create table if not exists public.petty_cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  preschool_id uuid not null,
  system_amount numeric not null,
  physical_amount numeric not null,
  variance numeric not null,
  cash_breakdown jsonb,
  notes text,
  reconciled_by uuid not null,
  created_at timestamptz not null default now()
);

-- 5) RPC helpers referenced by the app
-- ensure_petty_cash_account(school_uuid uuid or preschool_uuid uuid): returns uuid
-- generate_receipt_upload_path(school_uuid uuid, transaction_id uuid, file_extension text): returns text
-- If these are missing, create compatible versions.

-- Example for ensure_petty_cash_account (adjust parameter name to what your app uses)
create or replace function public.ensure_petty_cash_account(preschool_uuid uuid)
returns uuid
language plpgsql
as $$
declare
  acc_id uuid;
begin
  select id into acc_id from public.petty_cash_accounts where school_id = preschool_uuid and is_active limit 1;
  if acc_id is null then
    insert into public.petty_cash_accounts (school_id) values (preschool_uuid) returning id into acc_id;
  end if;
  return acc_id;
end;$$;

-- Example for generate_receipt_upload_path
create or replace function public.generate_receipt_upload_path(school_uuid uuid, transaction_id uuid, file_extension text)
returns text
language plpgsql
as $$
begin
  return school_uuid::text || '/' || transaction_id::text || '/receipt_' || transaction_id::text || '_' || extract(epoch from now())::bigint::text || '.' || coalesce(file_extension,'jpg');
end;$$;

-- Storage bucket expected: 'petty-cash-receipts'
-- Create it from the Supabase dashboard if missing and ensure RLS policies allow writes by authenticated users of the same tenancy.
