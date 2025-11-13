-- Migration: Auto-link parent to school when child is claimed
-- Date: 2025-10-25
-- Purpose: Ensure parents automatically inherit preschool_id when linking to a child
-- This solves the issue where parents lose school linkage after profile updates

BEGIN;

-- ============================================================================
-- PART 1: Trigger to auto-link parent to school when students table is updated
-- ============================================================================

-- Function: Sync parent preschool_id when student's parent_id or guardian_id is set
CREATE OR REPLACE FUNCTION public.sync_parent_preschool_from_student()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_preschool_id uuid;
  v_parent_id uuid;
  v_guardian_id uuid;
BEGIN
  -- Get the student's preschool_id
  v_student_preschool_id := NEW.preschool_id;
  
  -- Get parent and guardian IDs
  v_parent_id := NEW.parent_id;
  v_guardian_id := NEW.guardian_id;
  
  -- If parent_id is set and student has a preschool, update parent's preschool_id
  IF v_parent_id IS NOT NULL AND v_student_preschool_id IS NOT NULL THEN
    -- Update profiles table (primary)
    UPDATE public.profiles
    SET preschool_id = v_student_preschool_id,
        organization_id = v_student_preschool_id,
        updated_at = now()
    WHERE id = v_parent_id
      AND role = 'parent'
      AND (preschool_id IS NULL OR preschool_id != v_student_preschool_id);
    
    -- Update users table (legacy, for backward compatibility)
    UPDATE public.users
    SET preschool_id = v_student_preschool_id,
        organization_id = v_student_preschool_id,
        updated_at = now()
    WHERE auth_user_id = v_parent_id
      AND role = 'parent'
      AND (preschool_id IS NULL OR preschool_id != v_student_preschool_id);
  END IF;
  
  -- If guardian_id is set and student has a preschool, update guardian's preschool_id
  IF v_guardian_id IS NOT NULL AND v_student_preschool_id IS NOT NULL THEN
    -- Update profiles table (primary)
    UPDATE public.profiles
    SET preschool_id = v_student_preschool_id,
        organization_id = v_student_preschool_id,
        updated_at = now()
    WHERE id = v_guardian_id
      AND role = 'parent'
      AND (preschool_id IS NULL OR preschool_id != v_student_preschool_id);
    
    -- Update users table (legacy, for backward compatibility)
    UPDATE public.users
    SET preschool_id = v_student_preschool_id,
        organization_id = v_student_preschool_id,
        updated_at = now()
    WHERE auth_user_id = v_guardian_id
      AND role = 'parent'
      AND (preschool_id IS NULL OR preschool_id != v_student_preschool_id);
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_parent_preschool_from_student() IS 
'Automatically sync parent/guardian preschool_id from student when parent_id or guardian_id is set. 
This ensures parents are always linked to the correct school via their children.';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_parent_preschool_on_student_update ON public.students;

-- Create trigger on students table
CREATE TRIGGER sync_parent_preschool_on_student_update
AFTER INSERT OR UPDATE OF parent_id, guardian_id, preschool_id
ON public.students
FOR EACH ROW
WHEN (NEW.parent_id IS NOT NULL OR NEW.guardian_id IS NOT NULL)
EXECUTE FUNCTION public.sync_parent_preschool_from_student();

-- ============================================================================
-- PART 2: Restore broken parent-school linkages (one-time fix)
-- ============================================================================

-- Fix parents who lost preschool_id but have children linked
DO $$
DECLARE
  v_fixed_count INTEGER := 0;
BEGIN
  -- Update parents in profiles table who have children but missing preschool_id
  WITH parent_preschool_mapping AS (
    SELECT DISTINCT 
      s.parent_id as profile_id,
      s.preschool_id
    FROM public.students s
    WHERE s.parent_id IS NOT NULL 
      AND s.preschool_id IS NOT NULL
      AND s.is_active = true
  )
  UPDATE public.profiles p
  SET preschool_id = ppm.preschool_id,
      organization_id = ppm.preschool_id,
      updated_at = now()
  FROM parent_preschool_mapping ppm
  WHERE p.id = ppm.profile_id
    AND p.role = 'parent'
    AND (p.preschool_id IS NULL OR p.preschool_id != ppm.preschool_id);
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % parent profiles with missing preschool_id', v_fixed_count;
  
  -- Update guardians in profiles table who have children but missing preschool_id
  WITH guardian_preschool_mapping AS (
    SELECT DISTINCT 
      s.guardian_id as profile_id,
      s.preschool_id
    FROM public.students s
    WHERE s.guardian_id IS NOT NULL 
      AND s.preschool_id IS NOT NULL
      AND s.is_active = true
  )
  UPDATE public.profiles p
  SET preschool_id = gpm.preschool_id,
      organization_id = gpm.preschool_id,
      updated_at = now()
  FROM guardian_preschool_mapping gpm
  WHERE p.id = gpm.profile_id
    AND p.role = 'parent'
    AND (p.preschool_id IS NULL OR p.preschool_id != gpm.preschool_id);
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % guardian profiles with missing preschool_id', v_fixed_count;
  
  -- Also fix users table (legacy)
  WITH parent_preschool_mapping AS (
    SELECT DISTINCT 
      s.parent_id as profile_id,
      s.preschool_id
    FROM public.students s
    WHERE s.parent_id IS NOT NULL 
      AND s.preschool_id IS NOT NULL
      AND s.is_active = true
  )
  UPDATE public.users u
  SET preschool_id = ppm.preschool_id,
      organization_id = ppm.preschool_id,
      updated_at = now()
  FROM parent_preschool_mapping ppm
  WHERE u.auth_user_id = ppm.profile_id
    AND u.role = 'parent'
    AND (u.preschool_id IS NULL OR u.preschool_id != ppm.preschool_id);
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % parent users with missing preschool_id', v_fixed_count;
END $$;

-- ============================================================================
-- PART 3: Validation and reporting
-- ============================================================================

DO $$
DECLARE
  v_total_parents INTEGER;
  v_linked_parents INTEGER;
  v_unlinked_parents INTEGER;
  v_parents_with_children INTEGER;
BEGIN
  -- Count total parents
  SELECT COUNT(*) INTO v_total_parents
  FROM public.profiles
  WHERE role = 'parent';
  
  -- Count parents with preschool linkage
  SELECT COUNT(*) INTO v_linked_parents
  FROM public.profiles
  WHERE role = 'parent' AND preschool_id IS NOT NULL;
  
  -- Count parents with children
  SELECT COUNT(DISTINCT parent_id) INTO v_parents_with_children
  FROM public.students
  WHERE parent_id IS NOT NULL AND is_active = true;
  
  v_unlinked_parents := v_total_parents - v_linked_parents;
  
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Parent-School Linkage Status:';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Total parents: %', v_total_parents;
  RAISE NOTICE 'Parents linked to schools: %', v_linked_parents;
  RAISE NOTICE 'Parents WITHOUT school linkage: %', v_unlinked_parents;
  RAISE NOTICE 'Parents with children: %', v_parents_with_children;
  RAISE NOTICE '==============================================';
  
  IF v_unlinked_parents > 0 THEN
    RAISE NOTICE 'WARNING: % parents are not linked to any school', v_unlinked_parents;
  ELSE
    RAISE NOTICE 'SUCCESS: All parents are properly linked to schools';
  END IF;
END $$;

COMMIT;
