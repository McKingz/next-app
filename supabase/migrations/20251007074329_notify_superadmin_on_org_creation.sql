-- Migration: Notify superadmins when new organizations are created
-- Purpose: Auto-activate organizations and alert superadmins for awareness
-- Implementation: Database trigger + push notification queue

-- Function to notify superadmins about new organization creation
CREATE OR REPLACE FUNCTION public.notify_superadmins_on_org_creation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_superadmin_record RECORD;
  v_creator_name TEXT;
  v_notification_count INTEGER := 0;
BEGIN
  -- Only proceed if this is a new organization creation
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  -- Get the creator's name for the notification
  SELECT COALESCE(
    NULLIF(TRIM(first_name || ' ' || last_name), ''),
    email,
    'Unknown User'
  )
  INTO v_creator_name
  FROM public.profiles
  WHERE id = NEW.created_by;
  
  -- Insert a notification for each active superadmin
  FOR v_superadmin_record IN (
    SELECT p.id, p.email
    FROM public.profiles p
    WHERE p.role = 'superadmin'
      AND p.is_active = true
      AND p.id != NEW.created_by  -- Don't notify if superadmin created their own org
  )
  LOOP
    BEGIN
      INSERT INTO public.push_notifications (
        recipient_user_id,
        title,
        body,
        data,
        status,
        notification_type,
        preschool_id
      )
      VALUES (
        v_superadmin_record.id,
        'New Organization Created',
        'Organization "' || NEW.name || '" was created by ' || v_creator_name || ' and is now active.',
        jsonb_build_object(
          'organization_id', NEW.id,
          'organization_name', NEW.name,
          'organization_type', NEW.type,
          'creator_id', NEW.created_by,
          'creator_name', v_creator_name,
          'created_at', NEW.created_at,
          'notification_category', 'organization_management'
        ),
        'sent',
        'organization_created',
        NEW.id
      );
      
      v_notification_count := v_notification_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Failed to create notification for superadmin %: %', 
        v_superadmin_record.email, SQLERRM;
    END;
  END LOOP;
  
  -- Log successful notifications (optional)
  IF v_notification_count > 0 THEN
    RAISE NOTICE 'Created % notification(s) for new organization: %', 
      v_notification_count, NEW.name;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on organizations table
DROP TRIGGER IF EXISTS trigger_notify_superadmins_on_org_creation ON public.organizations;

CREATE TRIGGER trigger_notify_superadmins_on_org_creation
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_superadmins_on_org_creation();

-- Add comments for documentation
COMMENT ON FUNCTION public.notify_superadmins_on_org_creation IS
'Automatically creates push notification records for all active superadmins when a new '
'organization is created. Part of Option A: auto-activate organizations while notifying superadmins.';

COMMENT ON TRIGGER trigger_notify_superadmins_on_org_creation ON public.organizations IS
'Triggers superadmin notifications when new organizations are created. '
'Notifications are queued in push_notifications table for delivery by Edge Functions or cron jobs.';