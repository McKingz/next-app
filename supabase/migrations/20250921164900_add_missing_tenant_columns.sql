-- Add Missing Tenant Isolation Columns
-- Date: 2025-09-21
-- Purpose: Add missing tenant isolation columns before enabling RLS policies
-- This migration adds organization_id/preschool_id columns where missing

BEGIN;

-- ====================================================================
-- PART 1: ADD MISSING TENANT COLUMNS
-- ====================================================================

-- Check if groups table needs organization_id column
DO $$
BEGIN
    -- Add organization_id to groups table if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'groups' 
                   AND column_name = 'organization_id') THEN
        
        ALTER TABLE groups ADD COLUMN organization_id UUID;
        
        -- Populate organization_id from course relationship
        UPDATE groups 
        SET organization_id = c.organization_id
        FROM courses c 
        WHERE c.id = groups.course_id;
        
        -- Make it NOT NULL and add foreign key
        ALTER TABLE groups ALTER COLUMN organization_id SET NOT NULL;
        ALTER TABLE groups ADD CONSTRAINT fk_groups_organization_id 
            FOREIGN KEY (organization_id) REFERENCES preschools(id) ON DELETE CASCADE;
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_groups_organization_id ON groups(organization_id);
        
        RAISE NOTICE 'Added organization_id column to groups table';
    ELSE
        RAISE NOTICE 'groups table already has organization_id column';
    END IF;
END
$$;

-- Check if subscription_seats table needs preschool_id column  
DO $$
BEGIN
    -- Add preschool_id to subscription_seats table if missing
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'subscription_seats') THEN
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'subscription_seats' 
                       AND column_name = 'preschool_id') THEN
            
            ALTER TABLE subscription_seats ADD COLUMN preschool_id UUID;
            
            -- Populate preschool_id from subscription relationship
            UPDATE subscription_seats 
            SET preschool_id = s.school_id
            FROM subscriptions s 
            WHERE s.id = subscription_seats.subscription_id;
            
            -- Make it NOT NULL and add foreign key
            ALTER TABLE subscription_seats ALTER COLUMN preschool_id SET NOT NULL;
            ALTER TABLE subscription_seats ADD CONSTRAINT fk_subscription_seats_preschool_id 
                FOREIGN KEY (preschool_id) REFERENCES preschools(id) ON DELETE CASCADE;
            
            -- Add index for performance
            CREATE INDEX IF NOT EXISTS idx_subscription_seats_preschool_id ON subscription_seats(preschool_id);
            
            RAISE NOTICE 'Added preschool_id column to subscription_seats table';
        ELSE
            RAISE NOTICE 'subscription_seats table already has preschool_id column';
        END IF;
    ELSE
        RAISE NOTICE 'subscription_seats table does not exist';
    END IF;
END
$$;

-- Check if seats table exists and needs preschool_id column
DO $$
BEGIN
    -- Add preschool_id to seats table if it exists and column is missing
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'seats') THEN
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'seats' 
                       AND column_name = 'preschool_id') THEN
            
            -- Add preschool_id column
            ALTER TABLE seats ADD COLUMN preschool_id UUID;
            
            -- Try to populate from user relationship if user_id exists
            IF EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'seats' 
                       AND column_name = 'user_id') THEN
                
                UPDATE seats 
                SET preschool_id = p.organization_id
                FROM profiles p 
                WHERE p.id = seats.user_id;
            END IF;
            
            -- If we still have NULL values, this indicates data integrity issues
            -- For now, we'll make it nullable and add the constraint later
            IF (SELECT COUNT(*) FROM seats WHERE preschool_id IS NULL) = 0 THEN
                ALTER TABLE seats ALTER COLUMN preschool_id SET NOT NULL;
                ALTER TABLE seats ADD CONSTRAINT fk_seats_preschool_id 
                    FOREIGN KEY (preschool_id) REFERENCES preschools(id) ON DELETE CASCADE;
            END IF;
            
            -- Add index for performance
            CREATE INDEX IF NOT EXISTS idx_seats_preschool_id ON seats(preschool_id);
            
            RAISE NOTICE 'Added preschool_id column to seats table';
        ELSE
            RAISE NOTICE 'seats table already has preschool_id column';
        END IF;
    ELSE
        RAISE NOTICE 'seats table does not exist';
    END IF;
END
$$;

-- ====================================================================
-- PART 2: ADD MISSING ORGANIZATION_ID TO OTHER CORE TABLES
-- ====================================================================

-- Check if student_groups needs organization access
DO $$
BEGIN
    -- student_groups doesn't need direct organization_id since it's accessed via groups
    -- But we can add helper view or ensure proper join paths exist
    RAISE NOTICE 'student_groups table inherits organization context from groups table';
END
$$;

-- Check if admin_users has proper organization reference
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'admin_users' 
                   AND column_name = 'organization_id') THEN
        
        -- Add organization_id to admin_users if missing
        ALTER TABLE admin_users ADD COLUMN organization_id UUID;
        
        -- Try to populate from profile relationship if possible
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'admin_users' 
                   AND column_name = 'user_id') THEN
            
            UPDATE admin_users 
            SET organization_id = p.organization_id
            FROM profiles p 
            WHERE p.id = admin_users.user_id;
        END IF;
        
        -- Add foreign key if all values populated successfully
        IF (SELECT COUNT(*) FROM admin_users WHERE organization_id IS NULL) = 0 THEN
            ALTER TABLE admin_users ALTER COLUMN organization_id SET NOT NULL;
            ALTER TABLE admin_users ADD CONSTRAINT fk_admin_users_organization_id 
                FOREIGN KEY (organization_id) REFERENCES preschools(id) ON DELETE CASCADE;
        END IF;
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_admin_users_organization_id ON admin_users(organization_id);
        
        RAISE NOTICE 'Added organization_id column to admin_users table';
    ELSE
        RAISE NOTICE 'admin_users table already has organization_id column';
    END IF;
END
$$;

-- ====================================================================
-- PART 3: VERIFY DATA INTEGRITY
-- ====================================================================

-- Check for any remaining NULL tenant columns
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    -- Check groups
    SELECT COUNT(*) INTO null_count FROM groups WHERE organization_id IS NULL;
    IF null_count > 0 THEN
        RAISE WARNING 'Found % groups with NULL organization_id - data integrity issue', null_count;
    END IF;
    
    -- Check subscription_seats if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_seats') THEN
        SELECT COUNT(*) INTO null_count FROM subscription_seats WHERE preschool_id IS NULL;
        IF null_count > 0 THEN
            RAISE WARNING 'Found % subscription_seats with NULL preschool_id - data integrity issue', null_count;
        END IF;
    END IF;
    
    -- Check admin_users
    SELECT COUNT(*) INTO null_count FROM admin_users WHERE organization_id IS NULL;
    IF null_count > 0 THEN
        RAISE WARNING 'Found % admin_users with NULL organization_id - data integrity issue', null_count;
    END IF;
END
$$;

COMMIT;
