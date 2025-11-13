-- Add missing phone and settings columns to preschools table
-- Fixes API 400 errors for missing columns

-- 1. Add missing settings column to preschools table
ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::JSONB;

-- 2. Add missing phone column if it doesn't exist  
ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS phone TEXT;

-- 3. Create index for performance on settings column
CREATE INDEX IF NOT EXISTS idx_preschools_settings
ON public.preschools USING gin (settings);

-- 4. Add helpful comments
COMMENT ON COLUMN public.preschools.settings IS 'School configuration settings in JSON format';
COMMENT ON COLUMN public.preschools.phone IS 'School primary phone number';

-- 5. Reload PostgREST schema to make columns available via API
SELECT pg_notify('pgrst', 'reload schema');
