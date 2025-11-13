-- =============================================
-- EduDash Pro: Hybrid Onboarding Schema Enhancements
-- Version: 1.0.0
-- Date: 2025-09-19
-- Purpose: Add support for hybrid preschool/K-12 onboarding flows
-- WARP.md Compliance: Migration-only, production-safe, forward-only
-- =============================================

BEGIN;

-- ============================================================================
-- PART 1: ENHANCE PRESCHOOLS TABLE FOR HYBRID SCHOOL SUPPORT
-- ============================================================================

-- Add school type and onboarding tracking columns
ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS school_type VARCHAR(20) DEFAULT 'preschool' CHECK (
  school_type IN ('preschool', 'k12_school', 'hybrid')
);

ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS grade_levels TEXT [] DEFAULT ARRAY['pre_k'];

ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending' CHECK (
  verification_status IN ('pending', 'verified', 'failed', 'manual_override')
);

ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS onboarding_flow VARCHAR(50) CHECK (
  onboarding_flow IN ('self_service', 'superadmin_invite', 'migration', 'legacy')
);

ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS contact_email TEXT;

ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS physical_address TEXT;

ALTER TABLE public.preschools
ADD COLUMN IF NOT EXISTS registration_notes TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_preschools_school_type ON public.preschools (school_type);
CREATE INDEX IF NOT EXISTS idx_preschools_verification_status ON public.preschools (verification_status);
CREATE INDEX IF NOT EXISTS idx_preschools_onboarding_flow ON public.preschools (onboarding_flow);

-- ============================================================================
-- PART 2: CREATE SCHOOL VERIFICATION TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.school_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,
  verification_type VARCHAR(50) NOT NULL CHECK (verification_type IN ('email', 'phone', 'document', 'manual', 'api')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
  verification_data JSONB DEFAULT '{}',
  verification_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES public.users (id),
  verified_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for verification queries
CREATE INDEX IF NOT EXISTS idx_school_verifications_school_id ON public.school_verifications (school_id);
CREATE INDEX IF NOT EXISTS idx_school_verifications_status ON public.school_verifications (verification_type, status);
CREATE INDEX IF NOT EXISTS idx_school_verifications_token ON public.school_verifications (
  verification_token
) WHERE verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_school_verifications_expires ON public.school_verifications (
  expires_at
) WHERE expires_at IS NOT NULL;

-- Enable RLS on school_verifications
ALTER TABLE public.school_verifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for school_verifications
-- Superadmin: Full access
CREATE POLICY school_verifications_superadmin_access ON public.school_verifications
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

-- School admin: Access to their own school's verifications
CREATE POLICY school_verifications_school_access ON public.school_verifications
FOR ALL
TO authenticated
USING (
  school_id IN (
    SELECT preschool_id
    FROM public.users
    WHERE
      id = auth.uid()
      AND role IN ('principal', 'preschool_admin')
  )
)
WITH CHECK (
  school_id IN (
    SELECT preschool_id
    FROM public.users
    WHERE
      id = auth.uid()
      AND role IN ('principal', 'preschool_admin')
  )
);

-- ============================================================================
-- PART 3: UPDATE EXISTING SUBSCRIPTIONS FOR SCHOOL TYPE SUPPORT
-- ============================================================================

-- Add school_type filter to subscription_plans if not exists
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS school_types TEXT [] DEFAULT ARRAY['preschool', 'k12_school', 'hybrid'];

-- Add index for school type filtering
CREATE INDEX IF NOT EXISTS idx_subscription_plans_school_types ON public.subscription_plans USING gin (school_types);

-- ============================================================================
-- PART 4: CREATE ONBOARDING PROGRESS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,
  flow_type VARCHAR(50) NOT NULL CHECK (flow_type IN ('self_service', 'superadmin_invite', 'migration')),
  current_step VARCHAR(50) NOT NULL,
  completed_steps TEXT [] DEFAULT ARRAY[]::TEXT [],
  step_data JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.users (id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (school_id, flow_type)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_school_id ON public.onboarding_progress (school_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_flow_type ON public.onboarding_progress (flow_type, current_step);

-- Enable RLS
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for onboarding_progress
CREATE POLICY onboarding_progress_superadmin_access ON public.onboarding_progress
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

CREATE POLICY onboarding_progress_school_access ON public.onboarding_progress
FOR ALL
TO authenticated
USING (
  school_id IN (
    SELECT preschool_id
    FROM public.users
    WHERE
      id = auth.uid()
      AND role IN ('principal', 'preschool_admin')
  )
)
WITH CHECK (
  school_id IN (
    SELECT preschool_id
    FROM public.users
    WHERE
      id = auth.uid()
      AND role IN ('principal', 'preschool_admin')
  )
);

-- ============================================================================
-- PART 5: UPDATE EXISTING DATA FOR BACKWARDS COMPATIBILITY
-- ============================================================================

-- Update existing schools to have proper school_type and grade_levels
UPDATE public.preschools
SET
  school_type = 'preschool',
  grade_levels = ARRAY['pre_k'],
  verification_status = 'manual_override',
  onboarding_flow = 'legacy'
WHERE school_type IS NULL OR grade_levels IS NULL;

-- ============================================================================
-- PART 6: LOG MIGRATION COMPLETION
-- ============================================================================

-- Log successful migration
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'hybrid_onboarding_schema_20250919221440',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'schema_changes', json_build_object(
      'preschools_enhanced', TRUE,
      'school_verifications_created', TRUE,
      'onboarding_progress_created', TRUE,
      'subscription_plans_enhanced', TRUE
    ),
    'migration_file', '20250919221440_hybrid_onboarding_schema_enhancements.sql'
  ),
  'Hybrid onboarding schema enhancements completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'HYBRID ONBOARDING SCHEMA ENHANCED SUCCESSFULLY' AS status;

COMMIT;
