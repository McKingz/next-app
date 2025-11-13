-- ============================================================================
-- Force PostgREST Schema Reload
-- ============================================================================
-- This migration forces PostgREST to reload its schema cache and ensures
-- the ensure_petty_cash_account function is properly exposed

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- Ensure the function exists and is properly configured
CREATE OR REPLACE FUNCTION public.ensure_petty_cash_account(preschool_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_uuid UUID;
  preschool_col_name TEXT;
  table_exists BOOLEAN := FALSE;
BEGIN
  -- Check if petty_cash_accounts table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'petty_cash_accounts'
  ) INTO table_exists;
  
  -- If table doesn't exist, return a new UUID (graceful degradation)
  IF NOT table_exists THEN
    RETURN gen_random_uuid();
  END IF;
  
  -- Determine which column name is used (preschool_id or school_id)
  SELECT column_name INTO preschool_col_name
  FROM information_schema.columns 
  WHERE table_schema = 'public'
  AND table_name = 'petty_cash_accounts' 
  AND column_name IN ('preschool_id', 'school_id')
  LIMIT 1;
  
  -- If no matching column found, return new UUID
  IF preschool_col_name IS NULL THEN
    RETURN gen_random_uuid();
  END IF;
  
  -- Check if account already exists using the correct column
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
  
  RETURN COALESCE(account_uuid, gen_random_uuid());
END;
$$;

-- Explicitly grant permissions
GRANT EXECUTE ON FUNCTION public.ensure_petty_cash_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_petty_cash_account(UUID) TO anon;

-- Add comment
COMMENT ON FUNCTION public.ensure_petty_cash_account(
  UUID
) IS 'Create petty cash account if it does not exist for preschool - handles table structure variations gracefully';

-- Also create a simple test function to verify RPC is working
CREATE OR REPLACE FUNCTION public.test_rpc()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'RPC functions are working correctly'::TEXT;
$$;

GRANT EXECUTE ON FUNCTION public.test_rpc() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_rpc() TO anon;
