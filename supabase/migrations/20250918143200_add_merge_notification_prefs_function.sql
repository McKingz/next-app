-- ================================================
-- Invoice Notification Preferences Merge Function
-- Provides safe JSONB merging for partial preference updates
-- ================================================

-- Create function to safely merge invoice notification preferences
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
BEGIN
  -- Security: Ensure user can only update their own preferences
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: Cannot update preferences for other users';
  END IF;

  -- Get current preferences
  SELECT invoice_notification_preferences INTO current_prefs
  FROM profiles 
  WHERE id = p_user_id;

  -- If no current preferences exist, use empty object
  current_prefs := COALESCE(current_prefs, '{}'::JSONB);

  -- Perform deep merge of JSONB objects
  -- This preserves nested structure while allowing partial updates
  merged_prefs := jsonb_deep_merge(current_prefs, COALESCE(p_updates, '{}'::JSONB));

  -- Update the preferences in the database
  UPDATE profiles
  SET 
    invoice_notification_preferences = merged_prefs,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Return the merged preferences
  RETURN merged_prefs;
END;
$$;

-- Drop existing function to avoid parameter name conflicts
DROP FUNCTION IF EXISTS jsonb_deep_merge(JSONB, JSONB);

-- Create helper function for deep JSONB merging
CREATE FUNCTION jsonb_deep_merge(target JSONB, source JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  key TEXT;
  value JSONB;
  result JSONB := target;
BEGIN
  -- Iterate through each key-value pair in source
  FOR key, value IN SELECT * FROM jsonb_each(source) LOOP
    -- If both target and source have the same key and both are objects, merge recursively
    IF target ? key AND jsonb_typeof(target->key) = 'object' AND jsonb_typeof(value) = 'object' THEN
      result := result || jsonb_build_object(key, jsonb_deep_merge(target->key, value));
    ELSE
      -- Otherwise, overwrite with source value
      result := result || jsonb_build_object(key, value);
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION merge_invoice_notification_prefs(UUID, JSONB) IS
'Safely merges partial updates into user invoice notification preferences with security checks';

COMMENT ON FUNCTION jsonb_deep_merge(JSONB, JSONB) IS
'Recursively merges two JSONB objects, preserving nested structure';

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION merge_invoice_notification_prefs(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION jsonb_deep_merge(JSONB, JSONB) TO authenticated;
