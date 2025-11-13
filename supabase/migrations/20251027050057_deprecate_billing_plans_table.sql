-- Deprecate billing_plans table
-- This table is no longer used; subscription_plans is the source of truth
-- We'll rename it to indicate it's deprecated and remove public access

-- 1. Add deprecation comment to table
COMMENT ON TABLE public.billing_plans IS 'DEPRECATED: This table is no longer in use. Use subscription_plans instead. Kept for historical reference only.';

-- 2. Mark all plans as inactive to prevent any use
UPDATE public.billing_plans
SET active = FALSE;

-- 3. Drop RLS policies to prevent access
DROP POLICY IF EXISTS "billing_plans_public_read" ON public.billing_plans;
DROP POLICY IF EXISTS "billing_plans_rls_read" ON public.billing_plans;
DROP POLICY IF EXISTS "billing_plans_rls_write" ON public.billing_plans;

-- 4. Create a restrictive policy (superadmin read-only for archival purposes)
CREATE POLICY "billing_plans_deprecated_superadmin_only" 
ON public.billing_plans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'superadmin'
  )
);

-- 5. Add a note in the description field for all records
UPDATE public.billing_plans
SET description = COALESCE(description || ' ', '') || '[DEPRECATED: Use subscription_plans table instead]';

-- Note: We're keeping the table for historical reference and to avoid breaking
-- any existing foreign key constraints. If needed, it can be renamed or dropped
-- in a future migration after verifying no dependencies exist.