-- Quick test of our migration syntax
-- Let's test just the core table creation

-- Test: Create preschools table if it doesn't exist
CREATE TABLE IF NOT EXISTS preschools_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Test: Create a simple business table
CREATE TABLE IF NOT EXISTS homework_assignments_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES preschools_test(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Test: Enable RLS
ALTER TABLE preschools_test ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_assignments_test ENABLE ROW LEVEL SECURITY;

-- Test: Create a simple policy
CREATE POLICY homework_assignments_test_policy 
  ON homework_assignments_test 
  USING (preschool_id = (auth.jwt() ->> 'organization_id')::uuid);

-- Clean up test tables
DROP TABLE IF EXISTS homework_assignments_test;
DROP TABLE IF EXISTS preschools_test;