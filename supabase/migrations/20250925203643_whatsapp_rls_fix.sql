-- Fix WhatsApp Contacts RLS Policies
-- Resolves 406 errors by simplifying RLS policies and ensuring proper access

-- 1. Drop all existing conflicting policies
DROP POLICY IF EXISTS whatsapp_contacts_policy ON public.whatsapp_contacts;
DROP POLICY IF EXISTS whatsapp_select_own_contact ON public.whatsapp_contacts;
DROP POLICY IF EXISTS whatsapp_insert_own_contact ON public.whatsapp_contacts;
DROP POLICY IF EXISTS whatsapp_update_own_contact ON public.whatsapp_contacts;
DROP POLICY IF EXISTS whatsapp_contacts_tenant_isolation ON public.whatsapp_contacts;

-- 2. Ensure table exists with proper structure
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  wa_user_id TEXT,
  consent_status TEXT NOT NULL DEFAULT 'pending' CHECK (consent_status IN ('pending', 'opted_in', 'opted_out')),
  last_opt_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure unique constraint
  CONSTRAINT whatsapp_contacts_unique_user_per_school UNIQUE (preschool_id, user_id)
);

-- 3. Enable RLS
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- 4. Create simple, working RLS policy
CREATE POLICY whatsapp_contacts_access ON public.whatsapp_contacts
FOR ALL TO authenticated
USING (
  user_id = auth.uid()
  OR
  preschool_id IN (
    SELECT organization_id
    FROM public.profiles
    WHERE
      id = auth.uid()
      AND organization_id IS NOT NULL
  )
);

-- 5. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_contacts TO authenticated;

-- 6. Add helpful indexes
CREATE INDEX IF NOT EXISTS whatsapp_contacts_user_preschool_idx
ON public.whatsapp_contacts (user_id, preschool_id);
CREATE INDEX IF NOT EXISTS whatsapp_contacts_phone_idx
ON public.whatsapp_contacts (phone_e164);
CREATE INDEX IF NOT EXISTS whatsapp_contacts_consent_idx
ON public.whatsapp_contacts (consent_status)
WHERE consent_status = 'opted_in';

-- 7. Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END $$;

DROP TRIGGER IF EXISTS whatsapp_contacts_updated_at ON public.whatsapp_contacts;
CREATE TRIGGER whatsapp_contacts_updated_at
BEFORE UPDATE ON public.whatsapp_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Add helpful comment
COMMENT ON TABLE public.whatsapp_contacts IS 'WhatsApp contacts with simplified RLS - Fixed 406 errors';
