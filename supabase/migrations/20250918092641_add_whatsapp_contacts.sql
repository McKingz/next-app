-- WhatsApp Contacts Table Migration
-- Adds missing whatsapp_contacts table with proper RLS and tenant isolation
-- Follows WARP.md rules: migration-only, no resets, strict RLS

-- 1) Consent status enum
DO $$ BEGIN
  CREATE TYPE public.whatsapp_consent_status AS ENUM ('pending','opted_in','opted_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) WhatsApp contacts table
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  wa_user_id TEXT,
  consent_status public.WHATSAPP_CONSENT_STATUS NOT NULL DEFAULT 'pending',
  last_opt_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Indexes and constraints for performance and uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_contacts_unique_user_per_school
ON public.whatsapp_contacts (preschool_id, user_id);

CREATE INDEX IF NOT EXISTS whatsapp_contacts_phone_idx
ON public.whatsapp_contacts (preschool_id, phone_e164);

CREATE INDEX IF NOT EXISTS whatsapp_contacts_user_idx
ON public.whatsapp_contacts (user_id);

CREATE INDEX IF NOT EXISTS whatsapp_contacts_wa_user_idx
ON public.whatsapp_contacts (wa_user_id);

CREATE INDEX IF NOT EXISTS whatsapp_contacts_consent_idx
ON public.whatsapp_contacts (consent_status) WHERE consent_status = 'opted_in';

-- 4) Updated_at trigger (reuse existing function if present)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END $$;

DROP TRIGGER IF EXISTS set_updated_at ON public.whatsapp_contacts;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.whatsapp_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Row Level Security - Enable and create policies
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Select policy: users can only see their own contacts in their current preschool
DROP POLICY IF EXISTS whatsapp_select_own_contact ON public.whatsapp_contacts;
CREATE POLICY whatsapp_select_own_contact
ON public.whatsapp_contacts FOR SELECT TO authenticated
USING (user_id = auth.uid() AND preschool_id = public.current_preschool_id());

-- Insert policy: users can only insert their own contacts in their current preschool
DROP POLICY IF EXISTS whatsapp_insert_own_contact ON public.whatsapp_contacts;
CREATE POLICY whatsapp_insert_own_contact
ON public.whatsapp_contacts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND preschool_id = public.current_preschool_id());

-- Update policy: users can only update their own contacts in their current preschool
DROP POLICY IF EXISTS whatsapp_update_own_contact ON public.whatsapp_contacts;
CREATE POLICY whatsapp_update_own_contact
ON public.whatsapp_contacts FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND preschool_id = public.current_preschool_id())
WITH CHECK (user_id = auth.uid() AND preschool_id = public.current_preschool_id());

-- No delete policy - deny by default, service role manages deletions server-side

-- 6) Table documentation
COMMENT ON TABLE public.whatsapp_contacts IS
'End-user WhatsApp contact and consent state, per preschool. Enforces tenant isolation via RLS.';

COMMENT ON COLUMN public.whatsapp_contacts.phone_e164 IS
'Phone number in E.164 international format (+country + number)';

COMMENT ON COLUMN public.whatsapp_contacts.consent_status IS
'User consent state: pending (initial), opted_in (can receive messages), opted_out (no messages)';

COMMENT ON COLUMN public.whatsapp_contacts.wa_user_id IS
'WhatsApp Business API user identifier (optional, populated by provider)';
