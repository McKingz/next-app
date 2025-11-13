-- Enhance push_devices table with device fingerprinting and metadata
-- Safe to run multiple times

-- Add new columns if they don't exist
ALTER TABLE public.push_devices
ADD COLUMN IF NOT EXISTS device_installation_id text,
ADD COLUMN IF NOT EXISTS device_metadata jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- Update the unique constraint to use device_installation_id instead of just expo_push_token
-- This allows the same token on multiple devices but prevents duplicate registrations per device per user
DROP INDEX IF EXISTS push_devices_user_token_idx;
CREATE UNIQUE INDEX IF NOT EXISTS push_devices_user_device_idx
ON public.push_devices (user_id, device_installation_id);

-- Add index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS push_devices_active_idx
ON public.push_devices (is_active, last_seen_at) WHERE is_active = TRUE;

-- Add index for token lookups by the notifications dispatcher
CREATE INDEX IF NOT EXISTS push_devices_token_lookup_idx
ON public.push_devices (expo_push_token) WHERE is_active = TRUE;
