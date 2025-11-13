-- Quick fix: Link approved guardian requests to students
-- Run this directly in Supabase SQL Editor

-- Create trigger function
CREATE OR REPLACE FUNCTION public.link_student_on_guardian_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_internal_id uuid;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get parent's internal ID from users table
    -- guardian_requests.parent_auth_id is the auth.users.id
    -- We need users.id which is the internal ID that students.parent_id references
    SELECT id INTO v_parent_internal_id
    FROM public.users
    WHERE auth_user_id = NEW.parent_auth_id;
    
    IF v_parent_internal_id IS NOT NULL THEN
      -- Update student's parent_id with the internal users.id
      UPDATE public.students
      SET parent_id = v_parent_internal_id,
          updated_at = now()
      WHERE id = NEW.student_id
        AND (parent_id IS NULL OR parent_id != v_parent_internal_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS auto_link_student_on_approval ON public.guardian_requests;
CREATE TRIGGER auto_link_student_on_approval
AFTER UPDATE OF status
ON public.guardian_requests
FOR EACH ROW
WHEN (NEW.status = 'approved')
EXECUTE FUNCTION public.link_student_on_guardian_approval();

-- Backfill existing approved requests
DO $$
DECLARE
  v_request RECORD;
  v_parent_internal_id uuid;
  v_fixed_count INTEGER := 0;
BEGIN
  FOR v_request IN 
    SELECT gr.id, gr.parent_auth_id, gr.student_id
    FROM public.guardian_requests gr
    LEFT JOIN public.users u ON u.auth_user_id = gr.parent_auth_id
    LEFT JOIN public.students s ON s.id = gr.student_id AND s.parent_id = u.id
    WHERE gr.status = 'approved'
      AND u.id IS NOT NULL  -- Parent exists in users table
      AND s.id IS NULL      -- Not already linked
  LOOP
    -- Get parent's internal ID from users table
    SELECT id INTO v_parent_internal_id
    FROM public.users
    WHERE auth_user_id = v_request.parent_auth_id;
    
    IF v_parent_internal_id IS NOT NULL THEN
      UPDATE public.students
      SET parent_id = v_parent_internal_id,
          updated_at = now()
      WHERE id = v_request.student_id;
      
      v_fixed_count := v_fixed_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Fixed % approved guardian requests', v_fixed_count;
END $$;
