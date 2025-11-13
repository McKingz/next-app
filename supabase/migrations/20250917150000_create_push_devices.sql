-- Create push_devices table for push notifications
-- This table stores device registration information for push notifications

-- Create push_devices table
CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  is_active boolean DEFAULT TRUE NOT NULL,
  device_installation_id text,
  device_metadata jsonb DEFAULT '{}',
  language text DEFAULT 'en' CHECK (language IN ('en', 'af', 'zu', 'st')),
  timezone text DEFAULT 'UTC',
  last_seen_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create unique constraint on user_id and device_installation_id
-- This prevents duplicate registrations per device per user
CREATE UNIQUE INDEX IF NOT EXISTS push_devices_user_device_idx
ON public.push_devices (user_id, device_installation_id);

-- Create index for active devices
CREATE INDEX IF NOT EXISTS push_devices_active_idx
ON public.push_devices (is_active, last_seen_at) WHERE is_active = TRUE;

-- Create index for token lookups by notifications dispatcher
CREATE INDEX IF NOT EXISTS push_devices_token_lookup_idx
ON public.push_devices (expo_push_token) WHERE is_active = TRUE;

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION public.push_devices_set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER push_devices_updated_at_trigger
BEFORE UPDATE ON public.push_devices
FOR EACH ROW
EXECUTE FUNCTION public.push_devices_set_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Users can only see and manage their own push devices
CREATE POLICY "Users can view their own push devices" ON public.push_devices
FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own push devices
CREATE POLICY "Users can insert their own push devices" ON public.push_devices
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own push devices
CREATE POLICY "Users can update their own push devices" ON public.push_devices
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own push devices
CREATE POLICY "Users can delete their own push devices" ON public.push_devices
FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all push devices (for admin operations)
CREATE POLICY "Service role can manage all push devices" ON public.push_devices
FOR ALL USING (
  current_setting('role', TRUE) = 'service_role'
  OR auth.jwt() ->> 'role' = 'service_role'
);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;

-- Add comment for documentation
COMMENT ON TABLE public.push_devices IS
'Stores push notification device registrations for users. Each user can have multiple devices registered.';

COMMENT ON COLUMN public.push_devices.expo_push_token IS
'Expo push token for sending notifications to this specific device';

COMMENT ON COLUMN public.push_devices.device_installation_id IS
'Unique identifier for the device installation to prevent duplicate registrations';

COMMENT ON COLUMN public.push_devices.device_metadata IS
'JSON object containing device information like model, OS version, app version, etc.';

COMMENT ON COLUMN public.push_devices.language IS
'Preferred language for notifications to this device';

COMMENT ON COLUMN public.push_devices.timezone IS
'Device timezone for scheduling notifications at appropriate times';
