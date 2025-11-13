-- Fix Profiles Table RLS Policies
-- This script fixes the 403 Forbidden errors when updating profiles

-- First, let's check the current RLS policies on profiles
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity, forcerowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- Common fix: Allow users to update their own profiles
-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile data" ON public.profiles;

-- Create a comprehensive update policy for profiles
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT 
  USING (auth.uid() = id);

-- Allow service role full access (for admin operations)
DROP POLICY IF EXISTS "Service role has full access" ON public.profiles;
CREATE POLICY "Service role has full access" ON public.profiles
  FOR ALL 
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Allow superadmins and principals to read all profiles in their organization
DROP POLICY IF EXISTS "Admins can view organization profiles" ON public.profiles;
CREATE POLICY "Admins can view organization profiles" ON public.profiles
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.auth_user_id = auth.uid() 
      AND users.role IN ('superadmin', 'principal_admin')
      AND (
        users.role = 'superadmin' OR 
        users.preschool_id = profiles.preschool_id
      )
    )
  );

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure the profiles table has the correct structure
-- Add missing columns that might be expected
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS signature_url text,
ADD COLUMN IF NOT EXISTS signature_public_id text,
ADD COLUMN IF NOT EXISTS signature_updated_at timestamp with time zone;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS profiles_auth_uid_idx ON public.profiles(id);
CREATE INDEX IF NOT EXISTS profiles_preschool_id_idx ON public.profiles(preschool_id);

-- Verify the changes
SELECT 'RLS policies updated successfully for profiles table' as status;