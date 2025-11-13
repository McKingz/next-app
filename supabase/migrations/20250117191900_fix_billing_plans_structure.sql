-- Migration: Fix Billing Plans Structure
-- Created: 2025-01-17 19:19:00
-- Description: Update billing plans to match the UI structure shown in the modal
-- Based on: Plans modal showing Free, Starter, Basic, Premium, Pro, Enterprise

-- =============================================================================
-- 1. CLEAR EXISTING BILLING PLANS AND RECREATE WITH CORRECT STRUCTURE
-- =============================================================================

-- First, delete existing plans (we'll recreate them with correct data)
DELETE FROM public.billing_plans;

-- Insert the correct billing plans matching the UI
INSERT INTO public.billing_plans (
  name,
  display_name,
  description,
  price_cents,
  currency,
  ai_monthly_credits,
  max_teachers,
  max_parents,
  max_students,
  ads_enabled,
  features,
  active,
  sort_order
) VALUES
-- Free Plan
(
  'free',
  'Free',
  'Perfect for getting started',
  0,
  'ZAR',
  10,
  1,
  5,
  10,
  TRUE,
  jsonb_build_object(
    'basic_dashboard', TRUE,
    'limited_ai', TRUE,
    'basic_reports', TRUE,
    'community_support', TRUE
  ),
  TRUE,
  1
),

-- Starter Plan  
(
  'starter',
  'Starter',
  'Ideal for small preschools',
  4900, -- R49
  'ZAR',
  50,
  2,
  15,
  25,
  TRUE,
  jsonb_build_object(
    'basic_dashboard', TRUE,
    'enhanced_ai', TRUE,
    'basic_reports', TRUE,
    'email_support', TRUE,
    'parent_communication', TRUE
  ),
  TRUE,
  2
),

-- Basic Plan
(
  'basic',
  'Basic',
  'Great for growing schools',
  9900, -- R99
  'ZAR',
  100,
  4,
  30,
  50,
  TRUE,
  jsonb_build_object(
    'full_dashboard', TRUE,
    'enhanced_ai', TRUE,
    'detailed_reports', TRUE,
    'email_support', TRUE,
    'parent_communication', TRUE,
    'homework_management', TRUE,
    'basic_analytics', TRUE
  ),
  TRUE,
  3
),

-- Premium Plan
(
  'premium',
  'Premium',
  'Advanced features for established schools',
  19900, -- R199
  'ZAR',
  250,
  8,
  60,
  100,
  FALSE, -- No ads
  jsonb_build_object(
    'full_dashboard', TRUE,
    'unlimited_ai', TRUE,
    'advanced_reports', TRUE,
    'priority_support', TRUE,
    'parent_communication', TRUE,
    'homework_management', TRUE,
    'advanced_analytics', TRUE,
    'custom_branding', TRUE,
    'bulk_communications', TRUE
  ),
  TRUE,
  4
),

-- Pro Plan
(
  'pro',
  'Pro',
  'Professional solution for larger schools',
  39900, -- R399
  'ZAR',
  500,
  12,
  120,
  200,
  FALSE, -- No ads
  jsonb_build_object(
    'full_dashboard', TRUE,
    'unlimited_ai', TRUE,
    'advanced_reports', TRUE,
    'priority_support', TRUE,
    'parent_communication', TRUE,
    'homework_management', TRUE,
    'advanced_analytics', TRUE,
    'custom_branding', TRUE,
    'bulk_communications', TRUE,
    'api_access', TRUE,
    'integrations', TRUE,
    'multi_campus', TRUE
  ),
  TRUE,
  5
),

-- Enterprise Plan
(
  'enterprise',
  'Enterprise',
  'Complete solution for large institutions',
  79900, -- R799
  'ZAR',
  1000,
  50,
  500,
  1000,
  FALSE, -- No ads
  jsonb_build_object(
    'full_dashboard', TRUE,
    'unlimited_ai', TRUE,
    'enterprise_reports', TRUE,
    'dedicated_support', TRUE,
    'parent_communication', TRUE,
    'homework_management', TRUE,
    'enterprise_analytics', TRUE,
    'custom_branding', TRUE,
    'bulk_communications', TRUE,
    'api_access', TRUE,
    'integrations', TRUE,
    'multi_campus', TRUE,
    'sso_integration', TRUE,
    'custom_workflows', TRUE,
    'dedicated_account_manager', TRUE
  ),
  TRUE,
  6
);

-- =============================================================================
-- 2. VERIFY THE UPDATED PLANS
-- =============================================================================

-- Display the updated billing plans for verification
DO $$
DECLARE
    plan_record RECORD;
BEGIN
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'UPDATED BILLING PLANS STRUCTURE';
    RAISE NOTICE '=============================================================================';
    
    FOR plan_record IN 
        SELECT name, display_name, price_cents, max_teachers, max_students, active, sort_order
        FROM public.billing_plans 
        ORDER BY sort_order 
    LOOP
        RAISE NOTICE '% - % (R% | % teachers, % students) - Sort: %', 
            plan_record.display_name,
            plan_record.name, 
            plan_record.price_cents::decimal / 100,
            plan_record.max_teachers,
            plan_record.max_students,
            plan_record.sort_order;
    END LOOP;
    
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE 'Billing plans updated successfully to match UI structure!';
    RAISE NOTICE '=============================================================================';
END $$;
