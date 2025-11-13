-- Direct SQL to fix the missing columns and schema issues
-- Run this directly in Supabase SQL Editor

-- 1. Add missing settings column to preschools table
ALTER TABLE public.preschools 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::JSONB;

-- 2. Add missing phone column if it doesn't exist
ALTER TABLE public.preschools 
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_preschools_settings 
ON public.preschools USING gin(settings);

-- 4. Add comment
COMMENT ON COLUMN public.preschools.settings IS 'School configuration settings in JSON format';
COMMENT ON COLUMN public.preschools.phone IS 'School primary phone number';

-- 5. Reload PostgREST schema
SELECT pg_notify('pgrst', 'reload schema');

-- 6. Verify the columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'preschools' 
AND table_schema = 'public'
AND column_name IN ('settings', 'phone');