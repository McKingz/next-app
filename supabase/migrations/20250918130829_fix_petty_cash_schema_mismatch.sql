-- Migration: Fix petty cash schema column name mismatches
-- Description: Updates petty_cash_accounts table to use correct column names
-- Author: EduDash Pro

-- First, check if the table exists and has the wrong column names
DO $$ 
DECLARE
    has_preschool_id BOOLEAN := FALSE;
    has_school_id BOOLEAN := FALSE;
    has_initial_balance BOOLEAN := FALSE;
    has_opening_balance BOOLEAN := FALSE;
    has_current_balance BOOLEAN := FALSE;
    has_low_balance_threshold BOOLEAN := FALSE;
BEGIN
    -- Check for existing columns
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_accounts' AND column_name = 'preschool_id') INTO has_preschool_id;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_accounts' AND column_name = 'school_id') INTO has_school_id;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_accounts' AND column_name = 'initial_balance') INTO has_initial_balance;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_accounts' AND column_name = 'opening_balance') INTO has_opening_balance;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_accounts' AND column_name = 'current_balance') INTO has_current_balance;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_accounts' AND column_name = 'low_balance_threshold') INTO has_low_balance_threshold;

    -- Rename preschool_id to school_id if needed
    IF has_preschool_id AND NOT has_school_id THEN
        ALTER TABLE public.petty_cash_accounts RENAME COLUMN preschool_id TO school_id;
        RAISE NOTICE 'Renamed preschool_id to school_id';
    END IF;
    
    -- Rename initial_balance to opening_balance if needed
    IF has_initial_balance AND NOT has_opening_balance THEN
        ALTER TABLE public.petty_cash_accounts RENAME COLUMN initial_balance TO opening_balance;
        RAISE NOTICE 'Renamed initial_balance to opening_balance';
    END IF;
    
    -- Add low_balance_threshold if missing
    IF NOT has_low_balance_threshold THEN
        ALTER TABLE public.petty_cash_accounts ADD COLUMN low_balance_threshold NUMERIC(12,2) DEFAULT 1000.00;
        RAISE NOTICE 'Added low_balance_threshold column';
    END IF;
    
    -- Remove current_balance if it exists (we calculate this dynamically)
    IF has_current_balance THEN
        ALTER TABLE public.petty_cash_accounts DROP COLUMN current_balance;
        RAISE NOTICE 'Dropped current_balance column (calculated dynamically)';
    END IF;
    
END $$;

-- Update foreign key constraints to reference the correct column
DO $$
BEGIN
    -- Check if petty_cash_transactions table exists and update its references
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'petty_cash_transactions') THEN
        -- Update preschool_id to school_id in transactions table if needed
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_transactions' AND column_name = 'preschool_id') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'petty_cash_transactions' AND column_name = 'school_id') THEN
            ALTER TABLE public.petty_cash_transactions RENAME COLUMN preschool_id TO school_id;
            RAISE NOTICE 'Renamed preschool_id to school_id in transactions table';
        END IF;
    END IF;
END $$;

-- Create the missing get_petty_cash_summary function with correct parameter names
CREATE OR REPLACE FUNCTION public.get_petty_cash_summary(
  preschool_uuid UUID,  -- Keep the parameter name as expected by TypeScript
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  total_expenses NUMERIC,
  total_replenishments NUMERIC,
  total_adjustments NUMERIC,
  transaction_count INTEGER,
  pending_count INTEGER,
  current_balance NUMERIC,
  is_low_balance BOOLEAN,
  low_balance_threshold NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date TIMESTAMPTZ;
    v_end_date TIMESTAMPTZ;
    v_opening_balance NUMERIC := 0;
    v_low_threshold NUMERIC := 1000.00;
    v_current_balance NUMERIC := 0;
BEGIN
    -- Set default date range if not provided
    v_start_date := COALESCE(start_date, date_trunc('month', NOW()));
    v_end_date := COALESCE(end_date, NOW());

    -- Get account info (using school_id which should now be correct)
    SELECT COALESCE(pca.opening_balance, 0), COALESCE(pca.low_balance_threshold, 1000.00)
    INTO v_opening_balance, v_low_threshold
    FROM public.petty_cash_accounts pca 
    WHERE pca.school_id = preschool_uuid 
    AND pca.is_active = true
    LIMIT 1;

    -- Calculate current balance from opening balance plus all approved transactions
    SELECT v_opening_balance + COALESCE(SUM(
        CASE 
            WHEN t.type = 'expense' THEN -t.amount
            WHEN t.type = 'replenishment' THEN t.amount
            WHEN t.type = 'adjustment' THEN t.amount
            ELSE 0
        END
    ), 0)
    INTO v_current_balance
    FROM public.petty_cash_transactions t
    WHERE t.school_id = preschool_uuid 
    AND t.status = 'approved';

    RETURN QUERY
    SELECT 
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'approved' THEN t.amount ELSE 0 END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN t.type = 'replenishment' AND t.status = 'approved' THEN t.amount ELSE 0 END), 0) as total_replenishments,
        COALESCE(SUM(CASE WHEN t.type = 'adjustment' AND t.status = 'approved' THEN t.amount ELSE 0 END), 0) as total_adjustments,
        COUNT(CASE WHEN t.status = 'approved' THEN 1 END)::INTEGER as transaction_count,
        COUNT(CASE WHEN t.status = 'pending' THEN 1 END)::INTEGER as pending_count,
        v_current_balance as current_balance,
        (v_current_balance < v_low_threshold) as is_low_balance,
        v_low_threshold as low_balance_threshold
    FROM public.petty_cash_transactions t 
    WHERE t.school_id = preschool_uuid
    AND (start_date IS NULL OR t.created_at >= v_start_date)
    AND (end_date IS NULL OR t.created_at <= v_end_date);
END;
$$;

-- Grant permissions on the function
GRANT EXECUTE ON FUNCTION public.get_petty_cash_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.get_petty_cash_summary(
  UUID, TIMESTAMPTZ, TIMESTAMPTZ
) IS 'Returns petty cash summary statistics with current balance calculation';
