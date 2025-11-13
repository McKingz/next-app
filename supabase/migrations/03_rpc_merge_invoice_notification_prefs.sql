-- ================================================
-- RPC Function for Merging Invoice Notification Preferences
-- Safely merges partial updates with existing JSONB preferences
-- ================================================

CREATE OR REPLACE FUNCTION merge_invoice_notification_prefs(
  p_user_id UUID,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_prefs JSONB;
  merged_prefs JSONB;
  default_prefs JSONB := '{
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
BEGIN
  -- Verify the user exists and is the authenticated user
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only update own preferences';
  END IF;
  
  -- Get current preferences
  SELECT invoice_notification_preferences 
  INTO current_prefs
  FROM profiles 
  WHERE id = p_user_id;
  
  -- If no current preferences, use defaults
  IF current_prefs IS NULL THEN
    current_prefs := default_prefs;
  END IF;
  
  -- Deep merge the updates with current preferences
  -- This preserves nested structure while updating only provided fields
  merged_prefs := jsonb_deep_merge(current_prefs, COALESCE(p_updates, '{}'::jsonb));
  
  -- Update the profile
  UPDATE profiles
  SET invoice_notification_preferences = merged_prefs,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Verify update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found or update failed';
  END IF;
  
  RETURN merged_prefs;
END;
$$;

-- Create helper function for deep JSON merging if it doesn't exist
CREATE OR REPLACE FUNCTION jsonb_deep_merge(left_json JSONB, right_json JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result JSONB := left_json;
  key TEXT;
  value JSONB;
BEGIN
  -- Iterate through each key-value pair in right_json
  FOR key, value IN SELECT * FROM jsonb_each(right_json)
  LOOP
    -- If the key exists in left_json and both values are objects, merge recursively
    IF result ? key AND jsonb_typeof(result->key) = 'object' AND jsonb_typeof(value) = 'object' THEN
      result := jsonb_set(result, ARRAY[key], jsonb_deep_merge(result->key, value));
    ELSE
      -- Otherwise, simply set the value from right_json
      result := jsonb_set(result, ARRAY[key], value);
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION merge_invoice_notification_prefs(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION jsonb_deep_merge(JSONB, JSONB) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION merge_invoice_notification_prefs IS 'Securely merges partial updates into user invoice notification preferences JSONB';
COMMENT ON FUNCTION jsonb_deep_merge IS 'Helper function to perform deep merge of two JSONB objects';
