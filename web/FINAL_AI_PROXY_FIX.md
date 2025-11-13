# ✅ ACTUAL Error Found - Fix for ai_service_id

## 🎯 Root Cause Identified!

The error is **NOT** about `metadata` anymore. The real error is:

```
null value in column "ai_service_id" of relation "ai_usage_logs" 
violates not-null constraint
```

**What's happening:**
- The code is trying to insert `ai_service_id: null` 
- But the database column `ai_service_id` is set to `NOT NULL`
- This causes the insert to fail → Edge Function crashes → 503 error

---

## 🔧 The Fix

### Step 1: Run This SQL in Supabase

**Go to:** https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql/new

**Paste and run:**
```sql
-- Make ai_service_id nullable (we're not using ai_services table)
ALTER TABLE ai_usage_logs 
ALTER COLUMN ai_service_id DROP NOT NULL;

-- Verify it worked
SELECT 
    column_name, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
  AND column_name = 'ai_service_id';
```

**Expected output:**
```
ai_service_id | YES
```

(The `YES` means it's now nullable)

---

## 🧪 Test After Running SQL

1. **Run the SQL above** ✅
2. **Refresh your browser** (Ctrl+Shift+R)
3. **Try generating exam again**
4. **Should work now!** 🎉

---

## 📊 Why This Happened

Looking at the code in `quota-checker.ts`:
```typescript
const { error } = await supabaseAdmin.from('ai_usage_logs').insert({
  ai_service_id: null, // ← Trying to insert null
  user_id: params.userId,
  // ...
})
```

The code explicitly sets `ai_service_id: null` because you're not using the `ai_services` table. But the database schema has:

```sql
ai_service_id UUID NOT NULL  -- ← This constraint is the problem!
```

**Solution:** Make it nullable since you're not tracking AI services separately.

---

## ✅ Complete Fix Checklist

Run **ALL** these SQL statements in order:

```sql
-- Fix 1: Add metadata column (you may have already done this)
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Fix 2: Add processing_time_ms column (you may have already done this)
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- Fix 3: Make ai_service_id nullable (NEW - THIS IS THE MAIN FIX!)
ALTER TABLE ai_usage_logs 
ALTER COLUMN ai_service_id DROP NOT NULL;

-- Verify all fixes
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
  AND column_name IN ('metadata', 'processing_time_ms', 'ai_service_id')
ORDER BY column_name;
```

**Expected output:**
```
ai_service_id      | uuid    | YES
metadata           | jsonb   | YES
processing_time_ms | integer | YES
```

All three should show `is_nullable = YES`!

---

## 🎯 After Running This

**Your exam builder will work!**

The 503 error will be gone because:
1. ✅ `metadata` column exists
2. ✅ `processing_time_ms` column exists
3. ✅ `ai_service_id` can now be `null`

**No need to redeploy the Edge Function** - the deployment is fine, we just needed to fix the database schema!

---

## 🔍 How I Found This

From your logs:
```json
{
  "code": "23502",
  "message": "null value in column \"ai_service_id\" of relation \"ai_usage_logs\" violates not-null constraint",
  "details": "Failing row contains (..., null, ...)"
}
```

PostgreSQL error code **23502** = NOT NULL violation

The full error showed exactly which column (`ai_service_id`) and what value (`null`) caused the failure.

---

## 🚀 Run the SQL Now!

Copy this complete fix and run it:

```sql
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

ALTER TABLE ai_usage_logs 
ALTER COLUMN ai_service_id DROP NOT NULL;

SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
  AND column_name IN ('metadata', 'processing_time_ms', 'ai_service_id')
ORDER BY column_name;
```

Then refresh your browser and try the exam builder again! 🎉
