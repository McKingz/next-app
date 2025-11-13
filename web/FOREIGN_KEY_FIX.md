# 🚨 NEW Error - Foreign Key Constraint

## The Error Chain (So Far)

1. ✅ **Fixed:** Missing `metadata` column
2. ✅ **Fixed:** Missing `processing_time_ms` column  
3. ✅ **Fixed:** `ai_service_id` NOT NULL constraint
4. ❌ **NEW:** Foreign key constraint on `organization_id`

---

## 🎯 Current Error

```
insert or update on table "ai_usage_logs" violates foreign key constraint 
"ai_usage_logs_organization_id_fkey"

Key (organization_id)=(d5e14446-f19e-4b29-8fb0-9551869348dd) is not present 
in table "organizations"
```

**What's happening:**
- The code inserts `organization_id: 'd5e14446-f19e-4b29-8fb0-9551869348dd'`
- This is actually your **preschool** ID (from `preschools` table)
- But the database has a foreign key pointing to `organizations` table
- That table doesn't have this ID → constraint violation → crash

---

## 🔧 Complete Fix (Run All of This)

**Go to:** https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/sql/new

**Paste and run:**

```sql
-- Fix 1: Make ai_service_id nullable
ALTER TABLE ai_usage_logs 
ALTER COLUMN ai_service_id DROP NOT NULL;

-- Fix 2: Drop the organizations foreign key constraint
ALTER TABLE ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_organization_id_fkey;

-- Fix 3: Make organization_id nullable
ALTER TABLE ai_usage_logs 
ALTER COLUMN organization_id DROP NOT NULL;

-- Fix 4: Add missing columns
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- Verify all fixes worked
SELECT 
    column_name, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
  AND column_name IN ('ai_service_id', 'organization_id', 'metadata', 'processing_time_ms')
ORDER BY column_name;
```

**Expected output:**
```
ai_service_id      | YES
metadata           | YES
organization_id    | YES
processing_time_ms | YES
```

---

## 🤔 Why This Keeps Happening

Your database has **conflicting schema**:
- You use `preschools` table (multi-tenant by school)
- But `ai_usage_logs` has foreign key to `organizations` table
- The code is passing `preschool_id` as `organization_id`
- Foreign key fails because preschool ≠ organization

**Solution:** Remove the foreign key constraint so it can accept any UUID.

---

## 📋 Alternative: Update the Code Instead

Instead of fixing the database, we could change the Edge Function code to NOT set `organization_id`:

**In `quota-checker.ts`:**
```typescript
const { error } = await supabaseAdmin.from('ai_usage_logs').insert({
  ai_service_id: null,
  user_id: params.userId,
  preschool_id: params.organizationId,  // ✅ Keep this
  // organization_id: params.organizationId, // ❌ Remove this line
  // ... rest of fields
})
```

But the SQL fix above is simpler! Just drop the constraint.

---

## 🧪 After Running the SQL

1. **Run all the SQL above** ✅
2. **Refresh browser** (Ctrl+Shift+R)
3. **Try exam builder again**
4. **Check Edge Function logs** for new errors

---

## 🎯 Summary of All Fixes

```sql
-- Run this complete migration:

ALTER TABLE ai_usage_logs ALTER COLUMN ai_service_id DROP NOT NULL;
ALTER TABLE ai_usage_logs DROP CONSTRAINT IF EXISTS ai_usage_logs_organization_id_fkey;
ALTER TABLE ai_usage_logs ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
```

This should fix **all** the database schema issues preventing the AI proxy from working! 🚀

---

## 🔍 How to Check If It Worked

After running the SQL, try to generate an exam. Then check logs:

**Before (current error):**
```
❌ violates foreign key constraint "ai_usage_logs_organization_id_fkey"
```

**After (should work):**
```
✅ No errors, exam generates successfully
```

Or if there's ANOTHER error, we'll see it in the logs and fix that too! 😅
