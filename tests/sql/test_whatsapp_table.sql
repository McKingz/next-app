-- Test if whatsapp_contacts table exists and has correct structure
-- This is just for testing, not a migration

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'whatsapp_contacts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Also test if the enum type exists
SELECT 
  enumlabel
FROM pg_enum pe
JOIN pg_type pt ON pe.enumtypid = pt.oid
WHERE pt.typname = 'whatsapp_consent_status'
ORDER BY enumsortorder;