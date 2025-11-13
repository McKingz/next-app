-- Add missing language column to push_devices table
-- This column is required by the notifications-dispatcher edge function

-- Add language column if it doesn't exist
ALTER TABLE public.push_devices
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en' CHECK (language IN ('en', 'af', 'zu', 'st'));

-- Add timezone column as well (from the full migration draft)
ALTER TABLE public.push_devices
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Johannesburg';

-- Update the existing records to have default language
UPDATE public.push_devices
SET language = 'en'
WHERE language IS NULL;

UPDATE public.push_devices
SET timezone = 'Africa/Johannesburg'
WHERE timezone IS NULL;

-- Add an index for better performance on language queries
CREATE INDEX IF NOT EXISTS push_devices_language_idx ON public.push_devices (language);
