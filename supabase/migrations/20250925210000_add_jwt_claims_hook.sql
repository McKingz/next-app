-- JWT Claims Hook for preschool_id
-- This migration adds a custom claims hook to set preschool_id in JWT tokens

-- ============================================================================
-- PART 1: JWT CLAIMS FUNCTION
-- ============================================================================

-- Function to add custom claims to JWT tokens
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
AS $$
DECLARE
  claims JSONB;
  user_id UUID;
  user_preschool_id UUID;
  user_role TEXT;
  user_organization_id UUID;
BEGIN
  -- Extract the user ID from the event
  user_id := (event->>'user_id')::UUID;
  
  -- Get the current claims
  claims := event->'claims';
  
  -- Get user's preschool_id and role from the users table
  SELECT 
    preschool_id, 
    role,
    preschool_id -- Also use as organization_id for compatibility
  INTO 
    user_preschool_id, 
    user_role,
    user_organization_id
  FROM users 
  WHERE auth_user_id = user_id OR id = user_id
  LIMIT 1;
  
  -- If no user found in users table, try profiles table as fallback
  IF user_preschool_id IS NULL THEN
    SELECT 
      preschool_id,
      role,
      preschool_id
    INTO 
      user_preschool_id,
      user_role,
      user_organization_id
    FROM profiles 
    WHERE id = user_id
    LIMIT 1;
  END IF;
  
  -- Add custom claims to the JWT token
  IF user_preschool_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{preschool_id}', to_jsonb(user_preschool_id::TEXT));
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(user_organization_id::TEXT));
  END IF;
  
  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
    claims := jsonb_set(claims, '{role}', to_jsonb(user_role));
  END IF;
  
  -- Log the claims being set (for debugging)
  RAISE LOG 'Setting JWT claims for user %: preschool_id=%, role=%', 
    user_id, user_preschool_id, user_role;
  
  -- Return the event with updated claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION PUBLIC.CUSTOM_ACCESS_TOKEN_HOOK TO SUPABASE_AUTH_ADMIN;
GRANT EXECUTE ON FUNCTION PUBLIC.CUSTOM_ACCESS_TOKEN_HOOK TO POSTGRES;
GRANT EXECUTE ON FUNCTION PUBLIC.CUSTOM_ACCESS_TOKEN_HOOK TO AUTHENTICATED;
GRANT EXECUTE ON FUNCTION PUBLIC.CUSTOM_ACCESS_TOKEN_HOOK TO SERVICE_ROLE;

-- ============================================================================
-- PART 2: UPDATE CURRENT_PRESCHOOL_ID FUNCTION
-- ============================================================================

-- Update the current_preschool_id function to read from JWT claims
CREATE OR REPLACE FUNCTION current_preschool_id()
RETURNS UUID AS $$
DECLARE
  preschool_id_claim TEXT;
  result_uuid UUID;
BEGIN
  -- Try to get preschool_id from JWT claims first
  preschool_id_claim := auth.jwt() ->> 'preschool_id';
  
  -- If found in JWT, convert to UUID and return
  IF preschool_id_claim IS NOT NULL AND preschool_id_claim != '' THEN
    BEGIN
      result_uuid := preschool_id_claim::UUID;
      RETURN result_uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      -- If conversion fails, fall through to fallback methods
      RAISE LOG 'Invalid UUID in JWT preschool_id claim: %', preschool_id_claim;
    END;
  END IF;
  
  -- Fallback: try organization_id claim
  preschool_id_claim := auth.jwt() ->> 'organization_id';
  IF preschool_id_claim IS NOT NULL AND preschool_id_claim != '' THEN
    BEGIN
      result_uuid := preschool_id_claim::UUID;
      RETURN result_uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE LOG 'Invalid UUID in JWT organization_id claim: %', preschool_id_claim;
    END;
  END IF;
  
  -- Final fallback: lookup from users table using auth.uid()
  IF auth.uid() IS NOT NULL THEN
    SELECT preschool_id INTO result_uuid
    FROM users 
    WHERE auth_user_id = auth.uid() OR id = auth.uid()
    LIMIT 1;
    
    IF result_uuid IS NOT NULL THEN
      RAISE LOG 'Using fallback preschool_id lookup for user %: %', auth.uid(), result_uuid;
      RETURN result_uuid;
    END IF;
  END IF;
  
  -- If all else fails, return NULL (will cause RLS to deny access)
  RAISE LOG 'No preschool_id found for user %', auth.uid();
  RETURN NULL;
END;
$$ LANGUAGE PLPGSQL SECURITY DEFINER;

-- ============================================================================
-- PART 3: HELPER FUNCTION FOR CURRENT USER ROLE
-- ============================================================================

-- Function to get current user role from JWT
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    auth.jwt() ->> 'user_role',
    auth.jwt() ->> 'role',
    'parent'  -- Default fallback
  );
END;
$$ LANGUAGE PLPGSQL SECURITY DEFINER;

-- ============================================================================
-- PART 4: ENABLE THE HOOK
-- ============================================================================

-- Note: The hook needs to be enabled via Supabase Dashboard or CLI
-- This cannot be done via SQL migration due to security restrictions
-- 
-- To enable the hook:
-- 1. Go to Supabase Dashboard > Authentication > Hooks
-- 2. Add a new hook with:
--    - Hook name: custom_access_token_hook
--    - Type: Custom Access Token
--    - Function: public.custom_access_token_hook
--    - Secrets: (none needed)
--
-- Or use the Supabase CLI:
-- supabase secrets set --project-ref YOUR_PROJECT_REF AUTH_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/public/custom_access_token_hook

-- ============================================================================
-- PART 5: VERIFICATION QUERY
-- ============================================================================

-- Function to test JWT claims (for debugging)
CREATE OR REPLACE FUNCTION test_jwt_claims()
RETURNS TABLE (
  USER_ID UUID,
  PRESCHOOL_ID_CLAIM TEXT,
  ORGANIZATION_ID_CLAIM TEXT,
  ROLE_CLAIM TEXT,
  COMPUTED_PRESCHOOL_ID UUID,
  COMPUTED_ROLE TEXT
) AS $$
BEGIN
  RETURN QUERY SELECT
    auth.uid() as user_id,
    auth.jwt() ->> 'preschool_id' as preschool_id_claim,
    auth.jwt() ->> 'organization_id' as organization_id_claim,
    auth.jwt() ->> 'role' as role_claim,
    current_preschool_id() as computed_preschool_id,
    current_user_role() as computed_role;
END;
$$ LANGUAGE PLPGSQL SECURITY DEFINER;

-- Grant execute permissions for testing
GRANT EXECUTE ON FUNCTION TEST_JWT_CLAIMS TO AUTHENTICATED;
GRANT EXECUTE ON FUNCTION TEST_JWT_CLAIMS TO SERVICE_ROLE;

-- ============================================================================
-- PART 6: COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION public.custom_access_token_hook IS 'Custom JWT claims hook that adds preschool_id and role to access tokens for RLS policies';
COMMENT ON FUNCTION current_preschool_id IS 'Returns the current user preschool_id from JWT claims or database fallback';
COMMENT ON FUNCTION current_user_role IS 'Returns the current user role from JWT claims';
COMMENT ON FUNCTION test_jwt_claims IS 'Test function to verify JWT claims are working correctly';
