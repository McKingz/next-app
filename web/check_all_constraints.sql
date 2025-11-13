-- Check ALL constraints on ai_usage_logs table
SELECT
    conname AS constraint_name,
    contype AS constraint_type_code,
    CASE contype
        WHEN 'f' THEN 'Foreign Key'
        WHEN 'p' THEN 'Primary Key'
        WHEN 'u' THEN 'Unique'
        WHEN 'c' THEN 'Check'
        WHEN 't' THEN 'Trigger'
        ELSE 'Other'
    END AS constraint_type,
    pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'ai_usage_logs'
ORDER BY contype, conname;

-- Also check NOT NULL constraints (these are stored differently)
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'ai_usage_logs'
ORDER BY ordinal_position;
