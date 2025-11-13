-- Migration: Add last_login_at column to users table
-- Date: 2025-09-29
-- Description: Add last_login_at column to track user login activity

-- Add last_login_at column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Create index for better query performance on last_login_at
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);

-- Add comment for documentation
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of the user''s last successful login';

-- Update existing active users to have a reasonable last_login_at value
-- (Set to created_at for users who don't have a last_login_at yet)
UPDATE users 
SET last_login_at = created_at 
WHERE last_login_at IS NULL 
  AND is_active = true 
  AND created_at IS NOT NULL;

-- Verification query (for testing purposes)
-- SELECT COUNT(*) as total_users, 
--        COUNT(last_login_at) as users_with_last_login 
-- FROM users;