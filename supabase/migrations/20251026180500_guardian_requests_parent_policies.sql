-- Add parent-facing RLS policies for guardian_requests
-- Ensures parents can submit and view their own link requests

-- Idempotent: drop if exists then recreate
DROP POLICY IF EXISTS guardian_requests_parent_insert ON public.guardian_requests;
DROP POLICY IF EXISTS guardian_requests_parent_select_own ON public.guardian_requests;

-- Parents can create pending requests for their own auth id, and only for their school
CREATE POLICY guardian_requests_parent_insert ON public.guardian_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    parent_auth_id = auth.uid()
    AND status = 'pending'
    AND (
      school_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'parent'
          AND p.preschool_id = guardian_requests.school_id
      )
    )
  );

-- Parents can view their own requests
CREATE POLICY guardian_requests_parent_select_own ON public.guardian_requests
  FOR SELECT TO authenticated
  USING (parent_auth_id = auth.uid());
