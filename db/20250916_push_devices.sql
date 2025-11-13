-- Create push_devices table, unique index, updated_at trigger, and RLS policies
-- Safe to run multiple times (IF NOT EXISTS where possible)

-- 1) Table
CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text CHECK (platform IN ('web', 'ios', 'android')) DEFAULT 'web',
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Unique constraint/index for on_conflict=user_id,expo_push_token
CREATE UNIQUE INDEX IF NOT EXISTS push_devices_user_token_idx
ON public.push_devices (user_id, expo_push_token);

-- 3) updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
begin
  new.updated_at := now();
  return new;
end $$;

DROP TRIGGER IF EXISTS trg_push_devices_updated_at ON public.push_devices;
CREATE TRIGGER trg_push_devices_updated_at
BEFORE UPDATE ON public.push_devices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) RLS policies (owner-only)
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

-- Postgres does not support IF NOT EXISTS for CREATE POLICY.
-- Use DROP POLICY IF EXISTS to make this idempotent.

DROP POLICY IF EXISTS push_devices_select_own ON public.push_devices;
CREATE POLICY push_devices_select_own
ON public.push_devices
FOR SELECT
USING (auth.uid() = user_id);


DROP POLICY IF EXISTS push_devices_insert_own ON public.push_devices;
CREATE POLICY push_devices_insert_own
ON public.push_devices
FOR INSERT
WITH CHECK (auth.uid() = user_id);


DROP POLICY IF EXISTS push_devices_update_own ON public.push_devices;
CREATE POLICY push_devices_update_own
ON public.push_devices
FOR UPDATE
USING (auth.uid() = user_id);


DROP POLICY IF EXISTS push_devices_delete_own ON public.push_devices;
CREATE POLICY push_devices_delete_own
ON public.push_devices
FOR DELETE
USING (auth.uid() = user_id);
