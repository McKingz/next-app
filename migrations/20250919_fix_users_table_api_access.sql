-- Fix Users Table API Access Migration
-- Date: 2025-09-19
-- Purpose: Fix users table schema and RLS policies for API access
-- WARP.md Compliance: Add missing columns and proper security

BEGIN;

-- ============================================================================
-- PART 1: ADD MISSING COLUMNS TO USERS TABLE
-- ============================================================================

-- Add missing columns that the API expects
DO $fix_users_schema$
BEGIN
    -- Add auth_user_id column for linking to auth.users
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'auth_user_id' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD COLUMN auth_user_id uuid REFERENCES auth.users(id);
        RAISE NOTICE 'Added auth_user_id column to users table';
    END IF;

    -- Add avatar_url column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'avatar_url' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD COLUMN avatar_url text;
        RAISE NOTICE 'Added avatar_url column to users table';
    END IF;

    -- Add last_login_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'last_login_at' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD COLUMN last_login_at timestamptz;
        RAISE NOTICE 'Added last_login_at column to users table';
    END IF;

    -- Add preschool_id column (alias for organization_id) if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'preschool_id' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD COLUMN preschool_id uuid REFERENCES preschools(id);
        
        -- Copy data from organization_id to preschool_id
        UPDATE public.users SET preschool_id = organization_id WHERE organization_id IS NOT NULL;
        
        RAISE NOTICE 'Added preschool_id column to users table and copied data from organization_id';
    END IF;

    -- Add is_active column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_active' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD COLUMN is_active boolean DEFAULT true;
        RAISE NOTICE 'Added is_active column to users table';
    END IF;

    -- Add name column (full name field often used in queries)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'name' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users ADD COLUMN name text;
        
        -- Generate name from first_name and last_name
        UPDATE public.users 
        SET name = TRIM(CONCAT(first_name, ' ', last_name)) 
        WHERE first_name IS NOT NULL OR last_name IS NOT NULL;
        
        RAISE NOTICE 'Added name column to users table and populated from existing data';
    END IF;
END
$fix_users_schema$;

-- ============================================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on auth_user_id for fast lookups from auth system
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth_user_id
ON public.users (auth_user_id);

-- Index on preschool_id for tenant isolation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preschool_id
ON public.users (preschool_id);

-- Index on email for unique lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
ON public.users (email);

-- Composite index for active users in a preschool
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preschool_active
ON public.users (preschool_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- PART 3: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS users_select_own_data ON public.users;
DROP POLICY IF EXISTS users_select_same_preschool ON public.users;
DROP POLICY IF EXISTS users_insert_own_profile ON public.users;
DROP POLICY IF EXISTS users_update_own_profile ON public.users;

-- Policy 1: Users can select their own data
CREATE POLICY users_select_own_data
ON public.users FOR SELECT
USING (auth_user_id = auth.uid());

-- Policy 2: Users can select other users in the same preschool (for teachers, principals)
CREATE POLICY users_select_same_preschool
ON public.users FOR SELECT
USING (
  preschool_id = (
    SELECT u.preschool_id
    FROM public.users AS u
    WHERE u.auth_user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.users AS u2
    WHERE
      u2.auth_user_id = auth.uid()
      AND u2.role IN ('teacher', 'principal', 'principal_admin', 'super_admin')
  )
);

-- Policy 3: Users can insert their own profile during signup
CREATE POLICY users_insert_own_profile
ON public.users FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

-- Policy 4: Users can update their own profile
CREATE POLICY users_update_own_profile
ON public.users FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- Policy 5: Principals can update users in their preschool
CREATE POLICY users_principal_update
ON public.users FOR UPDATE
USING (
  preschool_id = (
    SELECT u.preschool_id
    FROM public.users AS u
    WHERE u.auth_user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.users AS u2
    WHERE
      u2.auth_user_id = auth.uid()
      AND u2.role IN ('principal', 'principal_admin')
  )
)
WITH CHECK (
  preschool_id = (
    SELECT u.preschool_id
    FROM public.users AS u
    WHERE u.auth_user_id = auth.uid()
  )
);

-- ============================================================================
-- PART 4: CREATE HELPER FUNCTIONS FOR USER MANAGEMENT
-- ============================================================================

-- Function to get current user's preschool_id
CREATE OR REPLACE FUNCTION public.current_user_preschool_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT preschool_id 
    FROM public.users 
    WHERE auth_user_id = auth.uid() 
    LIMIT 1;
$$;

-- Function to get current user's full profile
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  name text,
  role text,
  preschool_id uuid,
  organization_id uuid,
  avatar_url text,
  is_active boolean,
  last_login_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.name,
        u.role,
        u.preschool_id,
        u.organization_id,
        u.avatar_url,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.updated_at
    FROM public.users u
    WHERE u.auth_user_id = auth.uid()
    AND u.is_active = true;
$$;

-- Function to update last login timestamp
CREATE OR REPLACE FUNCTION public.update_user_last_login()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE public.users 
    SET last_login_at = NOW() 
    WHERE auth_user_id = auth.uid();
$$;

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================================

-- Grant basic permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT USAGE ON SEQUENCE users_id_seq TO authenticated; -- if sequence exists
GRANT EXECUTE ON FUNCTION public.current_user_preschool_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_last_login() TO authenticated;

-- ============================================================================
-- PART 6: CREATE TRIGGER FOR AUTOMATIC PROFILE CREATION
-- ============================================================================

-- Function to create user profile when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert new user record linked to auth.users
    INSERT INTO public.users (
        auth_user_id,
        id,
        email,
        name,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        true,
        NOW(),
        NOW()
    );
    
    RETURN NEW;
END;
$$;

-- Create trigger to automatically create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PART 7: VERIFICATION AND LOGGING
-- ============================================================================

-- Function to verify users table structure
CREATE OR REPLACE FUNCTION public.verify_users_table_structure()
RETURNS TABLE (
  column_name text,
  data_type text,
  is_nullable text,
  column_default text
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        c.column_name::text,
        c.data_type::text,
        c.is_nullable::text,
        c.column_default::text
    FROM information_schema.columns c
    WHERE c.table_name = 'users' 
    AND c.table_schema = 'public'
    ORDER BY c.ordinal_position;
$$;

-- Log completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'users_table_fixed_20250919',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::text,
    'columns_added', ARRAY[
      'auth_user_id',
      'avatar_url',
      'last_login_at',
      'preschool_id',
      'is_active',
      'name'
    ],
    'policies_created', 5,
    'functions_created', 4
  ),
  'Users table schema and RLS fixes completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

-- Final verification
SELECT 'USERS TABLE SCHEMA FIXED' AS status;
SELECT * FROM verify_users_table_structure();

COMMIT;
