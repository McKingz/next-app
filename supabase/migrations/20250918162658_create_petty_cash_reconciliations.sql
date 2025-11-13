-- Create petty cash reconciliations table
CREATE TABLE IF NOT EXISTS petty_cash_reconciliations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  preschool_id UUID NOT NULL REFERENCES schools (id) ON DELETE CASCADE,
  system_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  physical_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  variance DECIMAL(10, 2) GENERATED ALWAYS AS (physical_amount - system_amount) STORED,
  cash_breakdown JSONB,
  notes TEXT,
  reconciled_by UUID NOT NULL REFERENCES auth.users (id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_petty_cash_reconciliations_preschool_id ON petty_cash_reconciliations (preschool_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_reconciliations_created_at ON petty_cash_reconciliations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_petty_cash_reconciliations_reconciled_by ON petty_cash_reconciliations (reconciled_by);

-- Enable RLS
ALTER TABLE petty_cash_reconciliations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow users to view reconciliations from their preschool
CREATE POLICY "Users can view reconciliations from their preschool" ON petty_cash_reconciliations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE
      u.auth_user_id = auth.uid()
      AND u.preschool_id = petty_cash_reconciliations.preschool_id
  )
);

-- Allow principals and principal_admins to insert reconciliations
CREATE POLICY "Principals can create reconciliations" ON petty_cash_reconciliations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE
      u.auth_user_id = auth.uid()
      AND u.preschool_id = petty_cash_reconciliations.preschool_id
      AND u.role IN ('principal', 'principal_admin')
  )
);

-- Allow principals and principal_admins to update reconciliations
CREATE POLICY "Principals can update reconciliations" ON petty_cash_reconciliations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE
      u.auth_user_id = auth.uid()
      AND u.preschool_id = petty_cash_reconciliations.preschool_id
      AND u.role IN ('principal', 'principal_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE
      u.auth_user_id = auth.uid()
      AND u.preschool_id = petty_cash_reconciliations.preschool_id
      AND u.role IN ('principal', 'principal_admin')
  )
);

-- Allow principals and principal_admins to delete reconciliations
CREATE POLICY "Principals can delete reconciliations" ON petty_cash_reconciliations
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users AS u
    WHERE
      u.auth_user_id = auth.uid()
      AND u.preschool_id = petty_cash_reconciliations.preschool_id
      AND u.role IN ('principal', 'principal_admin')
  )
);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_petty_cash_reconciliations_updated_at
BEFORE UPDATE ON petty_cash_reconciliations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
