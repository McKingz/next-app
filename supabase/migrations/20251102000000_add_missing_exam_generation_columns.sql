-- Add missing columns to exam_generations table
-- These columns are important for tracking, analytics, and user experience

ALTER TABLE exam_generations 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS model_used text DEFAULT 'claude-3-5-sonnet-20240620',
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS downloaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_rating integer CHECK (user_rating >= 1 AND user_rating <= 5),
  ADD COLUMN IF NOT EXISTS user_feedback text,
  ADD COLUMN IF NOT EXISTS generation_duration_ms integer,
  ADD COLUMN IF NOT EXISTS token_count integer,
  ADD COLUMN IF NOT EXISTS error_message text;

-- Add check constraint for status
ALTER TABLE exam_generations 
  DROP CONSTRAINT IF EXISTS exam_generations_status_check;

ALTER TABLE exam_generations
  ADD CONSTRAINT exam_generations_status_check 
  CHECK (status IN ('pending', 'generating', 'completed', 'failed'));

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_exam_generations_status 
  ON exam_generations(status, created_at DESC);

-- Add index for model tracking
CREATE INDEX IF NOT EXISTS idx_exam_generations_model 
  ON exam_generations(model_used, created_at DESC);

-- Comment on columns
COMMENT ON COLUMN exam_generations.status IS 'Generation status: pending, generating, completed, failed';
COMMENT ON COLUMN exam_generations.model_used IS 'AI model used for generation (e.g., claude-3-5-sonnet-20240620)';
COMMENT ON COLUMN exam_generations.viewed_at IS 'When user first viewed the exam';
COMMENT ON COLUMN exam_generations.downloaded_at IS 'When user downloaded the exam (if applicable)';
COMMENT ON COLUMN exam_generations.user_rating IS 'User rating of exam quality (1-5 stars)';
COMMENT ON COLUMN exam_generations.user_feedback IS 'User feedback about the exam';
COMMENT ON COLUMN exam_generations.generation_duration_ms IS 'Time taken to generate exam in milliseconds';
COMMENT ON COLUMN exam_generations.token_count IS 'Number of tokens used in generation';
COMMENT ON COLUMN exam_generations.error_message IS 'Error message if generation failed';
