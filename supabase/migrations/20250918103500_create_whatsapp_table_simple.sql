-- Create WhatsApp contacts table if it doesn't exist
-- Simple version to avoid migration conflicts

-- Create enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE public.whatsapp_consent_status AS ENUM ('pending','opted_in','opted_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  wa_user_id TEXT,
  consent_status public.WHATSAPP_CONSENT_STATUS NOT NULL DEFAULT 'pending',
  last_opt_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.whatsapp_contacts 
  ADD CONSTRAINT whatsapp_contacts_unique_user_per_school 
  UNIQUE (preschool_id, user_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Enable RLS
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy for authenticated users
DO $$ BEGIN
  CREATE POLICY "whatsapp_contacts_policy" ON public.whatsapp_contacts
    FOR ALL TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_contacts TO authenticated;
