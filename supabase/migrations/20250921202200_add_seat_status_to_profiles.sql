-- Migration: Add seat_status column to profiles table
-- Created: 2025-09-21 20:22:00
-- Purpose: Add seat_status column to track teacher seat assignment status

-- ====================================================================
-- ADD SEAT_STATUS COLUMN
-- ====================================================================

-- Add seat_status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'seat_status'
    ) THEN
        ALTER TABLE public.profiles 
        ADD COLUMN seat_status text DEFAULT 'inactive';
        
        -- Add check constraint for valid values
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_seat_status_check 
        CHECK (seat_status IN ('active', 'pending', 'inactive'));
        
        RAISE NOTICE 'Added seat_status column to profiles table';
    ELSE
        RAISE NOTICE 'seat_status column already exists';
    END IF;
END
$$;

-- ====================================================================
-- UPDATE EXISTING TEACHER PROFILES BASED ON CURRENT SEATS
-- ====================================================================

-- Set seat_status to 'active' for teachers with active seats
UPDATE public.profiles p
SET seat_status = 'active'
WHERE
  p.role = 'teacher'
  AND EXISTS (
    SELECT 1
    FROM public.subscription_seats AS ss
    INNER JOIN public.users AS u ON ss.user_id = u.id
    WHERE
      u.auth_user_id = p.id
      AND ss.revoked_at IS NULL
  );

-- Set seat_status to 'inactive' for teachers without active seats
UPDATE public.profiles p
SET seat_status = 'inactive'
WHERE
  p.role = 'teacher'
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscription_seats AS ss
    INNER JOIN public.users AS u ON ss.user_id = u.id
    WHERE
      u.auth_user_id = p.id
      AND ss.revoked_at IS NULL
  );

-- ====================================================================
-- CREATE TRIGGER TO KEEP SEAT_STATUS IN SYNC
-- ====================================================================

-- Create function to sync profile seat_status when seats change
CREATE OR REPLACE FUNCTION public.sync_profile_seat_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id uuid;
  v_role text;
BEGIN
  -- Get auth_user_id for the affected seat
  SELECT u.auth_user_id, p.role 
  INTO v_auth_user_id, v_role
  FROM public.users u
  LEFT JOIN public.profiles p ON p.id = u.auth_user_id
  WHERE u.id = COALESCE(NEW.user_id, OLD.user_id);
  
  -- Only update if it's a teacher
  IF v_role != 'teacher' OR v_auth_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Update profile seat_status based on operation
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.revoked_at IS NULL) THEN
    -- Seat assigned or reactivated
    UPDATE public.profiles
    SET seat_status = 'active'
    WHERE id = v_auth_user_id;
  ELSIF (TG_OP = 'UPDATE' AND NEW.revoked_at IS NOT NULL) OR TG_OP = 'DELETE' THEN
    -- Seat revoked or deleted - check if they have any other active seats
    IF NOT EXISTS (
      SELECT 1 
      FROM public.subscription_seats ss2
      JOIN public.users u2 ON u2.id = ss2.user_id
      WHERE u2.auth_user_id = v_auth_user_id
        AND ss2.revoked_at IS NULL
        AND ss2.id != COALESCE(NEW.id, OLD.id)
    ) THEN
      UPDATE public.profiles
      SET seat_status = 'inactive'
      WHERE id = v_auth_user_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS sync_profile_seat_status_trigger ON public.subscription_seats;

-- Create trigger to sync seat status on seat changes
CREATE TRIGGER sync_profile_seat_status_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.subscription_seats
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_seat_status();

-- ====================================================================
-- CREATE INDEX FOR PERFORMANCE
-- ====================================================================

-- Add index on seat_status for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_seat_status
ON public.profiles (seat_status)
WHERE role = 'teacher';

-- ====================================================================
-- ADD HELPER FUNCTIONS
-- ====================================================================

-- Function to check if a user has an active seat
CREATE OR REPLACE FUNCTION public.user_has_active_seat(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.subscription_seats ss
    JOIN public.users u ON u.id = ss.user_id
    WHERE u.auth_user_id = p_user_id
      AND ss.revoked_at IS NULL
  );
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.user_has_active_seat(uuid) TO authenticated;

-- ====================================================================
-- MIGRATION LOG
-- ====================================================================

INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'add_seat_status_to_profiles_20250921',
  jsonb_build_object(
    'completed_at', now(),
    'changes_made', ARRAY[
      'Added seat_status column to profiles table',
      'Added check constraint for valid seat_status values',
      'Updated existing teacher profiles with current seat status',
      'Created sync_profile_seat_status trigger',
      'Added idx_profiles_seat_status index',
      'Created user_has_active_seat helper function'
    ],
    'purpose', 'Track teacher seat assignment status directly in profiles table for better performance and reliability'
  ),
  'Added seat_status column to profiles table',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

-- ====================================================================
-- SUCCESS MESSAGE
-- ====================================================================

SELECT 'PROFILES SEAT_STATUS COLUMN ADDED - Teachers seat status now tracked in profiles' AS status;
