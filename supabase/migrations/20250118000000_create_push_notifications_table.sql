-- Create push_notifications table for storing sent notification records
-- This table tracks all notifications sent to users for analytics and debugging

-- Drop the table if it exists to avoid conflicts
DROP TABLE IF EXISTS public.push_notifications CASCADE;

-- Create push_notifications table
CREATE TABLE public.push_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'delivered', 'error')),
  expo_receipt_id text,
  notification_type text NOT NULL,
  preschool_id uuid REFERENCES public.preschools (id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  delivered_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0 NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS push_notifications_user_idx
ON public.push_notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS push_notifications_status_idx
ON public.push_notifications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS push_notifications_type_idx
ON public.push_notifications (notification_type, preschool_id, created_at DESC);

CREATE INDEX IF NOT EXISTS push_notifications_preschool_idx
ON public.push_notifications (preschool_id, created_at DESC) WHERE preschool_id IS NOT NULL;

-- Enable Row Level Security (RLS)
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (with proper error handling)

-- Users can only see their own notifications
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_notifications' AND policyname = 'Users can view their own notifications') THEN
        CREATE POLICY "Users can view their own notifications" ON public.push_notifications
            FOR SELECT USING (auth.uid() = recipient_user_id);
    END IF;
END $$;

-- Service role can manage all notifications (for admin operations and Edge Functions)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_notifications' AND policyname = 'Service role can manage all notifications') THEN
        CREATE POLICY "Service role can manage all notifications" ON public.push_notifications
            FOR ALL USING (
                current_setting('role', true) = 'service_role' OR
                auth.jwt() ->> 'role' = 'service_role'
            );
    END IF;
END $$;

-- Superadmins can view all notifications (read-only for monitoring)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_notifications' AND policyname = 'Superadmins can view all notifications') THEN
        CREATE POLICY "Superadmins can view all notifications" ON public.push_notifications
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role = 'super_admin' 
                    AND is_active = true
                )
            );
    END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT ON public.push_notifications TO authenticated;
GRANT ALL ON public.push_notifications TO service_role;

-- Add comments for documentation
COMMENT ON TABLE public.push_notifications IS
'Records of all push notifications sent to users for analytics, debugging, and compliance tracking.';

COMMENT ON COLUMN public.push_notifications.expo_receipt_id IS
'Expo push receipt ID for tracking delivery status of the notification.';

COMMENT ON COLUMN public.push_notifications.data IS
'JSON payload sent with the notification for routing and context.';

COMMENT ON COLUMN public.push_notifications.notification_type IS
'Type of notification (new_message, homework_graded, etc.) for categorization and filtering.';
