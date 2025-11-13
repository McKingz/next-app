-- Migration: RLS policies for subscription_seats table
-- Created: 2025-09-21
-- Purpose: Implement secure Row Level Security for teacher seat assignments
-- WARP.md compliance: Restrictive RLS, SECURITY DEFINER RPC access only

-- ====================================================================
-- PART 1: DROP EXISTING POLICIES (if any)
-- ====================================================================

-- Clean slate approach - drop any existing policies
DROP POLICY IF EXISTS subscription_seats_select_principal ON public.subscription_seats;
DROP POLICY IF EXISTS subscription_seats_select_teacher ON public.subscription_seats;
DROP POLICY IF EXISTS subscription_seats_block_writes ON public.subscription_seats;
DROP POLICY IF EXISTS subscription_seats_tenant_select ON public.subscription_seats;

-- ====================================================================
-- PART 2: CREATE RESTRICTIVE SELECT POLICY
-- ====================================================================

-- Principals can read seats for subscriptions in their school
-- Teachers can read their own seats only
-- Service role bypass RLS for administrative operations
CREATE POLICY subscription_seats_tenant_select
ON public.subscription_seats
FOR SELECT
USING (
  -- Allow principals to see seats for their school's subscriptions
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    INNER JOIN public.subscriptions AS s ON p.preschool_id = s.school_id
    WHERE
      p.id = auth.uid()
      AND p.role = 'principal'
      AND s.id = subscription_seats.subscription_id
  )
  OR
  -- Allow teachers to see their own seats
  (
    subscription_seats.user_id = auth.uid()
  )
  OR
  -- Allow superadmin to see all seats
  EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE
      p.id = auth.uid()
      AND p.role = 'superadmin'
  )
);

-- ====================================================================
-- PART 3: BLOCK ALL DIRECT WRITES
-- ====================================================================

-- Block all direct INSERT, UPDATE, DELETE operations
-- All modifications must go through SECURITY DEFINER RPCs
CREATE POLICY subscription_seats_block_writes
ON public.subscription_seats
FOR ALL
TO public
USING (FALSE)
WITH CHECK (FALSE);

-- ====================================================================
-- PART 4: ENABLE RLS (if not already enabled)
-- ====================================================================

-- Ensure RLS is enabled
ALTER TABLE public.subscription_seats ENABLE ROW LEVEL SECURITY;

-- ====================================================================
-- PART 5: GRANT BYPASS TO POSTGRES FOR SECURITY DEFINER RPCS
-- ====================================================================

-- Note: SECURITY DEFINER functions running as postgres role will bypass RLS
-- This allows our RPCs to perform necessary operations while keeping the table
-- locked down for direct client access

-- The following comment documents the access model:
COMMENT ON TABLE public.subscription_seats IS
'Teacher seat assignments with strict RLS. Direct access: Principals read own school seats, teachers read own seats only. All writes via SECURITY DEFINER RPCs only. RLS bypassed for postgres role (used by RPCs).';

-- ====================================================================
-- PART 6: VERIFICATION AND LOGGING
-- ====================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'subscription_seats_rls_20250921',
  jsonb_build_object(
    'completed_at', now(),
    'policies_created', ARRAY['subscription_seats_tenant_select', 'subscription_seats_block_writes'],
    'rls_enabled', TRUE,
    'access_model', 'Principals read school seats, teachers read own seats, all writes via RPCs'
  ),
  'Subscription seats RLS policies completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'SUBSCRIPTION SEATS RLS POLICIES CREATED' AS status;

-- Show final RLS status for verification
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd,
  roles
FROM pg_policies
WHERE
  schemaname = 'public'
  AND tablename = 'subscription_seats'
ORDER BY policyname;
