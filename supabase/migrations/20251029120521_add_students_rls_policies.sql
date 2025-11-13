-- Add RLS policies to allow authenticated users to read students from their preschool
-- This fixes the 400 errors when searching for students

-- Policy: Authenticated users can SELECT students from their own preschool
CREATE POLICY "Users can view students in their preschool"
ON students
FOR SELECT
TO authenticated
USING (
  preschool_id IN (
    SELECT preschool_id 
    FROM users 
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Authenticated users can INSERT guardian requests
CREATE POLICY "Users can create guardian requests"
ON guardian_requests
FOR INSERT
TO authenticated
WITH CHECK (
  parent_auth_id = auth.uid()
  AND preschool_id IN (
    SELECT preschool_id 
    FROM users 
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Users can view their own guardian requests
CREATE POLICY "Users can view their own guardian requests"
ON guardian_requests
FOR SELECT
TO authenticated
USING (
  parent_auth_id = auth.uid()
  OR student_id IN (
    SELECT id FROM students 
    WHERE preschool_id IN (
      SELECT preschool_id 
      FROM users 
      WHERE auth_user_id = auth.uid()
    )
  )
);