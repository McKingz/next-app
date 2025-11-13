# 🔍 Check Edge Function Logs for NEW Error

## ✅ Database Fixed!

The SQL migration ran successfully:
- ✅ `ai_service_id` is now nullable
- ✅ `organization_id` is now nullable
- ✅ Foreign key constraint removed
- ✅ `metadata` column exists
- ✅ `processing_time_ms` column exists

## ❌ But Still Getting 503!

This means there's a **NEW** error we haven't seen yet.

---

## 🚨 URGENT: Check Logs Again

**Go to this URL:**
https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/functions/ai-proxy/logs

**Look for the MOST RECENT error** (from the last 1-2 minutes, after you ran the SQL)

**What to look for:**
- Any ERROR level messages
- Any red/orange warnings
- Stack traces
- Database errors
- Anthropic API errors

---

## 🤔 Possible New Issues

Since we fixed all the database schema issues, the new error could be:

### 1. Anthropic API Key Missing
**Check:** Project Settings → Edge Functions → Secrets

Should have:
- `ANTHROPIC_API_KEY` = `sk-ant-...`

### 2. Anthropic API Key Invalid
The key might be expired or incorrect.

### 3. Request Format Issue
The Edge Function might be sending invalid data to Anthropic.

### 4. Rate Limiting
Anthropic might be rate-limiting your API key.

### 5. Another Database Issue
There might be ANOTHER constraint or column we haven't discovered yet.

---

## 📋 Debug Steps

### Step 1: Check Latest Logs

Go to Edge Function logs and **copy the COMPLETE latest error message**.

### Step 2: Check Anthropic API Key

1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/functions
2. Click "Secrets"
3. Check if `ANTHROPIC_API_KEY` exists
4. If missing, add it:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (your actual key)

### Step 3: Test Anthropic API Key

Run this in terminal:
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_ANTHROPIC_KEY_HERE" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-3-haiku-20240307",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

**Should return:** JSON with Claude's response
**If error:** API key is invalid

---

## 🎯 What I Need From You

**Please go to the Edge Function logs and copy:**

1. The **timestamp** of the latest error
2. The **complete error message**
3. The **stack trace** (if any)
4. Any **details** or **metadata**

**Example of what to copy:**
```json
{
  "timestamp": "2025-11-04T07:10:00.000Z",
  "level": "error",
  "event_message": "[some error message here]",
  "details": "..."
}
```

Without seeing the actual NEW error, I can't fix it! The logs will tell us exactly what's wrong now. 🔍
