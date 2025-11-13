-- Create RPC function to update user last login timestamp
-- This function updates the last_login_at field for the currently authenticated user
-- Used by sessionManager.ts during sign-in process

CREATE OR REPLACE FUNCTION public.update_user_last_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update last_login_at for the current authenticated user
  UPDATE public.users
  SET last_login_at = NOW(),
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_last_login() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.update_user_last_login() IS 'Updates last_login_at for current user; used during sign-in.';
