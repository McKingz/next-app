-- Reset plans safely: archive existing and insert new ordered tiers
-- Strategy: mark old plans inactive instead of delete; then insert new set

-- 1) Deactivate all current plans
UPDATE public.subscription_plans SET is_active = FALSE, updated_at = now();

-- 2) Insert new canonical plan set (id auto-generated)
INSERT INTO public.subscription_plans (name, tier, price_monthly, price_annual, max_teachers, max_students, is_active)
VALUES
('Free', 'free', 0, 0, 1, 50, TRUE),
('Starter', 'starter', 49, 490, 2, 100, TRUE),
('Basic', 'basic', 299, 2990, 4, 200, TRUE),
('Premium', 'premium', 499, 4990, 8, 400, TRUE),
('Pro', 'pro', 899, 8990, 12, 800, TRUE),
('Enterprise', 'enterprise', 1999, 19990, 50, 2000, TRUE);

-- 3) Verify visibility via RPC (manual check)
-- select * from public.public_list_plans();
