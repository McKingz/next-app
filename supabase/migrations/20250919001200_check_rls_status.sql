-- Check current RLS status and existing policies
-- This will help us understand what needs to be restored

-- Check which tables have RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE
    WHEN rowsecurity THEN 'RLS ENABLED'
    ELSE 'RLS DISABLED'
  END AS status
FROM pg_tables AS pt
INNER JOIN pg_class AS pc ON pt.tablename = pc.relname
WHERE
  pt.schemaname = 'public'
  AND pt.tablename NOT LIKE 'pg_%'
ORDER BY pt.tablename;

-- Check existing RLS policies  
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Count of tables with RLS enabled vs disabled
SELECT
  CASE WHEN rowsecurity THEN 'RLS Enabled' ELSE 'RLS Disabled' END AS status,
  COUNT(*) AS table_count
FROM pg_tables AS pt
INNER JOIN pg_class AS pc ON pt.tablename = pc.relname
WHERE
  pt.schemaname = 'public'
  AND pt.tablename NOT LIKE 'pg_%'
GROUP BY rowsecurity;

SELECT 'RLS Status Check Complete' AS result;
