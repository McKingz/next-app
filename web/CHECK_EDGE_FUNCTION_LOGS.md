# 🔍 Check Edge Function Logs Now

## The 503 is Still Happening!

Even though we deployed version 167, the Edge Function is still returning 503.

**We need to check the actual error logs to see what's wrong.**

---

## 🚨 URGENT: Check Supabase Logs

### Step 1: Go to Edge Function Logs
**Click this link:**
https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/functions/ai-proxy/logs

### Step 2: Look for Recent Errors (Last 5 Minutes)

**Filter by:** Error / Warning messages

**Look for errors like:**
- ❌ "Could not find the 'metadata' column"
- ❌ "Could not find the 'processing_time_ms' column"
- ❌ "relation 'ai_usage_logs' does not exist"
- ❌ Any PostgreSQL errors
- ❌ Any authentication errors
- ❌ Any Anthropic API errors

### Step 3: Copy the FULL Error Message

**We need to see:**
1. The exact error text
2. The stack trace
3. The timestamp
4. Any SQL errors

---

## 🤔 Possible Issues

### Issue 1: Database Columns Still Missing
**Check:** Did you actually run the SQL migration?

**Verify by running this in Supabase SQL Editor:**
```sql
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
  AND column_name IN ('metadata', 'processing_time_ms');
```

**Should return:**
```
metadata           | jsonb
processing_time_ms | integer
```

### Issue 2: Edge Function Not Actually Deployed
**Check:** Deployment status

The `supabase functions list` showed version 167, but maybe it didn't fully deploy?

### Issue 3: Anthropic API Key Missing
**Check:** Edge Function secrets

Go to: Project Settings → Edge Functions → Secrets

**Should have:**
- `ANTHROPIC_API_KEY` = `sk-ant-...`

### Issue 4: Different Error Now
Maybe the metadata issue is fixed, but there's a NEW error!

---

## 📋 Action Items

### 1. Check Logs (Most Important!)
Go to logs and copy the FULL error message here.

### 2. Verify Database Schema
Run the SQL query above to confirm columns exist.

### 3. Check Anthropic API Key
Make sure it's set in Edge Function secrets.

### 4. Try Manual Test
Let's test the Edge Function directly with curl:

```bash
curl -X POST \
  'https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/ai-proxy' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "scope": "exam_generation",
    "payload": {
      "messages": [{"role": "user", "content": "Generate a simple math question"}]
    }
  }'
```

---

## 🎯 Next Steps

**Please:**
1. Open the Edge Function logs link above
2. Find the most recent error (from the last 2 minutes)
3. Copy the ENTIRE error message and stack trace
4. Paste it here

Without seeing the actual error, we're just guessing! The logs will tell us exactly what's wrong. 🔍
