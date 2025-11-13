-- Create missing payment-related tables and functions
-- These are needed for PayFast integration and subscription management

-- =============================================================================
-- CREATE SUBSCRIPTION_SEATS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_seats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users (id) ON DELETE CASCADE,
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid REFERENCES public.users (id),
  is_active boolean DEFAULT TRUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_seats_subscription_id ON public.subscription_seats (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_seats_user_id ON public.subscription_seats (user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_seats_active ON public.subscription_seats (subscription_id, is_active);

-- Enable RLS
ALTER TABLE public.subscription_seats ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see seats for their school's subscription
CREATE POLICY "Users can view subscription seats for their school"
ON public.subscription_seats FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.subscriptions AS s
    INNER JOIN public.users AS u ON s.school_id = u.preschool_id
    WHERE
      s.id = subscription_id
      AND u.auth_user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = u.user_id AND u.auth_user_id = auth.uid()
  )
);

-- =============================================================================
-- PAYFAST_ITN_LOGS TABLE ALREADY EXISTS
-- =============================================================================
-- Note: payfast_itn_logs table already exists with proper schema
-- Just ensure RLS is enabled and add missing indexes if needed

-- Enable RLS (only superadmins can access payment logs)
ALTER TABLE public.payfast_itn_logs ENABLE ROW LEVEL SECURITY;

-- Create policy if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payfast_itn_logs' 
        AND policyname = 'Only superadmins can access PayFast logs'
    ) THEN
        CREATE POLICY "Only superadmins can access PayFast logs"
        ON public.payfast_itn_logs FOR ALL
        USING (
            EXISTS (
                SELECT 1 FROM public.users u
                WHERE u.auth_user_id = auth.uid() AND u.role = 'superadmin'
            )
        );
    END IF;
END
$$;

-- Add useful indexes for existing columns
CREATE INDEX IF NOT EXISTS idx_payfast_itn_logs_m_payment_id ON public.payfast_itn_logs (m_payment_id);
CREATE INDEX IF NOT EXISTS idx_payfast_itn_logs_pf_payment_id ON public.payfast_itn_logs (pf_payment_id);
CREATE INDEX IF NOT EXISTS idx_payfast_itn_logs_payment_status ON public.payfast_itn_logs (payment_status);
CREATE INDEX IF NOT EXISTS idx_payfast_itn_logs_created_at ON public.payfast_itn_logs (created_at);

-- =============================================================================
-- CREATE ASSIGN_TEACHER_SEAT FUNCTION
-- =============================================================================
-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS public.assign_teacher_seat(uuid, uuid);

CREATE OR REPLACE FUNCTION public.assign_teacher_seat(
  p_subscription_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription_record record;
    v_current_seats_used integer;
    v_seat_id uuid;
    v_result jsonb;
BEGIN
    -- Get subscription details
    SELECT * INTO v_subscription_record
    FROM public.subscriptions
    WHERE id = p_subscription_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Subscription not found'
        );
    END IF;
    
    -- Check if user already has a seat
    SELECT id INTO v_seat_id
    FROM public.subscription_seats
    WHERE subscription_id = p_subscription_id
    AND user_id = p_user_id
    AND is_active = true;
    
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User already has an active seat'
        );
    END IF;
    
    -- Count current active seats
    SELECT COUNT(*) INTO v_current_seats_used
    FROM public.subscription_seats
    WHERE subscription_id = p_subscription_id
    AND is_active = true;
    
    -- Check if we have available seats
    IF v_current_seats_used >= v_subscription_record.seats_total THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No available seats remaining'
        );
    END IF;
    
    -- Assign the seat
    INSERT INTO public.subscription_seats (
        subscription_id,
        user_id,
        assigned_by
    ) VALUES (
        p_subscription_id,
        p_user_id,
        (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    )
    RETURNING id INTO v_seat_id;
    
    -- Update subscription seats_used count
    UPDATE public.subscriptions
    SET 
        seats_used = v_current_seats_used + 1,
        updated_at = now()
    WHERE id = p_subscription_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'seat_id', v_seat_id,
        'seats_used', v_current_seats_used + 1,
        'seats_total', v_subscription_record.seats_total
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.assign_teacher_seat(uuid, uuid) TO authenticated;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE public.subscription_seats IS 'Tracks which users are assigned to subscription seats';
-- Note: payfast_itn_logs table already exists - not creating new comment
COMMENT ON FUNCTION public.assign_teacher_seat IS 'Assigns a teacher to a subscription seat with validation';
