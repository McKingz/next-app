-- Add user-level entitlements and RevenueCat webhook event logs
-- Date: 2025-09-20
-- NOTE: This creates tables only; no data is modified.

BEGIN;

-- 1) Canonical user entitlements (user-level perks such as ad_free, premium_ai, etc.)
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entitlement text NOT NULL,                            -- e.g., 'premium', 'ad_free', 'ai_pro'
  source text NOT NULL DEFAULT 'revenuecat' CHECK (source IN ('revenuecat', 'manual', 'promo', 'school_plan')),
  product_id text NULL,                                  -- RC product identifier
  platform text NOT NULL DEFAULT 'unknown' CHECK (platform IN ('android', 'ios', 'web', 'unknown')),
  rc_app_user_id text NULL,                              -- RevenueCat app_user_id we received
  rc_entitlement_id text NULL,                           -- RevenueCat entitlement id/name
  rc_event_id text NULL,                                 -- RC webhook event id for idempotency/audit
  active boolean NOT NULL DEFAULT TRUE,
  expires_at timestamptz NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one active record per (user, entitlement)
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_entitlements_active
ON public.user_entitlements (user_id, entitlement)
WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_entitlements_user ON public.user_entitlements (user_id);
CREATE INDEX IF NOT EXISTS idx_user_entitlements_rc_event ON public.user_entitlements (rc_event_id);

-- 2) Raw RevenueCat webhook event storage for audit/idempotency
CREATE TABLE IF NOT EXISTS public.revenuecat_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,           -- RevenueCat event id
  app_user_id text NULL,                   -- RevenueCat app_user_id
  type text NOT NULL,                      -- INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, etc.
  environment text NULL,                   -- PRODUCTION / SANDBOX
  raw jsonb NOT NULL,                      -- full payload
  processed boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) RLS (clients can read only their own entitlements; events visible to superadmin only)
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;

-- Helper to detect super admin (kept compatible)
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

-- Policies for user_entitlements
DROP POLICY IF EXISTS user_entitlements_select_own ON public.user_entitlements;
CREATE POLICY user_entitlements_select_own
ON public.user_entitlements FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.app_is_super_admin());

-- No insert/update/delete policies for authenticated users; service role & edge functions bypass RLS.

-- Policies for revenuecat_webhook_events (readable only by super admins)
DROP POLICY IF EXISTS rc_events_admin_select ON public.revenuecat_webhook_events;
CREATE POLICY rc_events_admin_select
ON public.revenuecat_webhook_events FOR SELECT TO authenticated
USING (public.app_is_super_admin());

-- 4) Convenience functions for webhook handler
-- Grant/refresh entitlement (ends previous active row for the same entitlement)
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
  -- End any currently active entitlement of the same type for this user
  update public.user_entitlements
     set active = false,
         cancelled_at = coalesce(cancelled_at, now()),
         updated_at = now()
   where user_id = p_user_id
     and entitlement = p_entitlement
     and active = true;

  -- Insert a new active row
  insert into public.user_entitlements (
    user_id, entitlement, source, product_id, platform,
    rc_app_user_id, rc_event_id, expires_at, meta
  ) values (
    p_user_id, p_entitlement, p_source, p_product_id, p_platform,
    p_rc_app_user_id, p_rc_event_id, p_expires_at, coalesce(p_meta, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;$$;

-- Revoke entitlement (mark inactive)
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
