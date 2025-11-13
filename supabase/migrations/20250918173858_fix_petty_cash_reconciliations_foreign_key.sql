-- Fix foreign key reference in petty_cash_reconciliations table
-- The table should reference preschools(id), not schools(id)

-- Drop the existing foreign key constraint
ALTER TABLE petty_cash_reconciliations
DROP CONSTRAINT IF EXISTS petty_cash_reconciliations_preschool_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE petty_cash_reconciliations
ADD CONSTRAINT petty_cash_reconciliations_preschool_id_fkey
FOREIGN KEY (preschool_id) REFERENCES preschools (id) ON DELETE CASCADE;
