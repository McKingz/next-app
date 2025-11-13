-- ============================================================================
-- Complete Petty Cash Schema with Multi-Tenant Isolation and RLS
-- ============================================================================
-- This migration creates a comprehensive petty cash management system
-- with proper tenant isolation, RLS policies, and performance optimization

-- ============================================================================
-- 1. PETTY CASH ACCOUNTS TABLE
-- ============================================================================
-- Stores per-school petty cash account configuration

CREATE TABLE IF NOT EXISTS petty_cash_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,
  opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  low_balance_threshold NUMERIC(12, 2) DEFAULT 1000.00,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users (id),

  -- Constraints
  CONSTRAINT petty_cash_accounts_positive_balance CHECK (opening_balance >= 0),
  CONSTRAINT petty_cash_accounts_positive_threshold CHECK (low_balance_threshold >= 0),
  CONSTRAINT unique_school_account UNIQUE (school_id)
);

-- ============================================================================
-- 2. PETTY CASH TRANSACTIONS TABLE
-- ============================================================================
-- Stores all petty cash transactions with proper status management

CREATE TABLE IF NOT EXISTS petty_cash_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES petty_cash_accounts (id) ON DELETE CASCADE,

  -- Transaction details
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('expense', 'replenishment', 'adjustment')),
  category TEXT,
  description TEXT NOT NULL,
  reference_number TEXT, -- Receipt number, reference, etc.

  -- Status and approval workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by UUID NOT NULL REFERENCES auth.users (id),
  approved_by UUID REFERENCES auth.users (id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Timing
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Metadata for extensibility
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Constraints
  CONSTRAINT approved_transactions_have_approver CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR (status != 'approved')
  ),
  CONSTRAINT rejected_transactions_have_reason CHECK (
    (status = 'rejected' AND rejection_reason IS NOT NULL)
    OR (status != 'rejected')
  )
);

-- ============================================================================
-- 3. PETTY CASH RECEIPTS TABLE
-- ============================================================================
-- Stores receipt/document attachments for transactions

CREATE TABLE IF NOT EXISTS petty_cash_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES petty_cash_transactions (id) ON DELETE CASCADE,

  -- File details
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  file_name TEXT NOT NULL,
  original_name TEXT, -- User's original filename
  content_type TEXT,
  size_bytes BIGINT,

  -- Upload details
  created_by UUID NOT NULL REFERENCES auth.users (id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB
);

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Petty cash accounts indexes
CREATE INDEX IF NOT EXISTS idx_petty_cash_accounts_school_id ON petty_cash_accounts (school_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_accounts_active ON petty_cash_accounts (school_id, is_active) WHERE is_active
= TRUE;

-- Petty cash transactions indexes
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_school_id ON petty_cash_transactions (school_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_account_id ON petty_cash_transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_status ON petty_cash_transactions (school_id, status);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_occurred_at ON petty_cash_transactions (
  school_id, occurred_at DESC
);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_type_status ON petty_cash_transactions (school_id, type, status);
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_created_by ON petty_cash_transactions (created_by);

-- Petty cash receipts indexes
CREATE INDEX IF NOT EXISTS idx_petty_cash_receipts_transaction_id ON petty_cash_receipts (transaction_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_receipts_school_id ON petty_cash_receipts (school_id);

-- ============================================================================
-- 5. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_petty_cash_accounts_updated_at ON petty_cash_accounts;
CREATE TRIGGER update_petty_cash_accounts_updated_at
BEFORE UPDATE ON petty_cash_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_petty_cash_transactions_updated_at ON petty_cash_transactions;
CREATE TRIGGER update_petty_cash_transactions_updated_at
BEFORE UPDATE ON petty_cash_transactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE petty_cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_receipts ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user belongs to a school
CREATE OR REPLACE FUNCTION user_belongs_to_school(school_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() 
    AND preschool_id = school_uuid
  );
$$;

-- Helper function to check if user has role
CREATE OR REPLACE FUNCTION user_has_role(role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users 
    WHERE auth_user_id = auth.uid() 
    AND role = role_name
  );
$$;

-- Helper function for super admin check
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT user_has_role('super_admin');
$$;

-- ============================================================================
-- PETTY CASH ACCOUNTS POLICIES
-- ============================================================================

-- SELECT: Users can view accounts from their school
DROP POLICY IF EXISTS petty_cash_accounts_select_policy ON petty_cash_accounts;
CREATE POLICY petty_cash_accounts_select_policy ON petty_cash_accounts
FOR SELECT
USING (
  is_super_admin()
  OR user_belongs_to_school(school_id)
);

-- INSERT: Only principals and finance admins can create accounts
DROP POLICY IF EXISTS petty_cash_accounts_insert_policy ON petty_cash_accounts;
CREATE POLICY petty_cash_accounts_insert_policy ON petty_cash_accounts
FOR INSERT
WITH CHECK (
  is_super_admin()
  OR (
    user_belongs_to_school(school_id)
    AND (user_has_role('principal_admin') OR user_has_role('finance_admin'))
  )
);

-- UPDATE: Principals and finance admins can update accounts in their school
DROP POLICY IF EXISTS petty_cash_accounts_update_policy ON petty_cash_accounts;
CREATE POLICY petty_cash_accounts_update_policy ON petty_cash_accounts
FOR UPDATE
USING (
  is_super_admin()
  OR (
    user_belongs_to_school(school_id)
    AND (user_has_role('principal_admin') OR user_has_role('finance_admin'))
  )
);

-- ============================================================================
-- PETTY CASH TRANSACTIONS POLICIES
-- ============================================================================

-- SELECT: Users can view transactions from their school
DROP POLICY IF EXISTS petty_cash_transactions_select_policy ON petty_cash_transactions;
CREATE POLICY petty_cash_transactions_select_policy ON petty_cash_transactions
FOR SELECT
USING (
  is_super_admin()
  OR user_belongs_to_school(school_id)
);

-- INSERT: Users can create transactions for their school
DROP POLICY IF EXISTS petty_cash_transactions_insert_policy ON petty_cash_transactions;
CREATE POLICY petty_cash_transactions_insert_policy ON petty_cash_transactions
FOR INSERT
WITH CHECK (
  is_super_admin()
  OR (user_belongs_to_school(school_id) AND created_by = auth.uid())
);

-- UPDATE: Users can update their own pending transactions, approvers can approve/reject
DROP POLICY IF EXISTS petty_cash_transactions_update_policy ON petty_cash_transactions;
CREATE POLICY petty_cash_transactions_update_policy ON petty_cash_transactions
FOR UPDATE
USING (
  is_super_admin()
  OR (
    user_belongs_to_school(school_id)
    AND (
      -- Own pending transactions
      (created_by = auth.uid() AND status = 'pending')
      -- Principals and finance admins can approve/reject
      OR (user_has_role('principal_admin') OR user_has_role('finance_admin'))
    )
  )
);

-- DELETE: Only principals and finance admins can delete pending/rejected transactions
DROP POLICY IF EXISTS petty_cash_transactions_delete_policy ON petty_cash_transactions;
CREATE POLICY petty_cash_transactions_delete_policy ON petty_cash_transactions
FOR DELETE
USING (
  is_super_admin()
  OR (
    user_belongs_to_school(school_id)
    AND (user_has_role('principal_admin') OR user_has_role('finance_admin'))
    AND status IN ('pending', 'rejected')
  )
);

-- ============================================================================
-- PETTY CASH RECEIPTS POLICIES
-- ============================================================================

-- SELECT: Users can view receipts for transactions in their school
DROP POLICY IF EXISTS petty_cash_receipts_select_policy ON petty_cash_receipts;
CREATE POLICY petty_cash_receipts_select_policy ON petty_cash_receipts
FOR SELECT
USING (
  is_super_admin()
  OR user_belongs_to_school(school_id)
);

-- INSERT: Users can upload receipts for transactions in their school
DROP POLICY IF EXISTS petty_cash_receipts_insert_policy ON petty_cash_receipts;
CREATE POLICY petty_cash_receipts_insert_policy ON petty_cash_receipts
FOR INSERT
WITH CHECK (
  is_super_admin()
  OR (user_belongs_to_school(school_id) AND created_by = auth.uid())
);

-- DELETE: Users can delete their own receipts, approvers can delete any in their school
DROP POLICY IF EXISTS petty_cash_receipts_delete_policy ON petty_cash_receipts;
CREATE POLICY petty_cash_receipts_delete_policy ON petty_cash_receipts
FOR DELETE
USING (
  is_super_admin()
  OR (
    user_belongs_to_school(school_id)
    AND (
      created_by = auth.uid()
      OR user_has_role('principal_admin') OR user_has_role('finance_admin')
    )
  )
);

-- ============================================================================
-- 7. VIEWS FOR EFFICIENT QUERIES
-- ============================================================================

-- View for approved transactions with sign-adjusted amounts
CREATE OR REPLACE VIEW petty_cash_approved_transactions AS
SELECT
  id,
  school_id,
  account_id,
  amount,
  type,
  category,
  description,
  occurred_at,
  created_at,
  created_by,
  approved_by,
  approved_at,
  CASE
    WHEN type = 'expense' THEN -amount
    WHEN type IN ('replenishment', 'adjustment') THEN amount
    ELSE 0
  END AS signed_amount
FROM petty_cash_transactions
WHERE status = 'approved';

-- View for account balances
CREATE OR REPLACE VIEW petty_cash_account_balances AS
SELECT
  a.id AS account_id,
  a.school_id,
  a.opening_balance,
  a.low_balance_threshold,
  coalesce(sum(t.signed_amount), 0) AS transaction_total,
  a.opening_balance + coalesce(sum(t.signed_amount), 0) AS current_balance,
  (a.opening_balance + coalesce(sum(t.signed_amount), 0)) < a.low_balance_threshold AS is_low_balance
FROM petty_cash_accounts AS a
LEFT JOIN petty_cash_approved_transactions AS t ON a.id = t.account_id
WHERE a.is_active = TRUE
GROUP BY a.id, a.school_id, a.opening_balance, a.low_balance_threshold;

-- ============================================================================
-- 8. STORED PROCEDURES FOR COMPLEX OPERATIONS
-- ============================================================================

-- Get petty cash balance for a school
CREATE OR REPLACE FUNCTION get_petty_cash_balance(school_uuid UUID)
RETURNS NUMERIC(12, 2)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(current_balance, 0)
  FROM petty_cash_account_balances
  WHERE school_id = school_uuid
  LIMIT 1;
$$;

-- Get petty cash summary for a date range
CREATE OR REPLACE FUNCTION get_petty_cash_summary(
  school_uuid UUID,
  start_date TIMESTAMPTZ DEFAULT null,
  end_date TIMESTAMPTZ DEFAULT null
)
RETURNS TABLE (
  total_expenses NUMERIC(12, 2),
  total_replenishments NUMERIC(12, 2),
  total_adjustments NUMERIC(12, 2),
  transaction_count BIGINT,
  pending_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'approved' THEN amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN type = 'replenishment' AND status = 'approved' THEN amount ELSE 0 END), 0) as total_replenishments,
    COALESCE(SUM(CASE WHEN type = 'adjustment' AND status = 'approved' THEN amount ELSE 0 END), 0) as total_adjustments,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as transaction_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
  FROM petty_cash_transactions
  WHERE school_id = school_uuid
    AND (start_date IS NULL OR occurred_at >= start_date)
    AND (end_date IS NULL OR occurred_at <= end_date);
$$;

-- ============================================================================
-- 9. DEFAULT DATA SETUP
-- ============================================================================

-- Function to ensure petty cash account exists for a school
CREATE OR REPLACE FUNCTION ensure_petty_cash_account(school_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  account_uuid UUID;
BEGIN
  -- Check if account already exists
  SELECT id INTO account_uuid 
  FROM petty_cash_accounts 
  WHERE school_id = school_uuid;
  
  -- Create if doesn't exist
  IF account_uuid IS NULL THEN
    INSERT INTO petty_cash_accounts (school_id, opening_balance, currency)
    VALUES (school_uuid, 0, 'ZAR')
    RETURNING id INTO account_uuid;
  END IF;
  
  RETURN account_uuid;
END;
$$;

-- ============================================================================
-- 10. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE petty_cash_accounts IS 'Petty cash accounts for schools with configuration';
COMMENT ON TABLE petty_cash_transactions IS 'All petty cash transactions with approval workflow';
COMMENT ON TABLE petty_cash_receipts IS 'Receipt attachments for petty cash transactions';

COMMENT ON COLUMN petty_cash_accounts.low_balance_threshold IS 'Balance below which warnings should be shown';
COMMENT ON COLUMN petty_cash_transactions.occurred_at IS 'When the transaction actually happened';
COMMENT ON COLUMN petty_cash_transactions.metadata IS 'Additional transaction data as JSON';
COMMENT ON COLUMN petty_cash_receipts.storage_path IS 'Path to file in Supabase Storage';

COMMENT ON VIEW petty_cash_approved_transactions IS 'Approved transactions with sign-adjusted amounts';
COMMENT ON VIEW petty_cash_account_balances IS 'Current balances for all active accounts';

COMMENT ON FUNCTION get_petty_cash_balance(UUID) IS 'Get current petty cash balance for a school';
COMMENT ON FUNCTION get_petty_cash_summary(
  UUID, TIMESTAMPTZ, TIMESTAMPTZ
) IS 'Get petty cash summary statistics for date range';
COMMENT ON FUNCTION ensure_petty_cash_account(UUID) IS 'Create petty cash account if it does not exist for school';
