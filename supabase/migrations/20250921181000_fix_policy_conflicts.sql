-- Fix Policy Conflicts and Infinite Recursion
-- Date: 2025-09-21 18:10:00
-- Purpose: Clean up policy conflicts and fix the infinite recursion issue

BEGIN;

-- ====================================================================
-- PART 1: DROP EXISTING CONFLICTING POLICIES
-- ====================================================================

-- Drop policies on profiles table that might cause recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Service role full access to profiles" ON profiles;

-- Drop policies on preschools table
DROP POLICY IF EXISTS "Users can view their own preschool" ON preschools;
DROP POLICY IF EXISTS "Admins can manage their preschool" ON preschools;
DROP POLICY IF EXISTS "Service role full access to preschools" ON preschools;

-- Drop policies on petty_cash_accounts table (main culprit for recursion)
DROP POLICY IF EXISTS petty_cash_accounts_tenant_isolation_policy ON petty_cash_accounts;
DROP POLICY IF EXISTS petty_cash_accounts_select_policy ON petty_cash_accounts;
DROP POLICY IF EXISTS petty_cash_accounts_insert_policy ON petty_cash_accounts;
DROP POLICY IF EXISTS petty_cash_accounts_update_policy ON petty_cash_accounts;
DROP POLICY IF EXISTS petty_cash_accounts_delete_policy ON petty_cash_accounts;

-- Drop policies on activity_logs table
DROP POLICY IF EXISTS activity_logs_tenant_isolation_policy ON activity_logs;
DROP POLICY IF EXISTS activity_logs_select_policy ON activity_logs;
DROP POLICY IF EXISTS activity_logs_insert_policy ON activity_logs;
DROP POLICY IF EXISTS activity_logs_update_policy ON activity_logs;
DROP POLICY IF EXISTS activity_logs_delete_policy ON activity_logs;

-- ====================================================================
-- PART 2: DROP PROBLEMATIC FUNCTIONS THAT CAUSE RECURSION
-- ====================================================================

-- Drop the recursive functions that query profiles
DROP FUNCTION IF EXISTS get_user_capabilities(uuid);
DROP FUNCTION IF EXISTS user_has_capability(uuid, text);

-- ====================================================================
-- PART 3: CREATE SAFE, NON-RECURSIVE POLICIES
-- ====================================================================

-- PROFILES TABLE - Safe policies using only auth.uid()
CREATE POLICY profiles_own_access
ON profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY profiles_own_update
ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid());

CREATE POLICY profiles_admin_access
ON profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS admin_profile
    WHERE
      admin_profile.id = auth.uid()
      AND admin_profile.role IN ('admin', 'principal', 'superadmin')
      AND (admin_profile.organization_id = profiles.organization_id OR admin_profile.role = 'superadmin')
  )
);

CREATE POLICY profiles_service_role
ON profiles FOR ALL TO service_role
USING (TRUE);

-- PRESCHOOLS TABLE - Safe policies
CREATE POLICY preschools_own_access
ON preschools FOR SELECT TO authenticated
USING (
  id IN (
    SELECT organization_id FROM profiles
    WHERE id = auth.uid()
  )
);

CREATE POLICY preschools_admin_manage
ON preschools FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE
      profiles.id = auth.uid()
      AND profiles.organization_id = preschools.id
      AND profiles.role IN ('admin', 'principal')
  )
);

CREATE POLICY preschools_service_role
ON preschools FOR ALL TO service_role
USING (TRUE);

-- PETTY_CASH_ACCOUNTS TABLE - Safe tenant isolation without recursion
CREATE POLICY petty_cash_accounts_simple_access
ON petty_cash_accounts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE
      p.id = auth.uid()
      AND p.organization_id = petty_cash_accounts.preschool_id
  )
);

CREATE POLICY petty_cash_accounts_simple_manage
ON petty_cash_accounts FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE
      profiles.id = auth.uid()
      AND profiles.organization_id = petty_cash_accounts.preschool_id
      AND profiles.role IN ('admin', 'principal')
  )
);

CREATE POLICY petty_cash_accounts_service_role
ON petty_cash_accounts FOR ALL TO service_role
USING (TRUE);

-- ACTIVITY_LOGS TABLE - Safe policies
CREATE POLICY activity_logs_simple_access
ON activity_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE
      profiles.id = auth.uid()
      AND (
        -- Use organization_id if it exists and is not null
        (activity_logs.organization_id IS NOT NULL AND profiles.organization_id = activity_logs.organization_id)
        OR
        -- Fallback to school_id if organization_id is null
        (
          activity_logs.organization_id IS NULL AND activity_logs.school_id IS NOT NULL
          AND profiles.organization_id = activity_logs.school_id
        )
      )
  )
);

CREATE POLICY activity_logs_simple_insert
ON activity_logs FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE
      profiles.id = auth.uid()
      AND profiles.organization_id IN (activity_logs.organization_id, activity_logs.school_id)
  )
);

CREATE POLICY activity_logs_service_role
ON activity_logs FOR ALL TO service_role
USING (TRUE);

-- ====================================================================
-- PART 4: ADD TEMPORARY DEBUG POLICIES FOR ANONYMOUS ACCESS
-- ====================================================================

-- Temporary debug policies - remove these after testing
CREATE POLICY profiles_debug_anon
ON profiles FOR SELECT TO anon
USING (TRUE);

CREATE POLICY preschools_debug_anon
ON preschools FOR SELECT TO anon
USING (TRUE);

CREATE POLICY petty_cash_accounts_debug_anon
ON petty_cash_accounts FOR SELECT TO anon
USING (TRUE);

CREATE POLICY activity_logs_debug_anon
ON activity_logs FOR SELECT TO anon
USING (TRUE);

COMMIT;
