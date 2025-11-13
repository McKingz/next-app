-- ================================================
-- Invoice Notification Preferences Migration
-- Adds invoice notification preferences and digital signature support to profiles
-- ================================================

-- 1) Add invoice notification preferences JSONB column with comprehensive defaults
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
  }';

-- 2) Add digital signature metadata columns
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS signature_public_id TEXT,
ADD COLUMN IF NOT EXISTS signature_updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3) Add GIN index for efficient JSONB queries on notification preferences
CREATE INDEX IF NOT EXISTS idx_profiles_invoice_notification_prefs
ON profiles USING gin (invoice_notification_preferences);

-- 4) Update RLS policy to allow users to update their own notification preferences and signature
DROP POLICY IF EXISTS "Users can update own notification preferences" ON profiles;
CREATE POLICY "Users can update own notification preferences"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5) Comment the new columns for documentation
COMMENT ON COLUMN profiles.invoice_notification_preferences IS 'User preferences for invoice notification events and channels';
COMMENT ON COLUMN profiles.signature_url IS 'Storage path to user digital signature file';
COMMENT ON COLUMN profiles.signature_public_id IS 'Public identifier for signature file in storage';
COMMENT ON COLUMN profiles.signature_updated_at IS 'Timestamp when signature was last updated';
