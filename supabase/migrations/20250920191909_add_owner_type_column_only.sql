-- Add owner_type column to subscriptions table
-- This column is used to differentiate between school and user subscriptions

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS owner_type text CHECK (owner_type IN ('school', 'user')) DEFAULT 'school';

-- Set existing records to 'school' since they were all school subscriptions
UPDATE public.subscriptions
SET owner_type = 'school'
WHERE owner_type IS NULL;

-- Add comment
COMMENT ON COLUMN public.subscriptions.owner_type IS 'Type of subscription owner: school or user';

-- Create basic index for better performance on queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_owner_type ON public.subscriptions (owner_type);
