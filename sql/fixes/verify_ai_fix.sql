-- Verify the AI usage schema fix migration results

-- Check if Claude service exists
SELECT 'Claude AI Service Status:' as check_type, 
       COUNT(*) as count,
       CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END as status
FROM public.ai_services 
WHERE name = 'Claude' AND provider = 'anthropic';

-- Check ai_usage_logs table structure
SELECT 'AI Usage Logs Columns:' as check_type,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if preschool_id column exists
SELECT 'Preschool ID Column:' as check_type,
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'ai_usage_logs' 
           AND column_name = 'preschool_id' 
           AND table_schema = 'public'
       ) THEN 'EXISTS' ELSE 'MISSING' END as status;

-- Check constraints on response_time_ms
SELECT 'Response Time Constraints:' as check_type,
       constraint_name,
       constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'ai_usage_logs' 
AND table_schema = 'public'
AND constraint_name LIKE '%response_time%';

-- Check if decrement_ai_credits function exists
SELECT 'Decrement Credits Function:' as check_type,
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.routines 
           WHERE routine_name = 'decrement_ai_credits' 
           AND routine_schema = 'public'
       ) THEN 'EXISTS' ELSE 'MISSING' END as status;