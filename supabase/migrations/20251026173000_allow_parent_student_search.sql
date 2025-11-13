-- Allow parents to search students in their school for claiming
-- Date: 2025-10-26
-- Purpose: Enable claim flow by allowing parents to view all students in their preschool

CREATE POLICY "students_parent_search_in_school" ON students
  FOR SELECT
  TO authenticated
  USING (
    -- Parents can search students in their own preschool
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'parent'
        AND profiles.preschool_id = students.preschool_id
    )
  );

COMMENT ON POLICY "students_parent_search_in_school" ON students IS 
'Allows parents to search and view students in their school for the claim flow. Students are only displayed in search results, actual linking requires school approval via guardian_requests.';
