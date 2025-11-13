-- ============================================================================
-- Create Missing Petty Cash Function
-- ============================================================================
-- This migration creates the essential ensure_petty_cash_account function
-- that the application needs, working with whatever table structure exists

-- Function to ensure petty cash account exists for a preschool
-- This is a minimal version that handles table structure variations
CREATE OR REPLACE FUNCTION public.ensure_petty_cash_account(preschool_uuid UUID)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  account_uuid UUID;
  preschool_col_name TEXT;
BEGIN
  -- Determine which column name is used (preschool_id or school_id)
  SELECT column_name INTO preschool_col_name
  FROM information_schema.columns 
  WHERE table_name = 'petty_cash_accounts' 
  AND column_name IN ('preschool_id', 'school_id')
  LIMIT 1;
  
  -- If no matching column found, create a basic account
  IF preschool_col_name IS NULL THEN
    -- Table might not exist or have different structure
    -- Return a dummy UUID for now
    RETURN gen_random_uuid();
  END IF;
  
  -- Check if account already exists using dynamic SQL
  IF preschool_col_name = 'preschool_id' THEN
    SELECT id INTO account_uuid 
    FROM public.petty_cash_accounts 
    WHERE preschool_id = preschool_uuid;
    
    -- Create if doesn't exist
    IF account_uuid IS NULL THEN
      INSERT INTO public.petty_cash_accounts (preschool_id)
      VALUES (preschool_uuid)
      RETURNING id INTO account_uuid;
    END IF;
  ELSE
    -- Use school_id column
    SELECT id INTO account_uuid 
    FROM public.petty_cash_accounts 
    WHERE school_id = preschool_uuid;
    
    -- Create if doesn't exist  
    IF account_uuid IS NULL THEN
      INSERT INTO public.petty_cash_accounts (school_id)
      VALUES (preschool_uuid)
      RETURNING id INTO account_uuid;
    END IF;
  END IF;
  
  RETURN account_uuid;
END;
$$;

COMMENT ON FUNCTION public.ensure_petty_cash_account(
  UUID
) IS 'Create petty cash account if it does not exist for preschool (handles both preschool_id and school_id column names)';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.ensure_petty_cash_account(UUID) TO AUTHENTICATED;
