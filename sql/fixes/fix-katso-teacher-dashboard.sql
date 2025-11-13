-- Fix Teacher Dashboard for katso@youngeagles.org.za
-- Issue: Dashboard shows gray placeholder cards with no data
-- Root cause: Missing preschool assignment and/or no class/student data

-- ============================================================================
-- STEP 1: DIAGNOSE - Check current state
-- ============================================================================

-- Check teacher profile
SELECT 
  id as user_id,
  email,
  first_name,
  last_name,
  role,
  preschool_id,
  created_at
FROM profiles 
WHERE email = 'katso@youngeagles.org.za';

-- Expected: Should show user with role='teacher'
-- Problem: preschool_id is likely NULL

-- ============================================================================
-- STEP 2: CHECK/CREATE YOUNG EAGLES PRESCHOOL
-- ============================================================================

-- Check if Young Eagles preschool exists
SELECT 
  id as preschool_id,
  name,
  slug,
  owner_id,
  created_at
FROM preschools 
WHERE name ILIKE '%young eagles%' OR slug ILIKE '%young%eagles%';

-- If no results, we need to create it
-- Replace 'OWNER_USER_ID' with the actual owner/principal user ID

/*
INSERT INTO preschools (name, slug, owner_id, address, phone, email)
VALUES (
  'Young Eagles',
  'young-eagles',
  'OWNER_USER_ID',  -- Replace with principal's user ID
  'Young Eagles Address',  -- Replace with actual address
  '+27 XX XXX XXXX',  -- Replace with actual phone
  'info@youngeagles.org.za'
)
RETURNING id, name, slug;
*/

-- ============================================================================
-- STEP 3: ASSIGN TEACHER TO PRESCHOOL
-- ============================================================================

-- Once you have the preschool_id from step 2, run this:

/*
UPDATE profiles 
SET preschool_id = 'PRESCHOOL_UUID_HERE'  -- Replace with actual UUID from step 2
WHERE email = 'katso@youngeagles.org.za';
*/

-- Verify assignment
SELECT email, first_name, preschool_id 
FROM profiles 
WHERE email = 'katso@youngeagles.org.za';

-- ============================================================================
-- STEP 4: CREATE TEST DATA (Classes & Students)
-- ============================================================================

-- Get teacher's user_id and preschool_id for the setup script
DO $$
DECLARE
  v_teacher_user_id UUID;
  v_preschool_id UUID;
  v_class_id UUID;
  v_student_ids UUID[];
BEGIN
  -- Get teacher details
  SELECT id, preschool_id 
  INTO v_teacher_user_id, v_preschool_id
  FROM profiles 
  WHERE email = 'katso@youngeagles.org.za';
  
  -- Check if we have preschool assigned
  IF v_preschool_id IS NULL THEN
    RAISE EXCEPTION 'Teacher has no preschool_id assigned. Run STEP 3 first.';
  END IF;
  
  RAISE NOTICE 'Teacher ID: %, Preschool ID: %', v_teacher_user_id, v_preschool_id;
  
  -- Create a class if none exist for this teacher
  INSERT INTO classes (
    preschool_id, 
    teacher_id, 
    name, 
    grade_level,
    room,
    capacity,
    schedule
  )
  VALUES (
    v_preschool_id,
    v_teacher_user_id,
    'Grade R - Morning Eagles',
    'Grade R',
    'Room 101',
    20,
    'Monday-Friday, 8:00 AM - 12:00 PM'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_class_id;
  
  IF v_class_id IS NULL THEN
    -- Class already exists, get it
    SELECT id INTO v_class_id
    FROM classes
    WHERE teacher_id = v_teacher_user_id
    LIMIT 1;
  END IF;
  
  RAISE NOTICE 'Class ID: %', v_class_id;
  
  -- Add test students if none exist for this preschool
  IF NOT EXISTS (SELECT 1 FROM students WHERE preschool_id = v_preschool_id LIMIT 1) THEN
    INSERT INTO students (
      preschool_id, 
      first_name, 
      last_name, 
      date_of_birth, 
      grade_level,
      status
    )
    SELECT 
      v_preschool_id,
      'Test Student ' || generate_series,
      'Eagles ' || generate_series,
      CURRENT_DATE - INTERVAL '5 years' - (generate_series * 30 || ' days')::INTERVAL,
      'Grade R',
      'active'
    FROM generate_series(1, 12)
    RETURNING ARRAY_AGG(id) INTO v_student_ids;
    
    RAISE NOTICE 'Created % students', array_length(v_student_ids, 1);
    
    -- Link students to class
    INSERT INTO class_students (class_id, student_id)
    SELECT v_class_id, unnest(v_student_ids)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Linked students to class';
  ELSE
    RAISE NOTICE 'Students already exist, skipping creation';
    
    -- Link existing students to class if not already linked
    INSERT INTO class_students (class_id, student_id)
    SELECT v_class_id, id 
    FROM students 
    WHERE preschool_id = v_preschool_id
    AND id NOT IN (
      SELECT student_id FROM class_students WHERE class_id = v_class_id
    )
    LIMIT 12
    ON CONFLICT DO NOTHING;
  END IF;
  
  RAISE NOTICE 'Setup complete for katso@youngeagles.org.za';
  RAISE NOTICE 'Dashboard should now show data';
END $$;

-- ============================================================================
-- STEP 5: VERIFY SETUP
-- ============================================================================

-- Check teacher's classes
SELECT 
  c.id,
  c.name,
  c.grade_level,
  c.room,
  COUNT(cs.student_id) as student_count
FROM classes c
LEFT JOIN class_students cs ON cs.class_id = c.id
WHERE c.teacher_id = (SELECT id FROM profiles WHERE email = 'katso@youngeagles.org.za')
GROUP BY c.id, c.name, c.grade_level, c.room;

-- Expected: Should show at least 1 class with 12 students

-- Check teacher's students (via classes)
SELECT 
  s.id,
  s.first_name,
  s.last_name,
  s.grade_level,
  s.status,
  c.name as class_name
FROM students s
JOIN class_students cs ON cs.student_id = s.id
JOIN classes c ON c.id = cs.class_id
WHERE c.teacher_id = (SELECT id FROM profiles WHERE email = 'katso@youngeagles.org.za')
ORDER BY s.first_name;

-- Expected: Should show 12 students linked to the class

-- Check dashboard metrics that should now populate
SELECT 
  (SELECT COUNT(DISTINCT s.id) 
   FROM students s
   JOIN class_students cs ON cs.student_id = s.id
   JOIN classes c ON c.id = cs.class_id
   WHERE c.teacher_id = p.id) as total_students,
  
  (SELECT COUNT(*) 
   FROM classes c 
   WHERE c.teacher_id = p.id) as total_classes,
  
  (SELECT COUNT(*) 
   FROM assignments a
   WHERE a.teacher_id = p.id 
   AND a.status = 'pending') as pending_grading,
  
  p.first_name,
  p.email
FROM profiles p
WHERE p.email = 'katso@youngeagles.org.za';

-- Expected output:
-- total_students: 12
-- total_classes: 1
-- pending_grading: 0 (will be 0 until assignments are created)

-- ============================================================================
-- STEP 6: CREATE SAMPLE ASSIGNMENTS (Optional - for testing)
-- ============================================================================

-- Create a few sample assignments to populate "Pending Grading" metric
DO $$
DECLARE
  v_teacher_user_id UUID;
  v_preschool_id UUID;
  v_class_id UUID;
BEGIN
  SELECT id, preschool_id INTO v_teacher_user_id, v_preschool_id
  FROM profiles 
  WHERE email = 'katso@youngeagles.org.za';
  
  SELECT id INTO v_class_id
  FROM classes
  WHERE teacher_id = v_teacher_user_id
  LIMIT 1;
  
  -- Create 3 sample assignments
  INSERT INTO assignments (
    preschool_id,
    teacher_id,
    class_id,
    title,
    description,
    due_date,
    status,
    points_possible
  )
  VALUES 
    (v_preschool_id, v_teacher_user_id, v_class_id, 'Math Worksheet 1', 'Basic addition and subtraction', CURRENT_DATE + INTERVAL '7 days', 'active', 10),
    (v_preschool_id, v_teacher_user_id, v_class_id, 'Reading Activity', 'Read the story and answer questions', CURRENT_DATE + INTERVAL '5 days', 'active', 15),
    (v_preschool_id, v_teacher_user_id, v_class_id, 'Art Project', 'Draw your favorite animal', CURRENT_DATE + INTERVAL '10 days', 'active', 5)
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Created sample assignments';
END $$;

-- ============================================================================
-- QUICK REFERENCE: One-Step Fix (Run after completing manual steps 1-3)
-- ============================================================================

/*
-- Replace PRESCHOOL_UUID with actual UUID from step 2
-- This is the all-in-one script once preschool_id is assigned

DO $$
DECLARE
  v_preschool_id UUID := 'PRESCHOOL_UUID_HERE';
  v_teacher_email TEXT := 'katso@youngeagles.org.za';
  v_teacher_user_id UUID;
  v_class_id UUID;
BEGIN
  SELECT id INTO v_teacher_user_id FROM profiles WHERE email = v_teacher_email;
  
  UPDATE profiles SET preschool_id = v_preschool_id WHERE id = v_teacher_user_id;
  
  INSERT INTO classes (preschool_id, teacher_id, name, grade_level, room, capacity)
  VALUES (v_preschool_id, v_teacher_user_id, 'Grade R - Morning Eagles', 'Grade R', 'Room 101', 20)
  ON CONFLICT DO NOTHING RETURNING id INTO v_class_id;
  
  IF v_class_id IS NULL THEN SELECT id INTO v_class_id FROM classes WHERE teacher_id = v_teacher_user_id LIMIT 1; END IF;
  
  INSERT INTO students (preschool_id, first_name, last_name, date_of_birth, grade_level, status)
  SELECT v_preschool_id, 'Test Student ' || g, 'Eagles ' || g, CURRENT_DATE - INTERVAL '5 years', 'Grade R', 'active'
  FROM generate_series(1, 12) g
  WHERE NOT EXISTS (SELECT 1 FROM students WHERE preschool_id = v_preschool_id LIMIT 1);
  
  INSERT INTO class_students (class_id, student_id)
  SELECT v_class_id, id FROM students WHERE preschool_id = v_preschool_id ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Setup complete for %', v_teacher_email;
END $$;
*/

-- ============================================================================
-- NOTES
-- ============================================================================

-- After running these scripts:
-- 1. Force close the EduDash Pro app on the device
-- 2. Reopen and sign in as katso@youngeagles.org.za
-- 3. Pull down to refresh the dashboard
-- 4. Dashboard should now show:
--    - Total Students: 12
--    - Classes Active: 1
--    - Assignments Pending: 0-3 (depending on if you ran step 6)
--    - Other metrics populated

-- If still showing gray boxes:
-- - Check device internet connection
-- - Clear app cache (Settings → Apps → EduDash Pro → Clear Cache)
-- - Check browser console at https://lvvvjywrmpcqrpvuptdi.supabase.co
