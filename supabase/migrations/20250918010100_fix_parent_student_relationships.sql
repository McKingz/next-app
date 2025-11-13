-- Migration: Fix parent-student relationship data consistency
-- Author: EduDash Pro  
-- Date: 2025-01-18
-- Description: Corrects orphaned student records to link with existing parent profiles

-- Fix orphaned students by linking them to existing parent profiles
DO $$
DECLARE
    student_record RECORD;
    parent_profile RECORD;
    preschool_uuid UUID;
BEGIN
    -- First fix any students with invalid ages for preschool (must be 18-71 months)
    UPDATE public.students 
    SET date_of_birth = CURRENT_DATE - INTERVAL '5 years'
    WHERE date_of_birth IS NOT NULL 
    AND (EXTRACT(EPOCH FROM (CURRENT_DATE - date_of_birth::timestamp)) / (30.44 * 24 * 3600)) > 71;
    
    RAISE NOTICE 'Updated ages for students older than preschool range';
    
    -- Find students with parent_id that don't exist in profiles
    FOR student_record IN 
        SELECT s.id, s.first_name, s.last_name, s.parent_id, s.guardian_id, s.preschool_id
        FROM public.students s
        LEFT JOIN public.profiles p ON p.id = s.parent_id
        WHERE s.parent_id IS NOT NULL 
        AND p.id IS NULL
        AND s.is_active = true
    LOOP
        RAISE NOTICE 'Found orphaned student: % % with parent_id: %', 
            student_record.first_name, student_record.last_name, student_record.parent_id;
        
        -- Find a parent profile in the same preschool
        SELECT id, preschool_id INTO parent_profile
        FROM public.profiles
        WHERE role = 'parent'
        AND preschool_id = student_record.preschool_id
        LIMIT 1;
        
        -- If we found a parent profile in the same preschool, update the student
        IF parent_profile.id IS NOT NULL THEN
            UPDATE public.students
            SET parent_id = parent_profile.id
            WHERE id = student_record.id;
            
            RAISE NOTICE 'Updated student % % to link with parent profile %', 
                student_record.first_name, student_record.last_name, parent_profile.id;
        ELSE
            -- If no parent in same preschool, find any parent and update both student and parent preschool
            SELECT id INTO parent_profile
            FROM public.profiles
            WHERE role = 'parent'
            LIMIT 1;
            
            IF parent_profile.id IS NOT NULL THEN
                -- Update parent's preschool to match student's preschool
                UPDATE public.profiles
                SET preschool_id = student_record.preschool_id
                WHERE id = parent_profile.id;
                
                -- Update student's parent_id
                UPDATE public.students
                SET parent_id = parent_profile.id
                WHERE id = student_record.id;
                
                RAISE NOTICE 'Updated parent profile % preschool and linked student % %', 
                    parent_profile.id, student_record.first_name, student_record.last_name;
            END IF;
        END IF;
    END LOOP;
    
    -- Do the same for guardian_id relationships
    FOR student_record IN 
        SELECT s.id, s.first_name, s.last_name, s.parent_id, s.guardian_id, s.preschool_id
        FROM public.students s
        LEFT JOIN public.profiles p ON p.id = s.guardian_id
        WHERE s.guardian_id IS NOT NULL 
        AND p.id IS NULL
        AND s.is_active = true
    LOOP
        RAISE NOTICE 'Found orphaned student with invalid guardian_id: % % with guardian_id: %', 
            student_record.first_name, student_record.last_name, student_record.guardian_id;
        
        -- Clear invalid guardian_id
        UPDATE public.students
        SET guardian_id = NULL
        WHERE id = student_record.id;
        
        RAISE NOTICE 'Cleared invalid guardian_id for student %', student_record.id;
    END LOOP;
END $$;

-- Add audit logging
COMMENT ON COLUMN public.students.parent_id IS 'References profiles.id - parent user responsible for this student';
COMMENT ON COLUMN public.students.guardian_id IS 'References profiles.id - optional secondary guardian user';

-- Verify the fixes
DO $$
DECLARE
    fixed_count INTEGER;
    orphaned_count INTEGER;
BEGIN
    -- Count properly linked students
    SELECT COUNT(*) INTO fixed_count
    FROM public.students s
    JOIN public.profiles p ON p.id = s.parent_id
    WHERE s.is_active = true;
    
    -- Count remaining orphaned students  
    SELECT COUNT(*) INTO orphaned_count
    FROM public.students s
    LEFT JOIN public.profiles p ON p.id = s.parent_id
    WHERE s.parent_id IS NOT NULL 
    AND p.id IS NULL
    AND s.is_active = true;
    
    RAISE NOTICE 'Migration complete - % students properly linked, % orphaned students remaining', 
        fixed_count, orphaned_count;
END $$;
