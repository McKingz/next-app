# 🔍 Complete Debugging Summary

## What We've Fixed So Far

✅ Added `metadata` column to `ai_usage_logs`
✅ Added `processing_time_ms` column to `ai_usage_logs`
✅ Made `ai_service_id` nullable
✅ Made `organization_id` nullable
✅ Dropped `ai_usage_logs_organization_id_fkey` foreign key constraint
✅ Deployed Edge Function version 168
✅ Updated quota-checker code to use metadata field

## Still Getting 503 Error

The Edge Function is still returning 503, which means **something is still crashing**.

---

## 🚨 Critical Next Step

**WE ABSOLUTELY NEED TO SEE THE SUPABASE ERROR LOGS!**

Without them, we're flying blind. Here's how:

### Step 1: Open Supabase Logs
https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/functions/ai-proxy/logs

### Step 2: Filter for Errors
1. Click the **"Level"** dropdown (top-right)
2. Select **"Error"**
3. Look for RED messages from the last 10 minutes

### Step 3: Find the Error
Look for error messages like:
- `[quota-checker] Failed to log usage:`
- `[ai-proxy] Error:`
- Any PostgreSQL errors
- Any Anthropic API errors

### Step 4: Share the Complete Error
Copy the ENTIRE error message including:
- The error code (if any)
- The error message
- The details
- The stack trace

---

## Possible Remaining Issues

Based on the code analysis, here are potential problems:

### 1. Another Database Constraint

The `logUsage` function inserts into `ai_usage_logs` with these fields:
```typescript
{
  ai_service_id: null,              // ✅ Now nullable
  user_id: params.userId,           // ❓ Might have constraint
  preschool_id: params.organizationId,  // ❓ Might have FK constraint
  organization_id: params.organizationId,  // ✅ FK removed
  service_type: params.serviceType,
  ai_model_used: params.model,
  status: params.status,
  input_tokens: params.tokensIn,
  output_tokens: params.tokensOut,
  total_cost: params.cost,
  processing_time_ms: params.processingTimeMs,  // ✅ Column exists
  input_text: params.inputText,
  output_text: params.outputText,
  error_message: params.errorMessage,
  metadata: params.metadata  // ✅ Column exists
}
```

**Possible issues:**
- `preschool_id` might have a FK constraint to `preschools` table
- `user_id` might have a FK constraint to `profiles` or `auth.users`
- One of the other fields might have NOT NULL constraint

### 2. Missing Anthropic API Key

Check if `ANTHROPIC_API_KEY` is set in Edge Function secrets.

### 3. Anthropic API Error

The API key might be:
- Not set
- Invalid
- Expired
- Rate limited

---

## Debug Steps to Try

### Option 1: Check All Constraints

Run this SQL to see ALL constraints on `ai_usage_logs`:

```sql
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'ai_usage_logs'
ORDER BY contype, conname;
```

Look for:
- `f` = Foreign key constraints (might fail if referenced row doesn't exist)
- `c` = Check constraints (might fail if value doesn't match)
- `u` = Unique constraints (might fail on duplicate)

### Option 2: Check Anthropic API Key

1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/functions
2. Click "Secrets"
3. Check if `ANTHROPIC_API_KEY` exists
4. If missing, add it!

### Option 3: Temporarily Disable Usage Logging

To confirm if the database logging is the issue, we could temporarily comment out the `logUsage` calls and see if the AI proxy works.

---

## What the Code Shows

Looking at the Edge Function code:

1. ✅ `logUsage` has try-catch (shouldn't throw)
2. ✅ Returns error response if logUsage fails
3. ❓ But something is still causing 503

**Possible causes:**
- The error happens BEFORE logUsage (in quota check, auth, etc.)
- The error happens in the Claude API call
- There's an uncaught exception somewhere

---

## URGENT: Share the Supabase Logs!

Without the actual error message from Supabase, I cannot help you further.

**Please:**
1. Go to Supabase Edge Function logs
2. Filter by "Error" level
3. Find the latest error (from when you just tried)
4. Copy the COMPLETE error message
5. Paste it here

That will tell us EXACTLY what's failing and how to fix it!

---

## Alternative: Enable Debug Logging

If you can't find errors in Supabase, we can add more console.log statements to track exactly where it's failing.

But first: **PLEASE SHARE THE SUPABASE ERROR LOGS!** 🙏
