-- Minimal parent portal tables for PoP upload and child registration (RLS-enabled)
-- Date: 2025-09-17

BEGIN;

-- Ensure required extension is available (on Supabase it usually is)
-- create extension if not exists pgcrypto;

-- 1) Parent Payments (Proof of Payment uploads)
CREATE TABLE IF NOT EXISTS public.parent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  parent_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  reference text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  notes text NULL
);

ALTER TABLE public.parent_payments ENABLE ROW LEVEL SECURITY;

-- Function to set parent_id from auth.uid() when not provided
CREATE OR REPLACE FUNCTION public.set_parent_payments_parent_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  if new.parent_id is null then
    new.parent_id := auth.uid();
  end if;
  return new;
end;$$;

DROP TRIGGER IF EXISTS trg_set_parent_payments_parent_id ON public.parent_payments;
CREATE TRIGGER trg_set_parent_payments_parent_id
BEFORE INSERT ON public.parent_payments
FOR EACH ROW EXECUTE FUNCTION public.set_parent_payments_parent_id();

-- Super admin helper (if not present)
CREATE OR REPLACE FUNCTION public.app_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  select exists (
    select 1 from public.profiles p 
    where p.id = auth.uid() and lower(p.role) in ('super_admin','superadmin')
  );
$$;

-- Policies (drop if exist to avoid IF NOT EXISTS incompatibilities)
-- SELECT own or super admin
DROP POLICY IF EXISTS parent_payments_select_own_or_admin ON public.parent_payments;
CREATE POLICY parent_payments_select_own_or_admin
ON public.parent_payments FOR SELECT
USING (
  parent_id = auth.uid() OR public.app_is_super_admin()
);

-- INSERT self
DROP POLICY IF EXISTS parent_payments_insert_self ON public.parent_payments;
CREATE POLICY parent_payments_insert_self
ON public.parent_payments FOR INSERT TO authenticated
WITH CHECK (
  parent_id IS NULL OR parent_id = auth.uid()
);

-- UPDATE pending (own)
DROP POLICY IF EXISTS parent_payments_update_pending_own ON public.parent_payments;
CREATE POLICY parent_payments_update_pending_own
ON public.parent_payments FOR UPDATE TO authenticated
USING (
  parent_id = auth.uid() AND status = 'pending_review'
)
WITH CHECK (
  parent_id = auth.uid() AND status = 'pending_review'
);

-- 2) Child Registration Requests
CREATE TABLE IF NOT EXISTS public.child_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  parent_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid NULL REFERENCES auth.users (id),
  reviewed_at timestamptz NULL,
  notes text NULL
);

ALTER TABLE public.child_registration_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_child_reg_parent_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  if new.parent_id is null then
    new.parent_id := auth.uid();
  end if;
  return new;
end;$$;

DROP TRIGGER IF EXISTS trg_set_child_reg_parent_id ON public.child_registration_requests;
CREATE TRIGGER trg_set_child_reg_parent_id
BEFORE INSERT ON public.child_registration_requests
FOR EACH ROW EXECUTE FUNCTION public.set_child_reg_parent_id();

DROP POLICY IF EXISTS child_reg_select_own_or_admin ON public.child_registration_requests;
CREATE POLICY child_reg_select_own_or_admin
ON public.child_registration_requests FOR SELECT
USING (
  parent_id = auth.uid() OR public.app_is_super_admin()
);

-- INSERT self
DROP POLICY IF EXISTS child_reg_insert_self ON public.child_registration_requests;
CREATE POLICY child_reg_insert_self
ON public.child_registration_requests FOR INSERT TO authenticated
WITH CHECK (
  parent_id IS NULL OR parent_id = auth.uid()
);

-- UPDATE pending (own)
DROP POLICY IF EXISTS child_reg_update_pending_own ON public.child_registration_requests;
CREATE POLICY child_reg_update_pending_own
ON public.child_registration_requests FOR UPDATE TO authenticated
USING (
  parent_id = auth.uid() AND status = 'pending'
)
WITH CHECK (
  parent_id = auth.uid() AND status = 'pending'
);

COMMIT;
