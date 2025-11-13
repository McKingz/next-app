-- ============================================================================
-- Fix Petty Cash Column Names Migration
-- ============================================================================
-- This migration renames school_id to preschool_id in petty cash tables
-- to maintain consistency with the rest of the application

-- ============================================================================
-- 1. RENAME COLUMNS IN TABLES
-- ============================================================================

-- Rename school_id to preschool_id in petty_cash_accounts
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_accounts' AND column_name = 'school_id') THEN
        ALTER TABLE petty_cash_accounts RENAME COLUMN school_id TO preschool_id;
    END IF;
END $$;

-- Rename school_id to preschool_id in petty_cash_transactions  
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_transactions' AND column_name = 'school_id') THEN
        ALTER TABLE petty_cash_transactions RENAME COLUMN school_id TO preschool_id;
    END IF;
END $$;

-- Rename school_id to preschool_id in petty_cash_receipts
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_receipts' AND column_name = 'school_id') THEN
        ALTER TABLE petty_cash_receipts RENAME COLUMN school_id TO preschool_id;
    END IF;
END $$;

-- ============================================================================
-- 2. UPDATE INDEXES
-- ============================================================================

-- Drop old indexes with school_id references
DROP INDEX IF EXISTS idx_petty_cash_accounts_school_id;
DROP INDEX IF EXISTS idx_petty_cash_accounts_active;
DROP INDEX IF EXISTS idx_petty_cash_transactions_school_id;
DROP INDEX IF EXISTS idx_petty_cash_transactions_status;
DROP INDEX IF EXISTS idx_petty_cash_transactions_occurred_at;
DROP INDEX IF EXISTS idx_petty_cash_transactions_type_status;
DROP INDEX IF EXISTS idx_petty_cash_receipts_school_id;

-- Create new indexes with preschool_id references
CREATE INDEX IF NOT EXISTS idx_petty_cash_accounts_preschool_id ON petty_cash_accounts(preschool_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_accounts_active ON petty_cash_accounts(preschool_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_preschool_id ON petty_cash_transactions(preschool_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_status ON petty_cash_transactions(preschool_id, status);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_occurred_at ON petty_cash_transactions(preschool_id, occurred_at DESC);
CREATE INDEX IF EXISTS idx_petty_cash_transactions_type_status ON petty_cash_transactions(preschool_id, type, status);
CREATE INDEX IF NOT EXISTS idx_petty_cash_receipts_preschool_id ON petty_cash_receipts(preschool_id);

-- ============================================================================
-- 3. UPDATE RLS POLICIES
-- ============================================================================

-- Update user_belongs_to_school function to work with preschool_id
CREATE OR REPLACE FUNCTION user_belongs_to_school(school_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() 
    AND preschool_id = school_uuid
  );
$$;

-- Update RLS policies to use preschool_id
DROP POLICY IF EXISTS "petty_cash_accounts_select_policy" ON petty_cash_accounts;
CREATE POLICY "petty_cash_accounts_select_policy" ON petty_cash_accounts
  FOR SELECT
  USING (
    is_super_admin() OR 
    user_belongs_to_school(preschool_id)
  );

DROP POLICY IF EXISTS "petty_cash_accounts_insert_policy" ON petty_cash_accounts;
CREATE POLICY "petty_cash_accounts_insert_policy" ON petty_cash_accounts
  FOR INSERT
  WITH CHECK (
    is_super_admin() OR 
    (user_belongs_to_school(preschool_id) AND 
     (user_has_role('principal_admin') OR user_has_role('finance_admin')))
  );

DROP POLICY IF EXISTS "petty_cash_accounts_update_policy" ON petty_cash_accounts;
CREATE POLICY "petty_cash_accounts_update_policy" ON petty_cash_accounts
  FOR UPDATE
  USING (
    is_super_admin() OR 
    (user_belongs_to_school(preschool_id) AND 
     (user_has_role('principal_admin') OR user_has_role('finance_admin')))
  );

DROP POLICY IF EXISTS "petty_cash_transactions_select_policy" ON petty_cash_transactions;
CREATE POLICY "petty_cash_transactions_select_policy" ON petty_cash_transactions
  FOR SELECT
  USING (
    is_super_admin() OR 
    user_belongs_to_school(preschool_id)
  );

DROP POLICY IF EXISTS "petty_cash_transactions_insert_policy" ON petty_cash_transactions;
CREATE POLICY "petty_cash_transactions_insert_policy" ON petty_cash_transactions
  FOR INSERT
  WITH CHECK (
    is_super_admin() OR 
    (user_belongs_to_school(preschool_id) AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "petty_cash_transactions_update_policy" ON petty_cash_transactions;
CREATE POLICY "petty_cash_transactions_update_policy" ON petty_cash_transactions
  FOR UPDATE
  USING (
    is_super_admin() OR 
    (user_belongs_to_school(preschool_id) AND 
     (
       -- Own pending transactions
       (created_by = auth.uid() AND status = 'pending') OR
       -- Principals and finance admins can approve/reject
       (user_has_role('principal_admin') OR user_has_role('finance_admin'))
     )
    )
  );

DROP POLICY IF EXISTS "petty_cash_transactions_delete_policy" ON petty_cash_transactions;
CREATE POLICY "petty_cash_transactions_delete_policy" ON petty_cash_transactions
  FOR DELETE
  USING (
    is_super_admin() OR 
    (user_belongs_to_school(preschool_id) AND 
     (user_has_role('principal_admin') OR user_has_role('finance_admin')) AND
     status IN ('pending', 'rejected'))
  );

DROP POLICY IF EXISTS "petty_cash_receipts_select_policy" ON petty_cash_receipts;
CREATE POLICY "petty_cash_receipts_select_policy" ON petty_cash_receipts
  FOR SELECT
  USING (
    is_super_admin() OR 
    user_belongs_to_school(preschool_id)
  );

DROP POLICY IF EXISTS "petty_cash_receipts_insert_policy" ON petty_cash_receipts;
CREATE POLICY "petty_cash_receipts_insert_policy" ON petty_cash_receipts
  FOR INSERT
  WITH CHECK (
    is_super_admin() OR 
    (user_belongs_to_school(preschool_id) AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "petty_cash_receipts_delete_policy" ON petty_cash_receipts;
CREATE POLICY "petty_cash_receipts_delete_policy" ON petty_cash_receipts
  FOR DELETE
  USING (
    is_super_admin() OR 
    (user_belongs_to_school(preschool_id) AND 
     (
       created_by = auth.uid() OR
       user_has_role('principal_admin') OR user_has_role('finance_admin')
     )
    )
  );

-- ============================================================================
-- 4. UPDATE VIEWS
-- ============================================================================

-- Update view for approved transactions
DROP VIEW IF EXISTS petty_cash_approved_transactions;
CREATE OR REPLACE VIEW petty_cash_approved_transactions AS
SELECT 
  id,
  preschool_id,
  account_id,
  amount,
  CASE 
    WHEN type = 'expense' THEN -amount
    WHEN type IN ('replenishment', 'adjustment') THEN amount
    ELSE 0
  END as signed_amount,
  type,
  category,
  description,
  occurred_at,
  created_at,
  created_by,
  approved_by,
  approved_at
FROM petty_cash_transactions
WHERE status = 'approved';

-- Update view for account balances
DROP VIEW IF EXISTS petty_cash_account_balances;
CREATE OR REPLACE VIEW petty_cash_account_balances AS
SELECT 
  a.id as account_id,
  a.preschool_id,
  a.opening_balance,
  COALESCE(SUM(t.signed_amount), 0) as transaction_total,
  a.opening_balance + COALESCE(SUM(t.signed_amount), 0) as current_balance,
  a.low_balance_threshold,
  (a.opening_balance + COALESCE(SUM(t.signed_amount), 0)) < a.low_balance_threshold as is_low_balance
FROM petty_cash_accounts a
LEFT JOIN petty_cash_approved_transactions t ON t.account_id = a.id
WHERE a.is_active = true
GROUP BY a.id, a.preschool_id, a.opening_balance, a.low_balance_threshold;

-- ============================================================================
-- 5. UPDATE STORED FUNCTIONS
-- ============================================================================

-- Update get_petty_cash_balance function
CREATE OR REPLACE FUNCTION get_petty_cash_balance(school_uuid UUID)
RETURNS NUMERIC(12,2)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT COALESCE(current_balance, 0)
  FROM petty_cash_account_balances
  WHERE preschool_id = school_uuid
  LIMIT 1;
$$;

-- Update get_petty_cash_summary function
CREATE OR REPLACE FUNCTION get_petty_cash_summary(
  school_uuid UUID,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  total_expenses NUMERIC(12,2),
  total_replenishments NUMERIC(12,2),
  total_adjustments NUMERIC(12,2),
  transaction_count BIGINT,
  pending_count BIGINT
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'approved' THEN amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN type = 'replenishment' AND status = 'approved' THEN amount ELSE 0 END), 0) as total_replenishments,
    COALESCE(SUM(CASE WHEN type = 'adjustment' AND status = 'approved' THEN amount ELSE 0 END), 0) as total_adjustments,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as transaction_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
  FROM petty_cash_transactions
  WHERE preschool_id = school_uuid
    AND (start_date IS NULL OR occurred_at >= start_date)
    AND (end_date IS NULL OR occurred_at <= end_date);
$$;

-- Update ensure_petty_cash_account function
CREATE OR REPLACE FUNCTION ensure_petty_cash_account(school_uuid UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  account_uuid UUID;
BEGIN
  -- Check if account already exists
  SELECT id INTO account_uuid 
  FROM petty_cash_accounts 
  WHERE preschool_id = school_uuid;
  
  -- Create if doesn't exist
  IF account_uuid IS NULL THEN
    INSERT INTO petty_cash_accounts (preschool_id, opening_balance, currency)
    VALUES (school_uuid, 0, 'ZAR')
    RETURNING id INTO account_uuid;
  END IF;
  
  RETURN account_uuid;
END;
$$;