-- Migration: Auto-link student to parent when guardian request is approved
-- Date: 2025-10-29 14:35:00
-- Purpose: Fix the missing student-parent linkage when guardian requests are approved
-- This ensures approved requests actually create the parent-child relationship

BEGIN;

-- ============================================================================
-- PART 1: Create trigger function to link student when request is approved
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_student_on_guardian_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_profile_id uuid;
  v_student_id uuid;
  v_relationship text;
BEGIN
  -- Only proceed if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    v_student_id := NEW.student_id;
    v_relationship := NEW.relationship;
    
    -- Get the parent's internal profile ID from auth_user_id
    -- First try profiles table (primary source)
    SELECT id INTO v_parent_profile_id
    FROM public.profiles
    WHERE id = NEW.parent_auth_id
    LIMIT 1;
    
    -- If not found in profiles, try users table (legacy)
    IF v_parent_profile_id IS NULL THEN
      SELECT id INTO v_parent_profile_id
      FROM public.users
      WHERE auth_user_id = NEW.parent_auth_id
      LIMIT 1;
    END IF;
    
    -- If we found the parent profile, link to student
    IF v_parent_profile_id IS NOT NULL AND v_student_id IS NOT NULL THEN
      
      -- Determine if this should be parent_id or guardian_id
      -- If relationship is 'mother' or 'father', set as parent_id
      -- Otherwise set as guardian_id
      IF v_relationship IN ('mother', 'father') THEN
        -- Update student's parent_id
        UPDATE public.students
        SET parent_id = v_parent_profile_id,
            updated_at = now()
        WHERE id = v_student_id;
        
        RAISE NOTICE 'Linked student % to parent % (parent_id)', v_student_id, v_parent_profile_id;
      ELSE
        -- Check if parent_id is already set
        DECLARE
          v_existing_parent_id uuid;
        BEGIN
          SELECT parent_id INTO v_existing_parent_id
          FROM public.students
          WHERE id = v_student_id;
          
          -- If parent_id is empty, use it; otherwise use guardian_id
          IF v_existing_parent_id IS NULL THEN
            UPDATE public.students
            SET parent_id = v_parent_profile_id,
                updated_at = now()
            WHERE id = v_student_id;
            
            RAISE NOTICE 'Linked student % to parent % (parent_id, no existing parent)', v_student_id, v_parent_profile_id;
          ELSE
            -- Set as guardian since parent_id is occupied
            UPDATE public.students
            SET guardian_id = v_parent_profile_id,
                updated_at = now()
            WHERE id = v_student_id;
            
            RAISE NOTICE 'Linked student % to guardian % (guardian_id)', v_student_id, v_parent_profile_id;
          END IF;
        END;
      END IF;
      
      -- The sync_parent_preschool_from_student trigger will now fire automatically
      -- to update the parent's preschool_id
      
    ELSE
      RAISE WARNING 'Could not link student % - parent profile not found for auth_id %', v_student_id, NEW.parent_auth_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.link_student_on_guardian_approval() IS 
'Automatically links student to parent/guardian when a guardian_request is approved. 
Uses relationship field to determine parent_id vs guardian_id assignment.';

-- ============================================================================
-- PART 2: Create trigger on guardian_requests table
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_link_student_on_approval ON public.guardian_requests;

-- Create trigger that fires when guardian_requests status is updated
CREATE TRIGGER auto_link_student_on_approval
AFTER UPDATE OF status
ON public.guardian_requests
FOR EACH ROW
WHEN (NEW.status = 'approved')
EXECUTE FUNCTION public.link_student_on_guardian_approval();

-- ============================================================================
-- PART 3: Backfill existing approved requests that weren't linked
-- ============================================================================

-- Find and fix approved requests that don't have linked students
DO $$
DECLARE
  v_request RECORD;
  v_parent_profile_id uuid;
  v_existing_parent_id uuid;
  v_fixed_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Backfilling approved guardian requests...';
  
  FOR v_request IN 
    SELECT gr.id, gr.parent_auth_id, gr.student_id, gr.relationship
    FROM public.guardian_requests gr
    WHERE gr.status = 'approved'
    ORDER BY gr.approved_at DESC
  LOOP
    -- Get parent profile ID
    SELECT id INTO v_parent_profile_id
    FROM public.profiles
    WHERE id = v_request.parent_auth_id
    LIMIT 1;
    
    IF v_parent_profile_id IS NULL THEN
      SELECT id INTO v_parent_profile_id
      FROM public.users
      WHERE auth_user_id = v_request.parent_auth_id
      LIMIT 1;
    END IF;
    
    IF v_parent_profile_id IS NOT NULL THEN
      -- Check if student is already linked to this parent
      SELECT parent_id INTO v_existing_parent_id
      FROM public.students
      WHERE id = v_request.student_id;
      
      -- Only update if not already linked
      IF v_existing_parent_id IS NULL OR v_existing_parent_id != v_parent_profile_id THEN
        
        -- Determine parent_id vs guardian_id based on relationship
        IF v_request.relationship IN ('mother', 'father') THEN
          UPDATE public.students
          SET parent_id = v_parent_profile_id,
              updated_at = now()
          WHERE id = v_request.student_id;
          
          v_fixed_count := v_fixed_count + 1;
          RAISE NOTICE 'Backfilled: Linked student % to parent % (parent_id)', v_request.student_id, v_parent_profile_id;
        ELSE
          -- Check if parent_id exists
          IF v_existing_parent_id IS NULL THEN
            UPDATE public.students
            SET parent_id = v_parent_profile_id,
                updated_at = now()
            WHERE id = v_request.student_id;
          ELSE
            UPDATE public.students
            SET guardian_id = v_parent_profile_id,
                updated_at = now()
            WHERE id = v_request.student_id
            AND (guardian_id IS NULL OR guardian_id != v_parent_profile_id);
          END IF;
          
          v_fixed_count := v_fixed_count + 1;
          RAISE NOTICE 'Backfilled: Linked student % to guardian %', v_request.student_id, v_parent_profile_id;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Backfill complete: Fixed % approved requests', v_fixed_count;
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- PART 4: Validation
-- ============================================================================

DO $$
DECLARE
  v_total_approved INTEGER;
  v_linked_students INTEGER;
  v_unlinked_requests INTEGER;
BEGIN
  -- Count total approved requests
  SELECT COUNT(*) INTO v_total_approved
  FROM public.guardian_requests
  WHERE status = 'approved';
  
  -- Count how many approved requests have linked students
  SELECT COUNT(DISTINCT gr.id) INTO v_linked_students
  FROM public.guardian_requests gr
  INNER JOIN public.students s ON (s.parent_id = gr.parent_auth_id OR s.guardian_id = gr.parent_auth_id)
  WHERE gr.status = 'approved'
    AND gr.student_id = s.id;
  
  v_unlinked_requests := v_total_approved - v_linked_students;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Guardian Request Linkage Status:';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total approved requests: %', v_total_approved;
  RAISE NOTICE 'Requests with linked students: %', v_linked_students;
  RAISE NOTICE 'Requests WITHOUT linked students: %', v_unlinked_requests;
  RAISE NOTICE '============================================';
  
  IF v_unlinked_requests > 0 THEN
    RAISE WARNING '% approved requests are not linked to students', v_unlinked_requests;
  ELSE
    RAISE NOTICE 'SUCCESS: All approved requests are properly linked';
  END IF;
END $$;

COMMIT;
