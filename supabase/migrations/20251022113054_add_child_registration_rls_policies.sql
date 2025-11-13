-- ============================================
-- Child Registration Requests RLS Policies
-- ============================================
-- This migration adds RLS policies to child_registration_requests table
-- to enable parents to submit and view their own registration requests
-- while maintaining tenant isolation.
-- Date: 2025-10-22
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "child_registration_requests_parent_insert" ON public.child_registration_requests;
DROP POLICY IF EXISTS "child_registration_requests_parent_select" ON public.child_registration_requests;
DROP POLICY IF EXISTS "child_registration_requests_parent_update" ON public.child_registration_requests;
DROP POLICY IF EXISTS "child_registration_requests_staff_select" ON public.child_registration_requests;
DROP POLICY IF EXISTS "child_registration_requests_staff_update" ON public.child_registration_requests;

-- 1. PARENTS: Allow INSERT - parents can create registration requests for their preschool
CREATE POLICY "child_registration_requests_parent_insert"
ON public.child_registration_requests
FOR INSERT
TO authenticated
WITH CHECK (
  -- Must match authenticated user's internal user ID
  parent_id IN (
    SELECT id FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
  -- Preschool ID must match user's organization
  AND preschool_id IN (
    SELECT organization_id FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
);

-- 2. PARENTS: Allow SELECT - parents can view their own requests
CREATE POLICY "child_registration_requests_parent_select"
ON public.child_registration_requests
FOR SELECT
TO authenticated
USING (
  -- Can view own requests
  parent_id IN (
    SELECT id FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
  -- Within same preschool
  AND preschool_id IN (
    SELECT organization_id FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
);

-- 3. PARENTS: Allow UPDATE - parents can only update status to 'withdrawn'
CREATE POLICY "child_registration_requests_parent_update"
ON public.child_registration_requests
FOR UPDATE
TO authenticated
USING (
  -- Can update own requests
  parent_id IN (
    SELECT id FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  -- Parents can only change status to 'withdrawn'
  status IN ('pending', 'withdrawn')
);

-- 4. STAFF: Allow SELECT - teachers and principals can view all requests in their preschool
CREATE POLICY "child_registration_requests_staff_select"
ON public.child_registration_requests
FOR SELECT
TO authenticated
USING (
  -- Staff members (teacher, principal) can view all requests in their preschool
  preschool_id IN (
    SELECT u.organization_id FROM public.users u
    INNER JOIN public.profiles p ON u.auth_user_id = p.id
    WHERE u.auth_user_id = auth.uid()
    AND p.role IN ('teacher', 'principal')
  )
);

-- 5. STAFF: Allow UPDATE - teachers and principals can approve/reject requests
CREATE POLICY "child_registration_requests_staff_update"
ON public.child_registration_requests
FOR UPDATE
TO authenticated
USING (
  -- Staff members in the same preschool can update
  preschool_id IN (
    SELECT u.organization_id FROM public.users u
    INNER JOIN public.profiles p ON u.auth_user_id = p.id
    WHERE u.auth_user_id = auth.uid()
    AND p.role IN ('teacher', 'principal')
  )
)
WITH CHECK (
  -- Staff can change status to approved/rejected and add review details
  status IN ('pending', 'approved', 'rejected', 'withdrawn')
);

-- Create index for faster policy checks
CREATE INDEX IF NOT EXISTS idx_child_registration_requests_parent_preschool 
ON public.child_registration_requests (parent_id, preschool_id);

CREATE INDEX IF NOT EXISTS idx_child_registration_requests_status_preschool 
ON public.child_registration_requests (preschool_id, status, requested_at DESC);

-- Add helpful comment
COMMENT ON TABLE public.child_registration_requests IS 
'Child registration requests from parents. RLS policies ensure tenant isolation and role-based access.';

-- Verification: Show RLS status
SELECT 
  'child_registration_requests RLS Status' AS check_type,
  schemaname, 
  tablename, 
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename = 'child_registration_requests';

-- Verification: Show policies
SELECT 
  'child_registration_requests Policies' AS check_type,
  policyname, 
  cmd AS command,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'child_registration_requests'
ORDER BY policyname;