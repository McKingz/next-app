-- Force create WhatsApp contacts table
-- This migration ensures the table exists even if previous attempts failed

-- Drop and recreate enum to ensure it exists
DROP TYPE IF EXISTS public.whatsapp_consent_status CASCADE;
CREATE TYPE public.whatsapp_consent_status AS ENUM ('pending', 'opted_in', 'opted_out');

-- Drop table if it exists (in case it was partially created)
DROP TABLE IF EXISTS public.whatsapp_contacts CASCADE;

-- Create table
CREATE TABLE public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  wa_user_id text,
  consent_status public.whatsapp_consent_status NOT NULL DEFAULT 'pending',
  last_opt_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Add unique constraint
  CONSTRAINT whatsapp_contacts_unique_user_per_school UNIQUE (preschool_id, user_id)
);

-- Add indexes
CREATE INDEX whatsapp_contacts_phone_idx ON public.whatsapp_contacts (preschool_id, phone_e164);
CREATE INDEX whatsapp_contacts_user_idx ON public.whatsapp_contacts (user_id);
CREATE INDEX whatsapp_contacts_consent_idx ON public.whatsapp_contacts (consent_status) WHERE consent_status
= 'opted_in';

-- Enable RLS
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY whatsapp_contacts_policy ON public.whatsapp_contacts
FOR ALL TO authenticated
USING (user_id = auth.uid());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_contacts TO authenticated;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END $$;

CREATE TRIGGER whatsapp_contacts_updated_at
BEFORE UPDATE ON public.whatsapp_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add comments
COMMENT ON TABLE public.whatsapp_contacts IS 'WhatsApp contact information and consent status for users';
COMMENT ON COLUMN public.whatsapp_contacts.phone_e164 IS 'Phone number in E.164 format';
COMMENT ON COLUMN public.whatsapp_contacts.consent_status IS 'User consent for WhatsApp messaging';
