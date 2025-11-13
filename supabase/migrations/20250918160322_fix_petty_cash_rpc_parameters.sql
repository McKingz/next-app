-- ============================================================================
-- Fix Petty Cash RPC Function Parameters Migration
-- ============================================================================
-- Updates RPC function parameter names to match what the app is calling

-- Drop existing functions
DROP FUNCTION IF EXISTS ensure_petty_cash_account(UUID);
DROP FUNCTION IF EXISTS get_petty_cash_balance(UUID);
DROP FUNCTION IF EXISTS get_petty_cash_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

-- Function to ensure petty cash account exists for a school
-- Uses school_uuid parameter to match what the app is calling
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
  WHERE school_id = school_uuid
  AND is_active = true;
  
  -- Create if doesn't exist
  IF account_uuid IS NULL THEN
    INSERT INTO petty_cash_accounts (
      school_id, 
      name, 
      description, 
      opening_balance, 
      low_balance_threshold
    )
    VALUES (
      school_uuid, 
      'Main Petty Cash Account', 
      'Default petty cash account for the school', 
      0, 
      1000.00
    )
    RETURNING id INTO account_uuid;
  END IF;
  
  RETURN account_uuid;
END;
$$;

-- Get petty cash balance for a school
CREATE OR REPLACE FUNCTION get_petty_cash_balance(school_uuid UUID)
RETURNS NUMERIC(12, 2)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (
      SELECT a.opening_balance + COALESCE(SUM(
        CASE 
          WHEN t.type = 'expense' THEN -t.amount
          WHEN t.type IN ('replenishment', 'adjustment') THEN t.amount
          ELSE 0
        END
      ), 0)
      FROM petty_cash_accounts a
      LEFT JOIN petty_cash_transactions t ON t.account_id = a.id AND t.status = 'approved'
      WHERE a.school_id = school_uuid AND a.is_active = true
      GROUP BY a.id, a.opening_balance
      LIMIT 1
    ), 0
  );
$$;

-- Get petty cash summary for a date range
CREATE OR REPLACE FUNCTION get_petty_cash_summary(
  school_uuid UUID,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
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
    AND (start_date IS NULL OR created_at >= start_date)
    AND (end_date IS NULL OR created_at <= end_date);
$$;

-- Comments for documentation
COMMENT ON FUNCTION ensure_petty_cash_account(UUID) IS 'Create petty cash account if it does not exist for school';
COMMENT ON FUNCTION get_petty_cash_balance(UUID) IS 'Get current petty cash balance for a school';
COMMENT ON FUNCTION get_petty_cash_summary(
  UUID, TIMESTAMPTZ, TIMESTAMPTZ
) IS 'Get petty cash summary statistics for date range';
