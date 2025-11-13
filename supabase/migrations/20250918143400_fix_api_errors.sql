-- Fix API errors and reload schema
-- This migration addresses the 406 and 400 errors by ensuring proper table access

-- First ensure whatsapp_contacts table has proper RLS policies
ALTER TABLE IF EXISTS public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Ensure preschools table allows phone and settings access
-- (These columns should already exist, this is just verification)
DO $$
BEGIN
  -- Check if phone column exists in preschools
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'preschools' 
    AND column_name = 'phone' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.preschools ADD COLUMN phone TEXT;
  END IF;

  -- Check if settings column exists in preschools  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'preschools' 
    AND column_name = 'settings' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.preschools ADD COLUMN settings JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

-- Reload PostgREST schema to pick up any changes
SELECT pg_notify('pgrst', 'reload schema');

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

-- Comment for debugging
COMMENT ON TABLE public.whatsapp_contacts IS 'WhatsApp contacts with proper RLS - API ready';
COMMENT ON TABLE public.preschools IS 'Preschools table with phone and settings columns';
