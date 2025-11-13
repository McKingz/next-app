-- Finance indexes to improve dashboard query performance
-- Safe to run multiple times due to IF NOT EXISTS

CREATE INDEX IF NOT EXISTS idx_payments_preschool_status_created_at
ON public.payments (preschool_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_petty_cash_school_status_created_at
ON public.petty_cash_transactions (school_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_petty_cash_receipts_txid
ON public.petty_cash_receipts (transaction_id);

CREATE INDEX IF NOT EXISTS idx_students_preschool_active
ON public.students (preschool_id, is_active);

CREATE INDEX IF NOT EXISTS idx_financial_tx_preschool_type_status_created_at
ON public.financial_transactions (preschool_id, type, status, created_at DESC);
