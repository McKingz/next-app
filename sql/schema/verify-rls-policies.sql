-- Verify voice notes RLS policies
SELECT 
  policyname, 
  cmd as operation,
  'Active' as status
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname LIKE 'voice_notes%'
ORDER BY policyname;
