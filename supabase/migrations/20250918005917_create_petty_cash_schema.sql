-- Migration: Create petty cash management schema
-- Author: EduDash Pro
-- Date: 2025-01-18
-- Description: Creates tables and functions for petty cash account management

-- Create petty_cash_accounts table
CREATE TABLE IF NOT EXISTS public.petty_cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  initial_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  current_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users (id),

  -- Constraints
  CONSTRAINT petty_cash_accounts_name_preschool_unique UNIQUE (preschool_id, name),
  CONSTRAINT petty_cash_accounts_balance_positive CHECK (current_balance >= 0)
);

-- Add columns to existing petty_cash_transactions table if they don't exist
DO $$ 
BEGIN
    -- Add account_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'petty_cash_transactions' AND column_name = 'account_id') THEN
        ALTER TABLE public.petty_cash_transactions 
        ADD COLUMN account_id UUID REFERENCES public.petty_cash_accounts(id) ON DELETE CASCADE;
    END IF;
    
    -- Add transaction_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'petty_cash_transactions' AND column_name = 'transaction_type') THEN
        ALTER TABLE public.petty_cash_transactions 
        ADD COLUMN transaction_type VARCHAR(20) CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer'));
    END IF;
    
    -- Add category column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'petty_cash_transactions' AND column_name = 'category') THEN
        ALTER TABLE public.petty_cash_transactions 
        ADD COLUMN category VARCHAR(100);
    END IF;
    
    -- Add reference_number column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'petty_cash_transactions' AND column_name = 'reference_number') THEN
        ALTER TABLE public.petty_cash_transactions 
        ADD COLUMN reference_number VARCHAR(100);
    END IF;
    
    -- Add receipt_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'petty_cash_transactions' AND column_name = 'receipt_url') THEN
        ALTER TABLE public.petty_cash_transactions 
        ADD COLUMN receipt_url TEXT;
    END IF;
    
    -- Add transaction_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'petty_cash_transactions' AND column_name = 'transaction_date') THEN
        ALTER TABLE public.petty_cash_transactions 
        ADD COLUMN transaction_date DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_petty_cash_accounts_preschool ON public.petty_cash_accounts (preschool_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_accounts_active ON public.petty_cash_accounts (is_active) WHERE is_active
= TRUE;

-- Create indexes on petty_cash_transactions only if columns exist
DO $$
BEGIN
    -- Create account_id index if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'petty_cash_transactions' AND column_name = 'account_id') THEN
        CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_account ON public.petty_cash_transactions(account_id);
    END IF;
    
    -- Create transaction_date index if column exists  
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'petty_cash_transactions' AND column_name = 'transaction_date') THEN
        CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_date ON public.petty_cash_transactions(transaction_date DESC);
    END IF;
    
    -- Create transaction_type index if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'petty_cash_transactions' AND column_name = 'transaction_type') THEN
        CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_type ON public.petty_cash_transactions(transaction_type);
    END IF;
END $$;

-- Always create preschool_id index (this column should exist)
CREATE INDEX IF NOT EXISTS idx_petty_cash_transactions_preschool ON public.petty_cash_transactions (preschool_id);

-- Create RLS policies
ALTER TABLE public.petty_cash_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_transactions ENABLE ROW LEVEL SECURITY;

-- Petty cash accounts policies
CREATE POLICY "Users can view petty cash accounts in their preschool"
ON public.petty_cash_accounts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE
      p.id = auth.uid()
      AND p.preschool_id = petty_cash_accounts.preschool_id
  )
);

CREATE POLICY "Principals and admins can manage petty cash accounts"
ON public.petty_cash_accounts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE
      p.id = auth.uid()
      AND p.preschool_id = petty_cash_accounts.preschool_id
      AND p.role IN ('principal', 'admin', 'superadmin')
  )
);

-- Petty cash transactions policies
CREATE POLICY "Users can view petty cash transactions in their preschool"
ON public.petty_cash_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE
      p.id = auth.uid()
      AND p.preschool_id = petty_cash_transactions.preschool_id
  )
);

CREATE POLICY "Principals and admins can manage petty cash transactions"
ON public.petty_cash_transactions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE
      p.id = auth.uid()
      AND p.preschool_id = petty_cash_transactions.preschool_id
      AND p.role IN ('principal', 'admin', 'superadmin')
  )
);

-- Create function to get petty cash summary
CREATE OR REPLACE FUNCTION public.get_petty_cash_summary(
  p_preschool_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_accounts INTEGER,
  active_accounts INTEGER,
  total_balance DECIMAL(10, 2),
  total_deposits DECIMAL(10, 2),
  total_withdrawals DECIMAL(10, 2),
  net_flow DECIMAL(10, 2),
  transaction_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Set default date range if not provided
    v_start_date := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE)::DATE);
    v_end_date := COALESCE(p_end_date, CURRENT_DATE);

    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_accounts,
        COUNT(*) FILTER (WHERE is_active = true)::INTEGER as active_accounts,
        COALESCE(SUM(current_balance), 0)::DECIMAL(10,2) as total_balance,
        COALESCE(
            (SELECT SUM(amount) 
             FROM public.petty_cash_transactions t 
             WHERE t.preschool_id = p_preschool_id 
             AND t.transaction_type = 'deposit'
             AND t.transaction_date BETWEEN v_start_date AND v_end_date
            ), 0
        )::DECIMAL(10,2) as total_deposits,
        COALESCE(
            (SELECT SUM(amount) 
             FROM public.petty_cash_transactions t 
             WHERE t.preschool_id = p_preschool_id 
             AND t.transaction_type = 'withdrawal'
             AND t.transaction_date BETWEEN v_start_date AND v_end_date
            ), 0
        )::DECIMAL(10,2) as total_withdrawals,
        COALESCE(
            (SELECT SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END)
             FROM public.petty_cash_transactions t 
             WHERE t.preschool_id = p_preschool_id 
             AND t.transaction_type IN ('deposit', 'withdrawal')
             AND t.transaction_date BETWEEN v_start_date AND v_end_date
            ), 0
        )::DECIMAL(10,2) as net_flow,
        COALESCE(
            (SELECT COUNT(*)
             FROM public.petty_cash_transactions t 
             WHERE t.preschool_id = p_preschool_id 
             AND t.transaction_date BETWEEN v_start_date AND v_end_date
            ), 0
        )::INTEGER as transaction_count
    FROM public.petty_cash_accounts 
    WHERE preschool_id = p_preschool_id;
END;
$$;

-- Grant permissions on the function
GRANT EXECUTE ON FUNCTION public.get_petty_cash_summary(UUID, DATE, DATE) TO authenticated;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_petty_cash_accounts_updated_at
BEFORE UPDATE ON public.petty_cash_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default petty cash account for existing preschools
INSERT INTO public.petty_cash_accounts (preschool_id, name, description, initial_balance, current_balance)
SELECT
  id AS preschool_id,
  'Main Petty Cash' AS name,
  'Primary petty cash account for daily expenses' AS description,
  0.00 AS initial_balance,
  0.00 AS current_balance
FROM public.preschools
ON CONFLICT (preschool_id, name) DO NOTHING;

-- Add audit logging
COMMENT ON TABLE public.petty_cash_accounts IS 'Petty cash accounts for preschools to manage small daily expenses';
COMMENT ON TABLE public.petty_cash_transactions IS 'Individual transactions for petty cash accounts with full audit trail';
COMMENT ON FUNCTION public.get_petty_cash_summary(
  UUID, DATE, DATE
) IS 'Returns summary statistics for petty cash accounts and transactions within date range';
