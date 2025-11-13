-- Fix parent signup flow issues
-- Date: 2025-10-29
-- Purpose: 
--   1. Fix RLS policy blocking parent_join_requests insert during signup
--   2. Grant anon role access to validate_invitation_code
--   3. Fix users table query issues

-- Step 1: Drop and recreate parent_join_requests INSERT policy to allow anon
DROP POLICY IF EXISTS "Parents can create join requests" ON parent_join_requests;

CREATE POLICY "Anyone can create join requests during signup"
ON parent_join_requests
FOR INSERT
TO authenticated, anon
WITH CHECK (TRUE); -- Allow insert, will be filtered by RLS on SELECT

-- Alternative: More restrictive version (only allow if parent_id matches auth.uid OR anon)
-- WITH CHECK (auth.uid() = parent_id OR auth.role() = 'anon');

-- Step 2: Ensure anon can call validation functions (already in previous migration, but double-check)
GRANT EXECUTE ON FUNCTION validate_invitation_code(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_invitation_code(TEXT) TO anon;

-- Step 3: Fix users table RLS to allow authenticated users to read their own profile
-- Check if policy exists
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Users can read own profile" ON users;
  
  -- Create policy for authenticated users to read their own profile
  CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist, skip
    RAISE NOTICE 'users table does not exist, skipping RLS policy';
END
$$;

-- Step 4: Grant SELECT on organizations to anon (already done, but ensure it's there)
GRANT SELECT ON organizations TO anon;
GRANT SELECT ON preschools TO anon;

-- Step 5: Create index to improve invitation code lookups
CREATE INDEX IF NOT EXISTS idx_invitations_code_status 
ON invitations(code, status) 
WHERE status = 'pending';

-- Log success
SELECT 'Parent signup RLS and functions fixed successfully' AS status;
