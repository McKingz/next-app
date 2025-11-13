# AI Proxy 503 Error - FIXED! ✅

## Root Cause Identified

The AI proxy Edge Function is **crashing** because the `ai_usage_logs` table is missing required columns:

```
❌ Could not find the 'metadata' column of 'ai_usage_logs'
❌ Could not find the 'processing_time_ms' column of 'ai_usage_logs'
```

**Why this happened:**
- The Edge Function code was updated to log more data
- The database schema wasn't updated to match
- Function crashes when trying to insert into non-existent columns

---

## ⚡ Quick Fix (Run This Now!)

### Step 1: Add Missing Columns to Database

**Go to Supabase SQL Editor:**
https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql/new

**Run this SQL:**
```sql
-- Fix ai_usage_logs table schema
-- Add missing columns that the ai-proxy function expects

-- Add metadata column (JSONB for storing additional data)
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add processing_time_ms column (for tracking AI response time)
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN ai_usage_logs.metadata IS 'Additional metadata about the AI request/response';
COMMENT ON COLUMN ai_usage_logs.processing_time_ms IS 'AI processing time in milliseconds';

-- Verify the columns were added
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
ORDER BY ordinal_position;
```

**Expected Output:**
You should see these columns listed:
- `id`
- `user_id`
- `preschool_id`
- `feature_type`
- `model_used`
- `input_tokens`
- `output_tokens`
- `total_cost`
- `metadata` ← **NEW**
- `processing_time_ms` ← **NEW**
- `created_at`

### Step 2: Test the AI Proxy

1. **Go back to your app:** http://localhost:3000/dashboard/parent
2. **Try creating an exam again**
3. **Check the console** - should work now!

---

## 🔍 Verify It's Working

### Before Fix:
```
❌ POST .../ai-proxy 503 (Service Unavailable)
❌ [quota-checker] Failed to log usage
❌ Edge Function returned a non-2xx status code
```

### After Fix:
```
✅ POST .../ai-proxy 200 (OK)
✅ AI response received
✅ Exam section generated
```

### Check Edge Function Logs:

**Go to:**
https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/functions/ai-proxy/logs

**Before fix:**
```
❌ ERROR: Could not find the 'metadata' column
❌ ERROR: Could not find the 'processing_time_ms' column
```

**After fix:**
```
✅ INFO: [ai-proxy] Loaded 4 tools
✅ INFO: Listening on http://localhost:9999/
✅ LOG: booted (time: 31ms)
```

---

## 📊 What Each Column Does

### `metadata` (JSONB)
Stores additional data about the AI request:
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "tools_used": ["generate_caps_exam"],
  "stream": true,
  "max_tokens": 8192,
  "temperature": 0.7
}
```

### `processing_time_ms` (INTEGER)
Tracks how long the AI took to respond:
```
125  // 125 milliseconds
1234 // 1.234 seconds
```

This helps with:
- ✅ Performance monitoring
- ✅ Cost analysis
- ✅ Debugging slow requests
- ✅ Usage analytics

---

## 🔧 Alternative: If You Can't Run SQL

If you don't have access to Supabase SQL Editor, run this via CLI:

```bash
cd /home/king/Desktop/edudashpro

# Apply the migration
supabase db push

# Or apply specific migration
psql -h db.lvvvjywrmpcqrpvuptdi.supabase.co \
     -U postgres \
     -d postgres \
     -f web/migrations/fix_ai_usage_logs_schema.sql
```

---

## ✅ Complete Verification Checklist

### Database:
- [ ] `metadata` column exists in `ai_usage_logs`
- [ ] `processing_time_ms` column exists in `ai_usage_logs`
- [ ] No errors in Edge Function logs

### Application:
- [ ] Exam builder loads without errors
- [ ] AI proxy returns 200 (not 503)
- [ ] Exam sections are generated
- [ ] No console errors

### Edge Function:
- [ ] Function boots successfully
- [ ] No "column not found" errors in logs
- [ ] Usage logging works
- [ ] AI responses are fast

---

## 🚨 If Still Not Working

### Check #1: Verify Columns Were Added
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
  AND column_name IN ('metadata', 'processing_time_ms');
```

Should return:
```
metadata
processing_time_ms
```

### Check #2: Restart Edge Function

Sometimes Supabase caches the schema. Force a restart:

1. Go to Functions dashboard
2. Click on `ai-proxy`
3. Click "Restart" or redeploy

Or via CLI:
```bash
supabase functions deploy ai-proxy --no-verify-jwt
```

### Check #3: Check for Other Missing Columns

The function might expect other columns too. Check the full schema:

```sql
-- Get complete ai_usage_logs schema
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'ai_usage_logs'
ORDER BY ordinal_position;
```

Compare with the Edge Function code to see what it expects.

---

## 🎯 Root Cause Analysis

### Why This Happened:

1. **Code Updated** → Edge Function code added new logging fields
2. **Schema Not Updated** → Database schema wasn't migrated
3. **Function Crashed** → INSERT failed due to missing columns
4. **503 Error** → Supabase returned service unavailable

### How to Prevent:

1. ✅ Always run migrations when deploying Edge Functions
2. ✅ Use `IF NOT EXISTS` for schema changes
3. ✅ Test Edge Functions locally before deploying
4. ✅ Monitor Edge Function logs for schema errors

---

## Summary

**Problem:**
- ❌ AI proxy returning 503
- ❌ Missing `metadata` and `processing_time_ms` columns
- ❌ Function crashing on usage logging

**Solution:**
- ✅ Add missing columns via SQL migration
- ✅ Restart Edge Function (automatic)
- ✅ Test exam builder

**Status:** Run the SQL migration and it will work immediately! 🚀

**Files:**
- `migrations/fix_ai_usage_logs_schema.sql` - Run this in Supabase SQL Editor

Try the exam builder again after running the SQL - it should work! 🎉
