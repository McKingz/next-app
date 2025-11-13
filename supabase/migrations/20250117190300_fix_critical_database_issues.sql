-- Migration: Fix Critical Database Issues (Simplified)
-- Created: 2025-01-17 19:03:00
-- Description: Focus on critical authentication and core table fixes
-- Strategy: Fix what's broken first, optimize later

-- =============================================================================
-- 1. FIX AUTHENTICATION - Add missing capabilities column to profiles
-- =============================================================================
DO $$ 
BEGIN
    -- Check if capabilities column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'capabilities'
    ) THEN
        -- Add capabilities column
        ALTER TABLE public.profiles ADD COLUMN capabilities jsonb DEFAULT '{}'::jsonb;
        
        -- Update existing profiles with role-based capabilities
        UPDATE public.profiles 
        SET capabilities = CASE 
            WHEN role = 'superadmin' THEN 
                jsonb_build_object(
                    'can_manage_all_schools', true,
                    'can_access_admin_panel', true, 
                    'can_manage_billing', true,
                    'can_view_analytics', true,
                    'can_manage_users', true
                )
            WHEN role = 'principal' THEN 
                jsonb_build_object(
                    'can_manage_school', true,
                    'can_manage_teachers', true,
                    'can_view_reports', true,
                    'can_manage_billing', true,
                    'can_manage_classes', true
                )
            WHEN role = 'teacher' THEN 
                jsonb_build_object(
                    'can_manage_classes', true,
                    'can_create_lessons', true,
                    'can_assign_homework', true,
                    'can_view_student_progress', true,
                    'can_grade_assignments', true
                )
            WHEN role = 'parent' THEN 
                jsonb_build_object(
                    'can_view_child_progress', true,
                    'can_communicate_with_teachers', true,
                    'can_pay_fees', true,
                    'can_view_announcements', true
                )
            ELSE '{}'::jsonb
        END
        WHERE capabilities IS NULL OR capabilities = '{}'::jsonb;
        
    END IF;
END $$;

-- =============================================================================
-- 2. FIX PUSH_DEVICES SCHEMA - Add missing device_id column
-- =============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'push_devices' 
        AND column_name = 'device_id'
    ) THEN
        -- Add device_id column
        ALTER TABLE public.push_devices ADD COLUMN device_id text;
        
        -- Generate device IDs for existing records
        UPDATE public.push_devices 
        SET device_id = 'device_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 12)
        WHERE device_id IS NULL;
        
        -- Make it NOT NULL and add unique constraint
        ALTER TABLE public.push_devices 
        ALTER COLUMN device_id SET NOT NULL;
        
        -- Add unique constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'push_devices' 
            AND constraint_name = 'push_devices_device_id_key'
        ) THEN
            ALTER TABLE public.push_devices 
            ADD CONSTRAINT push_devices_device_id_key UNIQUE (device_id);
        END IF;
    END IF;
END $$;

-- =============================================================================
-- 3. CREATE MISSING CORE TABLES (simplified, no complex RLS policies yet)
-- =============================================================================

-- 3.1 SEATS TABLE - Manage subscription seat allocations
CREATE TABLE IF NOT EXISTS public.seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  seat_type text NOT NULL CHECK (seat_type IN ('teacher', 'student')),
  assigned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  UNIQUE (subscription_id, user_id)
);

-- 3.2 LESSON_ACTIVITIES TABLE - Activities within lessons
CREATE TABLE IF NOT EXISTS public.lesson_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  activity_type text NOT NULL CHECK (activity_type IN ('quiz', 'video', 'reading', 'exercise', 'game', 'assignment')),
  content jsonb DEFAULT '{}'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  duration_minutes integer DEFAULT 15,
  is_required boolean DEFAULT TRUE,
  points_possible integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.3 ACTIVITY_ATTEMPTS TABLE - Student attempts at activities
CREATE TABLE IF NOT EXISTS public.activity_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.lesson_activities (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  score decimal(5, 2),
  max_score decimal(5, 2) DEFAULT 100.00,
  answers jsonb DEFAULT '{}'::jsonb,
  time_spent_seconds integer DEFAULT 0,
  attempts_count integer DEFAULT 1,
  is_submitted boolean DEFAULT FALSE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.4 PARENT_CHILD_LINKS TABLE - Link parents to their children
CREATE TABLE IF NOT EXISTS public.parent_child_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  relationship text DEFAULT 'parent' CHECK (relationship IN ('parent', 'guardian', 'caregiver', 'grandparent')),
  is_primary boolean DEFAULT FALSE,
  can_pick_up boolean DEFAULT TRUE,
  emergency_contact boolean DEFAULT FALSE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  UNIQUE (parent_id, child_id),
  CHECK (parent_id != child_id)
);

-- 3.5 CHILD_REGISTRATION_REQUESTS TABLE - Handle new child registrations
CREATE TABLE IF NOT EXISTS public.child_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,
  child_first_name text NOT NULL,
  child_last_name text NOT NULL,
  child_birth_date date NOT NULL,
  child_gender text CHECK (child_gender IN ('male', 'female', 'other')),
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_info text,
  dietary_requirements text,
  special_needs text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  notes text,
  requested_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users (id),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.6 PARENT_PAYMENTS TABLE - Track parent payments
CREATE TABLE IF NOT EXISTS public.parent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions (id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text DEFAULT 'ZAR',
  payment_method text DEFAULT 'payfast' CHECK (payment_method IN ('payfast', 'eft', 'cash', 'card', 'bank_transfer')),
  payment_reference text,
  external_reference text, -- PayFast or other gateway reference
  status text DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')
  ),
  paid_at timestamptz,
  due_date date,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.7 SUBSCRIPTION_INVOICES TABLE - Invoice management
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions (id) ON DELETE CASCADE,
  invoice_number text UNIQUE NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text DEFAULT 'ZAR',
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  invoice_date date DEFAULT current_date,
  due_date date,
  paid_at timestamptz,
  payment_reference text,
  line_items jsonb DEFAULT '[]'::jsonb,
  tax_amount_cents integer DEFAULT 0,
  discount_amount_cents integer DEFAULT 0,
  total_amount_cents integer GENERATED ALWAYS AS (amount_cents + tax_amount_cents - discount_amount_cents) STORED,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.8 PAYFAST_ITN_LOGS TABLE - PayFast webhook logs
CREATE TABLE IF NOT EXISTS public.payfast_itn_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text,
  merchant_key text,
  return_url text,
  cancel_url text,
  notify_url text,
  name_first text,
  name_last text,
  email_address text,
  m_payment_id text,
  amount decimal(10, 2),
  item_name text,
  item_description text,
  payment_status text,
  pf_payment_id text,
  signature text,
  raw_post_data text,
  ip_address inet,
  processed_at timestamptz DEFAULT now(),
  is_valid boolean,
  processing_notes text,
  related_payment_id uuid REFERENCES public.parent_payments (id),
  created_at timestamptz DEFAULT now()
);

-- 3.9 PUSH_NOTIFICATIONS TABLE - Notification queue and history
CREATE TABLE IF NOT EXISTS public.push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users (id) ON DELETE CASCADE,
  preschool_id uuid REFERENCES public.preschools (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  notification_type text DEFAULT 'general' CHECK (
    notification_type IN ('general', 'homework', 'announcement', 'payment', 'emergency', 'reminder')
  ),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  scheduled_for timestamptz DEFAULT now(),
  sent_at timestamptz,
  delivery_status text DEFAULT 'pending' CHECK (
    delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'expired')
  ),
  expo_receipt_id text,
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3.10 AD_IMPRESSIONS TABLE - Ad monetization tracking
CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users (id) ON DELETE CASCADE,
  preschool_id uuid REFERENCES public.preschools (id) ON DELETE CASCADE,
  ad_unit_id text NOT NULL,
  ad_network text DEFAULT 'admob' CHECK (ad_network IN ('admob', 'facebook', 'unity', 'ironsource')),
  ad_type text NOT NULL CHECK (ad_type IN ('banner', 'interstitial', 'rewarded', 'native')),
  impression_id text,
  revenue_micros bigint DEFAULT 0,
  currency_code text DEFAULT 'ZAR',
  device_info jsonb DEFAULT '{}'::jsonb,
  app_version text,
  placement text,
  shown_at timestamptz DEFAULT now(),
  clicked_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 3.11 ORG_INVITES TABLE - Organization invitations
CREATE TABLE IF NOT EXISTS public.org_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('principal', 'teacher', 'parent')),
  invite_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES public.users (id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 4. ENABLE ROW LEVEL SECURITY (Basic setup)
-- =============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_child_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payfast_itn_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- Ensure existing critical tables have RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. CREATE BASIC INDEXES FOR PERFORMANCE
-- =============================================================================

-- Core relationship indexes
CREATE INDEX IF NOT EXISTS idx_seats_subscription_user ON public.seats (subscription_id, user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_activities_lesson_order ON public.lesson_activities (lesson_id, order_index);
CREATE INDEX IF NOT EXISTS idx_activity_attempts_student_activity ON public.activity_attempts (student_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_parent ON public.parent_child_links (parent_id);
CREATE INDEX IF NOT EXISTS idx_child_reg_requests_preschool_status ON public.child_registration_requests (
  preschool_id, status
);
CREATE INDEX IF NOT EXISTS idx_parent_payments_parent_status ON public.parent_payments (parent_id, status);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription ON public.subscription_invoices (subscription_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_user_status ON public.push_notifications (user_id, delivery_status);
CREATE INDEX IF NOT EXISTS idx_org_invites_email_status ON public.org_invites (email, status);

-- =============================================================================
-- 6. CREATE UPDATE TRIGGERS
-- =============================================================================

-- Ensure updated_at function exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply updated_at triggers to new tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY[
            'seats', 'lesson_activities', 'activity_attempts', 'parent_child_links',
            'child_registration_requests', 'parent_payments', 'subscription_invoices',
            'push_notifications', 'org_invites'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS handle_updated_at ON public.%I;
            CREATE TRIGGER handle_updated_at 
            BEFORE UPDATE ON public.%I 
            FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()
        ', t, t);
    END LOOP;
END $$;

-- =============================================================================
-- 7. CREATE HELPER FUNCTIONS
-- =============================================================================

-- Function to get user capabilities
CREATE OR REPLACE FUNCTION public.get_user_capabilities(user_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_capabilities jsonb;
BEGIN
    SELECT capabilities INTO user_capabilities
    FROM public.profiles
    WHERE auth_user_id = user_uuid;
    
    RETURN COALESCE(user_capabilities, '{}'::jsonb);
END;
$$;

-- Function to check user capability
CREATE OR REPLACE FUNCTION public.user_has_capability(user_uuid uuid, capability_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_capabilities jsonb;
BEGIN
    user_capabilities := public.get_user_capabilities(user_uuid);
    RETURN (user_capabilities->capability_name)::boolean = true;
END;
$$;
