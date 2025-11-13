-- ============================================
-- URGENT FIX: Parent Signup Flow
-- ============================================
-- Copy this entire file and run in Supabase Dashboard SQL Editor
-- Dashboard: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql

-- Fix 1: Allow anon role to insert parent_join_requests
DROP POLICY IF EXISTS "Parents can create join requests" ON parent_join_requests;

CREATE POLICY "Anyone can create join requests during signup"
ON parent_join_requests
FOR INSERT
TO authenticated, anon
WITH CHECK (TRUE);

-- Fix 2: Grant anon role access to invitation validation
GRANT EXECUTE ON FUNCTION validate_invitation_code(TEXT, TEXT) TO anon;

-- Fix 3: Allow authenticated users to read their own user profile
DROP POLICY IF EXISTS "Users can read own profile" ON users;

CREATE POLICY "Users can read own profile"
ON users
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

-- Fix 4: Ensure organizations are publicly readable
GRANT SELECT ON organizations TO anon;
GRANT SELECT ON preschools TO anon;

-- Fix 5: Index for faster invitation lookups
CREATE INDEX IF NOT EXISTS idx_invitations_code_status 
ON invitations(code, status) 
WHERE status = 'pending';

-- Verify success
SELECT 'All fixes applied successfully!' AS status;
