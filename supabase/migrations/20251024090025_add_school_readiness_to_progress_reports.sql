-- Add school readiness and Grade R transition fields to progress_reports table
-- Purpose: Support comprehensive school readiness assessments for students transitioning to formal school

-- Add report category to distinguish between general and school readiness reports
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS report_category text DEFAULT 'general' CHECK (report_category IN ('general', 'school_readiness'));

-- Add school readiness indicators (JSONB for flexibility)
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS school_readiness_indicators jsonb DEFAULT '{}'::jsonb;

-- Add developmental milestones checklist
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS developmental_milestones jsonb DEFAULT '{}'::jsonb;

-- Add transition readiness assessment
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS transition_readiness_level text CHECK (transition_readiness_level IN ('not_ready', 'developing', 'ready', 'exceeds_expectations'));

-- Add readiness notes
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS readiness_notes text;

-- Add recommendations for parents/next school
ALTER TABLE progress_reports 
ADD COLUMN IF NOT EXISTS recommendations text;

-- Create index for filtering school readiness reports
CREATE INDEX IF NOT EXISTS idx_progress_reports_category ON progress_reports(report_category);
CREATE INDEX IF NOT EXISTS idx_progress_reports_transition_level ON progress_reports(transition_readiness_level);

-- Add comment for documentation
COMMENT ON COLUMN progress_reports.report_category IS 'Type of report: general progress or school readiness assessment';
COMMENT ON COLUMN progress_reports.school_readiness_indicators IS 'JSON object containing assessments for: social_skills, emotional_development, gross_motor_skills, fine_motor_skills, cognitive_development, language_development, independence, self_care';
COMMENT ON COLUMN progress_reports.developmental_milestones IS 'JSON object containing checklist of achieved milestones with boolean values';
COMMENT ON COLUMN progress_reports.transition_readiness_level IS 'Overall assessment of readiness for formal school';
COMMENT ON COLUMN progress_reports.readiness_notes IS 'Additional notes about student readiness for formal school';
COMMENT ON COLUMN progress_reports.recommendations IS 'Recommendations for parents and receiving school';