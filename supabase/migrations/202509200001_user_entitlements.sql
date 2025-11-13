-- Supabase migration: user-level entitlements + RC webhook events
-- Safe to run multiple times (IF NOT EXISTS)

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entitlement text NOT NULL,
  source text NOT NULL DEFAULT 'revenuecat' CHECK (source IN ('revenuecat', 'manual', 'promo', 'school_plan')),
  product_id text NULL,
  platform text NOT NULL DEFAULT 'unknown' CHECK (platform IN ('android', 'ios', 'web', 'unknown')),
  rc_app_user_id text NULL,
  rc_entitlement_id text NULL,
  rc_event_id text NULL,
  active boolean NOT NULL DEFAULT TRUE,
  expires_at timestamptz NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_user_entitlements_active
ON public.user_entitlements (user_id, entitlement) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_entitlements_user ON public.user_entitlements (user_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_rc_event ON public.user_entitlements (rc_event_id);

CREATE TABLE IF NOT EXISTS public.revenuecat_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  app_user_id text NULL,
  type text NOT NULL,
  environment text NULL,
  raw jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS user_entitlements_select_own ON public.user_entitlements;
CREATE POLICY user_entitlements_select_own
ON public.user_entitlements FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.app_is_super_admin());

DROP POLICY IF EXISTS rc_events_admin_select ON public.revenuecat_webhook_events;
CREATE POLICY rc_events_admin_select
ON public.revenuecat_webhook_events FOR SELECT TO authenticated
USING (public.app_is_super_admin());

CREATE OR REPLACE FUNCTION public.grant_user_entitlement(
  p_user_id uuid,
  p_entitlement text,
  p_product_id text DEFAULT NULL,
  p_platform text DEFAULT 'unknown',
  p_source text DEFAULT 'revenuecat',
  p_expires_at timestamptz DEFAULT NULL,
  p_rc_app_user_id text DEFAULT NULL,
  p_rc_event_id text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  v_id uuid;
begin
  update public.user_entitlements
     set active = false,
         cancelled_at = coalesce(cancelled_at, now()),
         updated_at = now()
   where user_id = p_user_id
     and entitlement = p_entitlement
     and active = true;

  insert into public.user_entitlements (
    user_id, entitlement, source, product_id, platform,
    rc_app_user_id, rc_event_id, expires_at, meta
  ) values (
    p_user_id, p_entitlement, p_source, p_product_id, p_platform,
    p_rc_app_user_id, p_rc_event_id, p_expires_at, coalesce(p_meta, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;$$;

CREATE OR REPLACE FUNCTION public.revoke_user_entitlement(
  p_user_id uuid,
  p_entitlement text,
  p_reason text DEFAULT NULL,
  p_rc_event_id text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  update public.user_entitlements
     set active = false,
         cancelled_at = now(),
         updated_at = now(),
         meta = coalesce(meta, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('revocation_reason', p_reason, 'rc_event_id', p_rc_event_id))
   where user_id = p_user_id
     and entitlement = p_entitlement
     and active = true;

  return found::int;
end;$$;

COMMIT;
