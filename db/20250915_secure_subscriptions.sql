-- RLS-safe RPCs and policies for subscriptions dashboard
-- Run this in Supabase SQL editor with service role or via CLI

-- 1) Public read access to active plans via RPC (keeps RLS intact)
CREATE OR REPLACE FUNCTION public.public_list_plans()
RETURNS TABLE (
  id uuid,
  name text,
  tier text,
  price_monthly numeric,
  price_annual numeric,
  max_teachers int,
  max_students int,
  is_active boolean
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  select p.id, p.name, p.tier, p.price_monthly, p.price_annual, p.max_teachers, p.max_students, coalesce(p.is_active, true)
  from public.subscription_plans p
  where coalesce(p.is_active, true) = true
  order by p.price_monthly nulls last;
$$;

REVOKE ALL ON FUNCTION public.public_list_plans FROM public;
GRANT EXECUTE ON FUNCTION public.public_list_plans() TO anon, authenticated;

-- 2) Public read access to schools list via RPC (minimal columns)
CREATE OR REPLACE FUNCTION public.public_list_schools()
RETURNS TABLE (
  id uuid,
  name text,
  tenant_slug text,
  subscription_tier text
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  select s.id, s.name, s.tenant_slug, s.subscription_tier
  from public.preschools s
  order by s.name asc
$$;

REVOKE ALL ON FUNCTION public.public_list_schools FROM public;
GRANT EXECUTE ON FUNCTION public.public_list_schools() TO authenticated;

-- 3) Admin RPC to create a school-owned subscription safely (checks role)
-- Ensure only one canonical signature exists by dropping possible overloads first
-- Variations that may have been created previously (varchar/uuid variations etc.)
DROP FUNCTION IF EXISTS public.admin_create_school_subscription(uuid, text, text, int);
DROP FUNCTION IF EXISTS public.admin_create_school_subscription(uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.admin_create_school_subscription(uuid, varchar, varchar, int);
DROP FUNCTION IF EXISTS public.admin_create_school_subscription(uuid, varchar, varchar, integer);
DROP FUNCTION IF EXISTS public.admin_create_school_subscription(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_create_school_subscription(uuid, varchar, varchar);
DROP FUNCTION IF EXISTS public.admin_create_school_subscription(uuid, uuid, text, int);
DROP FUNCTION IF EXISTS public.admin_create_school_subscription(uuid, uuid, text, integer);

CREATE OR REPLACE FUNCTION public.admin_create_school_subscription(
  p_school_id uuid,
  p_plan_id text,
  p_billing_frequency text,
  p_seats_total int DEFAULT 1
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
declare
  v_sub_id uuid;
  v_is_admin boolean;
  v_start timestamptz := now();
  v_end timestamptz;
begin
  -- Require authenticated user; verify they are super admin or principal_admin
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('super_admin','superadmin','principal_admin')
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'not authorized';
  end if;

  if p_billing_frequency not in ('monthly','annual') then
    raise exception 'invalid billing_frequency';
  end if;

  if p_billing_frequency = 'annual' then
    v_end := (v_start + interval '1 year');
  else
    v_end := (v_start + interval '1 month');
  end if;

  insert into public.subscriptions (
    id, school_id, plan_id, status, owner_type, billing_frequency,
    start_date, end_date, next_billing_date, seats_total, seats_used, metadata
  ) values (
    gen_random_uuid(), p_school_id, p_plan_id, 'active', 'school', p_billing_frequency,
    v_start, v_end, v_end, greatest(1, coalesce(p_seats_total, 1)), 0,
    jsonb_build_object('created_by', 'admin_rpc')
  ) returning id into v_sub_id;

  -- Optional: set school subscription_tier to plan_id when applicable
  update public.preschools set subscription_tier = p_plan_id where id = p_school_id;

  return v_sub_id;
end;
$$;

REVOKE ALL ON FUNCTION public.admin_create_school_subscription(uuid, text, text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_create_school_subscription(uuid, text, text, int) TO authenticated;

-- 4) Optional: RLS policies for read-only access if not present
-- Allow read of subscriptions to authenticated users who are super admins
CREATE OR REPLACE FUNCTION public.app_is_super_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('superadmin','super_admin')
  );
$$;

DROP POLICY IF EXISTS subscriptions_admin_read ON public.subscriptions;
CREATE POLICY subscriptions_admin_read ON public.subscriptions
FOR SELECT USING (public.app_is_super_admin());
