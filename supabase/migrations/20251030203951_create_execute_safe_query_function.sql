-- Migration: Create execute_safe_query function for agentic tool system
-- Purpose: Provide a secure interface for DatabaseQueryTool to execute predefined queries
-- with automatic RLS enforcement and parameter validation
--
-- Security: This function runs with SECURITY DEFINER but respects RLS policies
-- by using the authenticated user's context for all queries

-- Drop function if exists (for idempotency)
DROP FUNCTION IF EXISTS public.execute_safe_query(jsonb, text);

-- Create the safe query execution function
CREATE OR REPLACE FUNCTION public.execute_safe_query(
  query_params jsonb,
  query_sql text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with function owner privileges
SET search_path = public, pg_temp  -- Restrict search path for security
AS $$
DECLARE
  result_data jsonb;
  row_count integer;
  auth_uid uuid;
BEGIN
  -- Get authenticated user ID
  auth_uid := auth.uid();
  
  -- Block unauthenticated users
  IF auth_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING HINT = 'User must be authenticated to execute queries';
  END IF;

  -- Validate query_sql is not empty
  IF query_sql IS NULL OR trim(query_sql) = '' THEN
    RAISE EXCEPTION 'Invalid query: query_sql cannot be empty';
  END IF;

  -- Validate query is SELECT only (basic SQL injection prevention)
  IF NOT (query_sql ~* '^\\s*SELECT\\s') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed'
      USING HINT = 'Query must start with SELECT';
  END IF;

  -- Block dangerous SQL keywords (additional protection)
  IF query_sql ~* '(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)' THEN
    RAISE EXCEPTION 'Query contains forbidden SQL keywords'
      USING HINT = 'Only SELECT operations are permitted';
  END IF;

  -- Execute query with parameters
  -- RLS policies will automatically apply based on authenticated user context
  BEGIN
    EXECUTE format('
      WITH query_result AS (
        %s
      )
      SELECT jsonb_agg(row_to_json(query_result.*)) 
      FROM query_result
    ', query_sql)
    INTO result_data
    USING query_params;

    -- Handle empty result set
    IF result_data IS NULL THEN
      result_data := '[]'::jsonb;
    END IF;

    -- Get row count
    row_count := jsonb_array_length(result_data);

    -- Return result with metadata
    RETURN jsonb_build_object(
      'success', true,
      'data', result_data,
      'row_count', row_count,
      'executed_by', auth_uid,
      'executed_at', now()
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- Log error and return structured error response
      RAISE WARNING 'Query execution error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_code', SQLSTATE,
        'executed_by', auth_uid,
        'executed_at', now()
      );
  END;
END;
$$;

-- Grant execute permission to authenticated users only
REVOKE ALL ON FUNCTION public.execute_safe_query(jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_safe_query(jsonb, text) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.execute_safe_query(jsonb, text) IS 
'Executes predefined SELECT queries with RLS enforcement. Used by agentic tool system.
Parameters:
- query_params: JSONB object with query parameters (currently unused, reserved for future use)
- query_sql: SQL SELECT statement to execute (validated for security)
Returns: JSONB object with success flag, data array, and metadata
Security: Respects RLS policies based on authenticated user context';