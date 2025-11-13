-- Update Parent Plan User Limits
-- Parent Starter: 1 parent - 1 child
-- Parent Plus: 2 parents - 3 children

UPDATE subscription_plans
SET 
  max_teachers = 1,  -- 1 parent
  max_students = 1   -- 1 child
WHERE tier = 'parent-starter';

UPDATE subscription_plans
SET 
  max_teachers = 2,  -- 2 parents
  max_students = 3   -- 3 children
WHERE tier = 'parent-plus';