-- Complete Users Table Fix Migration
-- Date: 2025-09-19
-- Purpose: Add ALL missing columns to users table for full API compatibility
-- WARP.md Compliance: Add missing columns and proper security

BEGIN;

-- ============================================================================
-- PART 1: ADD ALL MISSING COLUMNS TO USERS TABLE
-- ============================================================================

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

  -- Add name column (full name field)
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

  -- Add phone column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'phone' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN phone text;
    RAISE NOTICE 'Added phone column to users table';
  END IF;

  -- Add address columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'home_address' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN home_address text;
    RAISE NOTICE 'Added home_address column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'home_city' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN home_city text;
    RAISE NOTICE 'Added home_city column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'home_postal_code' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN home_postal_code text;
    RAISE NOTICE 'Added home_postal_code column to users table';
  END IF;

  -- Add work-related columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'work_company' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN work_company text;
    RAISE NOTICE 'Added work_company column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'work_position' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN work_position text;
    RAISE NOTICE 'Added work_position column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'work_address' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN work_address text;
    RAISE NOTICE 'Added work_address column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'work_phone' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN work_phone text;
    RAISE NOTICE 'Added work_phone column to users table';
  END IF;

  -- Add emergency contact columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'emergency_contact_1_name' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN emergency_contact_1_name text;
    RAISE NOTICE 'Added emergency_contact_1_name column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'emergency_contact_1_phone' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN emergency_contact_1_phone text;
    RAISE NOTICE 'Added emergency_contact_1_phone column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'emergency_contact_1_relationship' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN emergency_contact_1_relationship text;
    RAISE NOTICE 'Added emergency_contact_1_relationship column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'emergency_contact_2_name' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN emergency_contact_2_name text;
    RAISE NOTICE 'Added emergency_contact_2_name column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'emergency_contact_2_phone' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN emergency_contact_2_phone text;
    RAISE NOTICE 'Added emergency_contact_2_phone column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'emergency_contact_2_relationship' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN emergency_contact_2_relationship text;
    RAISE NOTICE 'Added emergency_contact_2_relationship column to users table';
  END IF;

  -- Add child-related columns for parents
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'relationship_to_child' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN relationship_to_child text;
    RAISE NOTICE 'Added relationship_to_child column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'pickup_authorized' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN pickup_authorized boolean DEFAULT true;
    RAISE NOTICE 'Added pickup_authorized column to users table';
  END IF;

  -- Add profile completion tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'profile_completed_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN profile_completed_at timestamptz;
    RAISE NOTICE 'Added profile_completed_at column to users table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'profile_completion_status' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN profile_completion_status text DEFAULT 'incomplete';
    RAISE NOTICE 'Added profile_completion_status column to users table';
  END IF;

  -- Add AI credits column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'ai_credits_remaining' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.users ADD COLUMN ai_credits_remaining integer DEFAULT 0;
    RAISE NOTICE 'Added ai_credits_remaining column to users table';
  END IF;

END
$fix_users_schema$;

-- ============================================================================
-- PART 2: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth_user_id
ON public.users (auth_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preschool_id
ON public.users (preschool_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
ON public.users (email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_preschool_active
ON public.users (preschool_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- PART 3: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS users_select_own_data ON public.users;
DROP POLICY IF EXISTS users_select_same_preschool ON public.users;
DROP POLICY IF EXISTS users_insert_own_profile ON public.users;
DROP POLICY IF EXISTS users_update_own_profile ON public.users;
DROP POLICY IF EXISTS users_principal_update ON public.users;

-- Policy 1: Users can select their own data
CREATE POLICY users_select_own_data
ON public.users FOR SELECT
USING (auth_user_id = auth.uid());

-- Policy 2: Users can select other users in same preschool (for staff)
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
-- PART 4: HELPER FUNCTIONS
-- ============================================================================

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

-- ============================================================================
-- PART 5: GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_preschool_id() TO authenticated;

-- ============================================================================
-- PART 6: TRIGGER FOR AUTO PROFILE CREATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    now(),
    now()
  );
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PART 7: VERIFICATION AND LOGGING
-- ============================================================================

INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'complete_users_table_fixed_20250919',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::text,
    'columns_added', ARRAY[
      'auth_user_id', 'avatar_url', 'last_login_at', 'preschool_id',
      'is_active', 'name', 'phone', 'home_address', 'home_city',
      'home_postal_code', 'work_company', 'work_position', 'work_address',
      'work_phone', 'emergency_contact_1_name', 'emergency_contact_1_phone',
      'emergency_contact_1_relationship', 'emergency_contact_2_name',
      'emergency_contact_2_phone', 'emergency_contact_2_relationship',
      'relationship_to_child', 'pickup_authorized', 'profile_completed_at',
      'profile_completion_status', 'ai_credits_remaining'
    ],
    'total_columns_added', 25
  ),
  'Complete users table schema fix completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'COMPLETE USERS TABLE SCHEMA FIXED' AS status;

COMMIT;
