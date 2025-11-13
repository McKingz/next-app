-- Ultra Minimal Hybrid Data Migration
-- Date: 2025-09-19
-- Purpose: Add basic data using only guaranteed columns
-- WARP.md Compliance: Supabase migration, production-safe, forward-only

BEGIN;

-- ============================================================================
-- PART 1: ADD SAMPLE PRESCHOOLS IF TABLE EXISTS AND IS EMPTY
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'preschools') THEN
    IF NOT EXISTS (SELECT 1 FROM preschools LIMIT 1) THEN
      INSERT INTO preschools (name)
      VALUES
        ('Little Learners Preschool'),
        ('Bright Beginnings'),
        ('Happy Days Daycare'),
        ('Lincoln Elementary School'),
        ('Roosevelt Middle School'),
        ('Washington High School'),
        ('Jefferson K-12 Academy');
      
      RAISE NOTICE 'Created sample educational institutions';
    END IF;
  END IF;
END $$;


-- ============================================================================
-- PART 2: LOG COMPLETION
-- ============================================================================

-- Log migration completion
INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'simple_hybrid_data_20250919213100',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::text,
    'supports_hybrid_model', TRUE,
    'migration_file', '20250919213100_simple_hybrid_data.sql'
  ),
  'Simple hybrid data migration completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'EDUCATIONAL INSTITUTIONS DATA ADDED' AS status;

COMMIT;
