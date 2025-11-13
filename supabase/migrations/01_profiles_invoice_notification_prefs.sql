-- ================================================
-- Invoice Notification Preferences Migration
-- Add notification preferences and digital signature support to profiles
-- ================================================

-- 1) Add invoice notification preferences JSONB column with safe defaults
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS invoice_notification_preferences JSONB NOT NULL DEFAULT '{
  "channels": {
    "email": true,
    "push": false,
    "sms": false
  },
  "events": {
    "new_invoice": {
      "email": true,
      "push": false
    },
    "invoice_sent": {
      "email": true,
      "push": false
    },
    "overdue_reminder": {
      "email": true,
      "push": false,
      "cadence_days": [1, 3, 7]
    },
    "payment_confirmed": {
      "email": true,
      "push": false
    },
    "invoice_viewed": {
      "email": false,
      "push": false
    }
  },
  "email_include_signature": true,
  "pdf_include_signature": true,
  "digest": {
    "overdue_daily": false,
    "weekly_summary": false
  }
}'::JSONB;

-- 2) Add signature metadata columns
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS signature_public_id TEXT,
ADD COLUMN IF NOT EXISTS signature_updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3) Create index for JSONB queries (future-proofing)
CREATE INDEX IF NOT EXISTS idx_profiles_invoice_prefs
ON profiles USING gin (invoice_notification_preferences);

-- 4) Update RLS policies to ensure users can update only their own preferences/signature
-- First check if the policy exists and drop it if needed
DROP POLICY IF EXISTS "update own notification prefs" ON profiles;

-- Create policy for updating own notification preferences and signature
CREATE POLICY "update own notification prefs"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5) Backfill existing users with default preferences (if any don't have it)
UPDATE profiles
SET invoice_notification_preferences = '{
  "channels": {
    "email": true,
    "push": false,
    "sms": false
  },
  "events": {
    "new_invoice": {
      "email": true,
      "push": false
    },
    "invoice_sent": {
      "email": true,
      "push": false
    },
    "overdue_reminder": {
      "email": true,
      "push": false,
      "cadence_days": [1, 3, 7]
    },
    "payment_confirmed": {
      "email": true,
      "push": false
    },
    "invoice_viewed": {
      "email": false,
      "push": false
    }
  },
  "email_include_signature": true,
  "pdf_include_signature": true,
  "digest": {
    "overdue_daily": false,
    "weekly_summary": false
  }
}'::JSONB
WHERE invoice_notification_preferences IS NULL;

-- 6) Add comment for documentation
COMMENT ON COLUMN profiles.invoice_notification_preferences IS 'JSONB storing user preferences for invoice-related notifications including channels, events, and signature inclusion settings';
COMMENT ON COLUMN profiles.signature_url IS 'Storage path for user digital signature image';
COMMENT ON COLUMN profiles.signature_public_id IS 'Public ID/path for signature file management';
COMMENT ON COLUMN profiles.signature_updated_at IS 'Timestamp of last signature update';
