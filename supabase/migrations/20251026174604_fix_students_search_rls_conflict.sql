-- Fix RLS policy conflict causing 300 status code
-- Issue: Two policies (students_parent_access and students_parent_search_in_school) 
-- were creating ambiguity. The search policy already covers both cases.

-- Drop the old restrictive policy that only allowed viewing linked students
DROP POLICY IF EXISTS students_parent_access ON students;

-- Keep students_parent_search_in_school policy which already allows:
-- 1. Viewing all students in parent's preschool (includes linked students)
-- 2. Searching for students to claim

COMMENT ON POLICY students_parent_search_in_school ON students IS 
  'Allows parents to view and search all students in their school (includes linked children and students available for claiming)';
