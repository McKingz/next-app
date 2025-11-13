-- Change child_registration_requests.parent_id to reference profiles instead of users
-- Date: 2025-10-30 11:02:00
-- Purpose: Part of users table deprecation - migrate to profiles-first architecture
-- Context: We are deprecating the users table in favor of profiles table
-- Migration: Idempotent and safe to re-run

DO $$ 
BEGIN
  -- Drop existing foreign key constraint if it references users table
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'child_registration_requests_parent_id_fkey'
    AND table_name = 'child_registration_requests'
  ) THEN
    -- Check if it points to users (not profiles)
    IF EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage
      WHERE constraint_name = 'child_registration_requests_parent_id_fkey'
      AND table_name = 'users'
    ) THEN
      -- Drop and recreate pointing to profiles
      ALTER TABLE child_registration_requests 
      DROP CONSTRAINT child_registration_requests_parent_id_fkey;
      
      ALTER TABLE child_registration_requests 
      ADD CONSTRAINT child_registration_requests_parent_id_fkey 
      FOREIGN KEY (parent_id) 
      REFERENCES profiles(id) 
      ON DELETE CASCADE;
      
      RAISE NOTICE 'Updated parent_id foreign key to reference profiles table';
    ELSE
      RAISE NOTICE 'Foreign key already references profiles table, skipping';
    END IF;
  ELSE
    -- Constraint doesn't exist, create it
    ALTER TABLE child_registration_requests 
    ADD CONSTRAINT child_registration_requests_parent_id_fkey 
    FOREIGN KEY (parent_id) 
    REFERENCES profiles(id) 
    ON DELETE CASCADE;
    
    RAISE NOTICE 'Created parent_id foreign key to profiles table';
  END IF;
  
  -- Update RLS policy (idempotent)
  DROP POLICY IF EXISTS child_registration_requests_parent_insert ON child_registration_requests;
  
  CREATE POLICY child_registration_requests_parent_insert
  ON child_registration_requests FOR INSERT TO authenticated
  WITH CHECK (
    parent_id = auth.uid()
  );
  
  -- Add comment
  COMMENT ON COLUMN child_registration_requests.parent_id IS 
    'References profiles.id (NOT users.id) - part of users table deprecation';
    
  RAISE NOTICE 'Migration completed successfully';
END $$;
