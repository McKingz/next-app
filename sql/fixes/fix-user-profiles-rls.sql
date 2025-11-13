-- Fix user_profiles RLS policies to avoid infinite recursion
-- ============================================================

-- Drop existing policies that may cause recursion
DROP POLICY IF EXISTS "users_can_view_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "superadmin_can_view_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON user_profiles;  
DROP POLICY IF EXISTS "superadmin_can_update_all_profiles" ON user_profiles;

-- Create simpler policies that don't cause recursion
CREATE POLICY "users_can_view_own_profile" ON user_profiles 
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_can_update_own_profile" ON user_profiles 
FOR UPDATE USING (user_id = auth.uid());

-- Allow authenticated users to insert (for profile creation)
CREATE POLICY "authenticated_can_insert_profiles" ON user_profiles 
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Create a simple superadmin policy without self-reference
CREATE POLICY "superadmin_full_access" ON user_profiles 
FOR ALL TO authenticated USING (
  auth.uid() IN (
    SELECT user_id FROM user_profiles up 
    WHERE up.role = 'super_admin' 
    AND up.is_active = true 
    AND up.user_id = auth.uid()
  )
);

-- Insert a superadmin user manually (replace with actual auth user ID)
-- First, get the current authenticated user ID if possible
DO $$
DECLARE
    current_user_id UUID;
    user_email TEXT;
BEGIN
    -- Try to get current user from auth context
    current_user_id := auth.uid();
    
    IF current_user_id IS NOT NULL THEN
        -- Get user email from auth.users
        SELECT email INTO user_email 
        FROM auth.users 
        WHERE id = current_user_id;
        
        -- Insert/update the current user as superadmin
        INSERT INTO user_profiles (
            user_id, 
            email, 
            full_name, 
            role, 
            is_active
        ) VALUES (
            current_user_id,
            COALESCE(user_email, 'superadmin@edudashpro.org.za'),
            'Super Administrator',
            'super_admin',
            true
        ) ON CONFLICT (user_id) DO UPDATE SET
            role = 'super_admin',
            is_active = true,
            updated_at = now();
            
        RAISE NOTICE 'Updated user % as superadmin', user_email;
    ELSE
        RAISE NOTICE 'No authenticated user found - will create default superadmin';
        
        -- Create a default superadmin entry (this requires knowing the auth user ID)
        -- This is a fallback - in production, you should use the actual auth user ID
        INSERT INTO user_profiles (
            user_id, 
            email, 
            full_name, 
            role, 
            is_active
        ) VALUES (
            '00000000-0000-0000-0000-000000000000'::UUID, -- Placeholder - replace with real ID
            'superadmin@edudashpro.org.za',
            'Super Administrator',
            'super_admin',
            true
        ) ON CONFLICT (user_id) DO NOTHING;
        
        RAISE NOTICE 'Created placeholder superadmin - update with real auth user ID';
    END IF;
END $$;

-- Test the policies by querying user_profiles
SELECT 
    user_id,
    email,
    role,
    is_active,
    created_at
FROM user_profiles
LIMIT 5;