-- Diagnostic: Check submitted progress reports status
-- Issue: Teacher submitted report but principal dashboard shows "No Pending Reports"

-- Check all recent progress reports
SELECT 
  id,
  student_id,
  teacher_id,
  preschool_id,
  status,
  approval_status,
  report_type,
  report_category,
  teacher_signed_at,
  created_at,
  updated_at
FROM progress_reports
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;

-- Expected: Should see report(s) with status='pending_review'
-- If status is something else (like 'draft'), that's the problem

-- Check specifically for katso@youngeagles.org.za's reports
SELECT 
  pr.id,
  pr.student_id,
  pr.teacher_id,
  pr.status,
  pr.approval_status,
  pr.teacher_signed_at,
  s.first_name || ' ' || s.last_name as student_name,
  p.email as teacher_email,
  p.first_name as teacher_first_name
FROM progress_reports pr
JOIN profiles p ON p.id = pr.teacher_id
LEFT JOIN students s ON s.id = pr.student_id
WHERE p.email = 'katso@youngeagles.org.za'
  AND pr.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY pr.created_at DESC;

-- Check pending review reports for the preschool
SELECT 
  pr.id,
  pr.student_id,
  s.first_name || ' ' || s.last_name as student_name,
  p.first_name || ' ' || p.last_name as teacher_name,
  pr.status,
  pr.approval_status,
  pr.report_type,
  pr.teacher_signed_at,
  pr.created_at
FROM progress_reports pr
JOIN profiles p ON p.id = pr.teacher_id
LEFT JOIN students s ON s.id = pr.student_id
WHERE pr.status = 'pending_review'
  AND pr.preschool_id IN (
    SELECT preschool_id FROM profiles WHERE email = 'katso@youngeagles.org.za'
  )
ORDER BY pr.teacher_signed_at DESC;

-- If the above returns empty but earlier query shows reports with status='draft',
-- it means the submission didn't complete properly

-- Check if reports have BOTH status and approval_status columns
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'progress_reports'
  AND column_name IN ('status', 'approval_status')
ORDER BY column_name;

-- Fix for reports stuck in 'draft' status (if needed)
-- ONLY RUN THIS IF you confirm reports exist but have wrong status
/*
UPDATE progress_reports
SET status = 'pending_review'
WHERE teacher_id = (SELECT id FROM profiles WHERE email = 'katso@youngeagles.org.za')
  AND status = 'draft'
  AND teacher_signed_at IS NOT NULL  -- Has signature = ready for review
  AND created_at >= CURRENT_DATE - INTERVAL '1 day';
*/

-- Check dashboard query result (what principal actually sees)
SELECT 
  COUNT(*) as pending_count
FROM progress_reports
WHERE status = 'pending_review'
  AND preschool_id IN (
    SELECT preschool_id FROM profiles WHERE role = 'principal' LIMIT 1
  );

-- Expected: Should show count > 0 if report was submitted properly
