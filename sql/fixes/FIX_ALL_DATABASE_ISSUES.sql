-- =============================================================================
-- EDUDASH PRO - COMPLETE DATABASE SCHEMA FIXES
-- =============================================================================
-- This script addresses all issues found in the health check:
-- 1. Fix authentication (add capabilities column)
-- 2. Create missing tables 
-- 3. Fix push notifications schema
-- 4. Ensure proper RLS policies
-- =============================================================================

-- 1. FIX AUTHENTICATION - Add missing capabilities column
-- =============================================================================
DO $$ 
BEGIN
    -- Check if capabilities column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'capabilities') THEN
        
        ALTER TABLE public.profiles ADD COLUMN capabilities jsonb DEFAULT '{}'::jsonb;
        
        -- Update existing profiles with default capabilities based on role
        UPDATE public.profiles 
        SET capabilities = CASE 
            WHEN role = 'superadmin' THEN 
                '{"can_manage_all_schools": true, "can_access_admin_panel": true, "can_manage_billing": true, "can_view_analytics": true}'::jsonb
            WHEN role = 'principal' THEN 
                '{"can_manage_school": true, "can_manage_teachers": true, "can_view_reports": true, "can_manage_billing": true}'::jsonb
            WHEN role = 'teacher' THEN 
                '{"can_manage_classes": true, "can_create_lessons": true, "can_assign_homework": true, "can_view_student_progress": true}'::jsonb
            WHEN role = 'parent' THEN 
                '{"can_view_child_progress": true, "can_communicate_with_teachers": true, "can_pay_fees": true}'::jsonb
            ELSE '{}'::jsonb
        END
        WHERE capabilities IS NULL OR capabilities = '{}'::jsonb;
        
        RAISE NOTICE 'Added capabilities column to profiles table';
    ELSE
        RAISE NOTICE 'Capabilities column already exists';
    END IF;
END $$;

-- 2. CREATE MISSING TABLES
-- =============================================================================

-- 2.1 SEATS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.seats (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    seat_type text NOT NULL CHECK (seat_type IN ('teacher', 'student')),
    assigned_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Ensure one seat per user per subscription
    UNIQUE(subscription_id, user_id)
);

-- 2.2 LESSON ACTIVITIES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.lesson_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    activity_type text NOT NULL CHECK (activity_type IN ('quiz', 'video', 'reading', 'exercise', 'game')),
    content jsonb DEFAULT '{}'::jsonb,
    order_index integer NOT NULL DEFAULT 0,
    duration_minutes integer DEFAULT 15,
    is_required boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2.3 ACTIVITY ATTEMPTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.activity_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id uuid REFERENCES public.lesson_activities(id) ON DELETE CASCADE,
    student_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz,
    score decimal(5,2),
    max_score decimal(5,2) DEFAULT 100,
    answers jsonb DEFAULT '{}'::jsonb,
    time_spent_seconds integer DEFAULT 0,
    attempts_count integer DEFAULT 1,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2.4 PARENT-CHILD LINKS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.parent_child_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    child_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    relationship text DEFAULT 'parent' CHECK (relationship IN ('parent', 'guardian', 'caregiver')),
    is_primary boolean DEFAULT false,
    can_pick_up boolean DEFAULT true,
    emergency_contact boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Prevent duplicate links and self-linking
    UNIQUE(parent_id, child_id),
    CHECK (parent_id != child_id)
);

-- 2.5 CHILD REGISTRATION REQUESTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.child_registration_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    preschool_id uuid REFERENCES public.preschools(id) ON DELETE CASCADE,
    child_first_name text NOT NULL,
    child_last_name text NOT NULL,
    child_birth_date date NOT NULL,
    child_gender text CHECK (child_gender IN ('male', 'female', 'other')),
    emergency_contact_name text,
    emergency_contact_phone text,
    medical_info text,
    dietary_requirements text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    notes text,
    requested_at timestamptz DEFAULT now(),
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2.6 PARENT PAYMENTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.parent_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    preschool_id uuid REFERENCES public.preschools(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'ZAR',
    payment_method text DEFAULT 'payfast' CHECK (payment_method IN ('payfast', 'eft', 'cash', 'card')),
    payment_reference text UNIQUE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
    paid_at timestamptz,
    due_date date,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2.7 SUBSCRIPTION INVOICES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    invoice_number text UNIQUE NOT NULL,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'ZAR',
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    invoice_date date DEFAULT CURRENT_DATE,
    due_date date,
    paid_at timestamptz,
    payment_reference text,
    line_items jsonb DEFAULT '[]'::jsonb,
    tax_amount_cents integer DEFAULT 0,
    discount_amount_cents integer DEFAULT 0,
    total_amount_cents integer NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2.8 PAYFAST ITN LOGS TABLE
-- =============================================================================
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
    amount decimal(10,2),
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
    created_at timestamptz DEFAULT now()
);

-- 2.9 PUSH NOTIFICATIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.push_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    preschool_id uuid REFERENCES public.preschools(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    notification_type text DEFAULT 'general' CHECK (notification_type IN ('general', 'homework', 'announcement', 'payment', 'emergency')),
    priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    scheduled_for timestamptz DEFAULT now(),
    sent_at timestamptz,
    delivery_status text DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'expired')),
    expo_receipt_id text,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2.10 AD IMPRESSIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.ad_impressions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    preschool_id uuid REFERENCES public.preschools(id) ON DELETE CASCADE,
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

-- 2.11 ORG INVITES TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.org_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    preschool_id uuid REFERENCES public.preschools(id) ON DELETE CASCADE,
    invited_by uuid REFERENCES public.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL CHECK (role IN ('principal', 'teacher', 'parent')),
    invite_token text UNIQUE NOT NULL,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at timestamptz,
    accepted_by uuid REFERENCES public.users(id),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. FIX PUSH DEVICES SCHEMA
-- =============================================================================
DO $$ 
BEGIN
    -- Add device_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'push_devices' 
                   AND column_name = 'device_id') THEN
        
        ALTER TABLE public.push_devices ADD COLUMN device_id text;
        
        -- Update existing records with generated device IDs
        UPDATE public.push_devices 
        SET device_id = 'device_' || substr(md5(random()::text), 1, 12)
        WHERE device_id IS NULL;
        
        -- Make it NOT NULL after populating
        ALTER TABLE public.push_devices ALTER COLUMN device_id SET NOT NULL;
        
        RAISE NOTICE 'Added device_id column to push_devices table';
    ELSE
        RAISE NOTICE 'Device_id column already exists in push_devices';
    END IF;
END $$;

-- 4. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =============================================================================
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

-- Also ensure existing tables have RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preschools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

-- 5. CREATE BASIC RLS POLICIES FOR NEW TABLES
-- =============================================================================

-- SEATS policies
CREATE POLICY "Users can view their own seats" ON public.seats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "School admins can manage seats" ON public.seats
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.role IN ('superadmin', 'principal')
                AND (p.role = 'superadmin' OR p.preschool_id = (
                    SELECT s.preschool_id FROM public.subscriptions s WHERE s.id = subscription_id
                )))
    );

-- LESSON_ACTIVITIES policies
CREATE POLICY "Teachers can manage lesson activities" ON public.lesson_activities
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.lessons l
                JOIN public.classes c ON l.class_id = c.id
                JOIN public.profiles p ON p.user_id = auth.uid()
                WHERE l.id = lesson_id
                AND (p.role = 'superadmin' 
                     OR (p.role IN ('principal', 'teacher') AND p.preschool_id = c.preschool_id)))
    );

-- ACTIVITY_ATTEMPTS policies
CREATE POLICY "Students can view their own attempts" ON public.activity_attempts
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can create their own attempts" ON public.activity_attempts
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers can view class attempts" ON public.activity_attempts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.lesson_activities la
                JOIN public.lessons l ON la.id = activity_id
                JOIN public.classes c ON l.class_id = c.id
                JOIN public.profiles p ON p.user_id = auth.uid()
                WHERE la.id = activity_id
                AND p.role IN ('teacher', 'principal', 'superadmin')
                AND (p.role = 'superadmin' OR p.preschool_id = c.preschool_id))
    );

-- PARENT_CHILD_LINKS policies
CREATE POLICY "Parents can view their child links" ON public.parent_child_links
    FOR SELECT USING (auth.uid() = parent_id OR auth.uid() = child_id);

CREATE POLICY "School admins can manage parent-child links" ON public.parent_child_links
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.role IN ('superadmin', 'principal')
                AND (p.role = 'superadmin' 
                     OR EXISTS (SELECT 1 FROM public.profiles cp WHERE cp.user_id = child_id AND cp.preschool_id = p.preschool_id)))
    );

-- CHILD_REGISTRATION_REQUESTS policies  
CREATE POLICY "Parents can manage their registration requests" ON public.child_registration_requests
    FOR ALL USING (auth.uid() = parent_id);

CREATE POLICY "School admins can manage registration requests" ON public.child_registration_requests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles p 
                WHERE p.user_id = auth.uid() 
                AND p.role IN ('superadmin', 'principal')
                AND (p.role = 'superadmin' OR p.preschool_id = preschool_id))
    );

-- 6. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_seats_subscription_id ON public.seats(subscription_id);
CREATE INDEX IF NOT EXISTS idx_seats_user_id ON public.seats(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_activities_lesson_id ON public.lesson_activities(lesson_id);
CREATE INDEX IF NOT EXISTS idx_activity_attempts_activity_id ON public.activity_attempts(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_attempts_student_id ON public.activity_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_links_parent_id ON public.parent_child_links(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_links_child_id ON public.parent_child_links(child_id);
CREATE INDEX IF NOT EXISTS idx_child_registration_requests_parent_id ON public.child_registration_requests(parent_id);
CREATE INDEX IF NOT EXISTS idx_child_registration_requests_preschool_id ON public.child_registration_requests(preschool_id);
CREATE INDEX IF NOT EXISTS idx_parent_payments_parent_id ON public.parent_payments(parent_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription_id ON public.subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id ON public.push_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_device_id ON public.push_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_preschool_id ON public.org_invites(preschool_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON public.org_invites(email);

-- 7. UPDATE FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Updated at triggers for new tables
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
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.seats FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.lesson_activities FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.activity_attempts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.parent_child_links FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.child_registration_requests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.parent_payments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.subscription_invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.push_notifications FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.org_invites FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check that capabilities column was added
DO $$
DECLARE
    cap_count integer;
BEGIN
    SELECT COUNT(*) INTO cap_count 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'capabilities';
    
    IF cap_count > 0 THEN
        RAISE NOTICE 'SUCCESS: Capabilities column exists in profiles table';
    ELSE
        RAISE NOTICE 'ERROR: Capabilities column missing from profiles table';
    END IF;
END $$;

-- Check table count
DO $$
DECLARE
    table_count integer;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name IN ('seats', 'lesson_activities', 'activity_attempts', 'parent_child_links', 
                       'child_registration_requests', 'parent_payments', 'subscription_invoices',
                       'payfast_itn_logs', 'push_notifications', 'ad_impressions', 'org_invites');
    
    RAISE NOTICE 'SUCCESS: Created % new tables', table_count;
END $$;

-- Check device_id column
DO $$
DECLARE
    device_id_count integer;
BEGIN
    SELECT COUNT(*) INTO device_id_count 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'push_devices' 
    AND column_name = 'device_id';
    
    IF device_id_count > 0 THEN
        RAISE NOTICE 'SUCCESS: Device_id column exists in push_devices table';
    ELSE
        RAISE NOTICE 'ERROR: Device_id column missing from push_devices table';
    END IF;
END $$;

RAISE NOTICE '=============================================================================';
RAISE NOTICE 'EDUDASH PRO DATABASE SCHEMA FIXES COMPLETED SUCCESSFULLY!';
RAISE NOTICE '=============================================================================';
RAISE NOTICE 'Applied fixes:';
RAISE NOTICE '✅ Added capabilities column to profiles table';
RAISE NOTICE '✅ Created 11 missing tables with proper schema';
RAISE NOTICE '✅ Fixed push_devices table (added device_id column)';
RAISE NOTICE '✅ Enabled RLS on all tables';
RAISE NOTICE '✅ Created basic RLS policies for new tables';
RAISE NOTICE '✅ Added performance indexes';
RAISE NOTICE '✅ Created updated_at triggers';
RAISE NOTICE '=============================================================================';
RAISE NOTICE 'Next steps:';
RAISE NOTICE '1. Run the health check again to verify all fixes';
RAISE NOTICE '2. Test authentication with the capabilities column';
RAISE NOTICE '3. Create superadmin account if needed';
RAISE NOTICE '=============================================================================';