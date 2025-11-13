# 🚨 CRITICAL: Database Migration Required

## The Problem

The Conversational Exam Builder (and regular exam generation) are failing with:
- **503 Service Unavailable** - Edge function timing out
- **400 Bad Request** - Database constraint rejecting inserts

## Root Cause

The `ai_usage_logs` table has a CHECK constraint that only allows:
```sql
CHECK (service_type IN ('lesson_generation', 'grading_assistance', 'general'))
```

But the exam generation is trying to use `'homework_help'`, which **is not in the list**!

## The Fix (30 seconds)

### Step 1: Copy This SQL

```sql
BEGIN;

ALTER TABLE public.ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_service_type_check;

ALTER TABLE public.ai_usage_logs
ADD CONSTRAINT ai_usage_logs_service_type_check 
CHECK (service_type IN (
  'lesson_generation', 
  'homework_help', 
  'grading_assistance', 
  'general',
  'dash_conversation',
  'conversation'
));

COMMIT;
```

### Step 2: Run It

1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql
2. Paste the SQL above
3. Click "Run"
4. Done! ✅

### Step 3: Verify

Run this query to verify it worked:

```sql
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'ai_usage_logs_service_type_check';
```

You should see `homework_help` in the list.

---

## What This Will Fix

After applying this migration:

✅ Exam generation will work  
✅ Conversational builder will work  
✅ No more 400 errors  
✅ No more 503 timeouts (caused by the 400 error)  
✅ Usage logging will work properly  

---

## Why This Happened

The original migration that created `ai_usage_logs` didn't include all the service types we're now using. It only had:
- `lesson_generation`
- `grading_assistance` 
- `general`

But we're now using:
- `homework_help` ← Missing!
- `dash_conversation` ← Missing!
- `conversation` ← Missing!

---

## 🎯 DO THIS NOW

**This is blocking exam generation entirely!**

Copy the SQL above and run it in Supabase Dashboard → SQL Editor.

It takes 30 seconds and will fix everything.

---

**File saved to**: `/workspace/URGENT_DATABASE_FIX.sql`
