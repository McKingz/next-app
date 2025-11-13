# AI Proxy Connection Fix - Applied ✅

**Date**: 2025-10-30  
**Issue**: 400 Bad Request - "Missing required fields: scope, service"

---

## 🐛 Problem Identified

The `AskAIWidget` was sending requests in the wrong format to the `ai-proxy` Edge Function.

### What Was Wrong:
```typescript
// ❌ OLD (Incorrect format)
{
  prompt: "Generate exam...",
  context: "caps_activity",
  source: "parent_dashboard"
}
```

### What the Edge Function Expected:
```typescript
// ✅ NEW (Correct format from supabase/functions/ai-proxy/index.ts)
{
  scope: "parent",              // Required: teacher/principal/parent
  service_type: "homework_help", // Required: specific AI service type
  payload: {
    prompt: "Generate exam...",  // Actual prompt inside payload
    context: "caps_exam_preparation",
    metadata: {
      source: "parent_dashboard",
      feature: "exam_prep"
    }
  }
}
```

---

## ✅ Fixes Applied

### 1. **Added Missing Environment Variable**
**File**: `web/.env.local`

**Added**:
```bash
NEXT_PUBLIC_AI_PROXY_ENABLED="true"
```

### 2. **Fixed Request Format in AskAIWidget**
**File**: `web/src/components/dashboard/AskAIWidget.tsx`

**Changes** (lines 42-52 and 83-94):
```typescript
// Updated to match ai-proxy expected format
const { data, error } = await supabase.functions.invoke('ai-proxy', {
  body: {
    scope: 'parent',
    service_type: 'homework_help',
    payload: {
      prompt: initialPrompt,
      context: 'caps_exam_preparation',
      metadata: {
        source: 'parent_dashboard',
        feature: 'exam_prep'
      }
    }
  },
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
});
```

### 3. **Fixed Response Handling**
**Changes** (lines 56-59 and 99-102):
```typescript
// Handle ai-proxy response format: { success: true, content: string }
const content = data?.content || data?.error?.message || 'No response from AI';
setMessages((m) => [...m, { role: 'assistant', text: content }]);
```

---

## 🔍 Edge Function Parameters Reference

From `supabase/functions/ai-proxy/index.ts`:

### Required Fields:
- **`scope`**: `'teacher' | 'principal' | 'parent'`
- **`service_type`**: `'lesson_generation' | 'grading_assistance' | 'homework_help' | 'progress_analysis' | 'insights' | 'transcription'`
- **`payload`**: Object containing:
  - `prompt` (string): The AI prompt
  - `context` (optional string): Context for the prompt
  - `metadata` (optional object): Additional metadata

### Optional Fields:
- **`stream`**: boolean - Enable Server-Sent Events streaming
- **`metadata`**: Additional metadata (student_id, class_id, subject, etc.)

### Response Format:
```typescript
{
  success: true,
  content: "AI-generated content here...",
  usage: {
    tokens_in: 1234,
    tokens_out: 5678,
    cost: 0.0123,
    usage_id: "uuid-here"
  }
}
```

---

## 🧪 Testing Steps

### 1. Reload the Page
After applying fixes, hard refresh:
```
Ctrl + Shift + R (Linux/Windows)
Cmd + Shift + R (Mac)
```

### 2. Test Exam Generation
1. Go to `/dashboard/parent`
2. Select a child
3. Scroll to "CAPS Exam Preparation"
4. Select: Grade 9, Mathematics, Practice Test
5. Click "Generate with Dash AI"
6. **Expected**: Modal opens with AI-generated exam content
7. **Check Network tab**: `ai-proxy` should return 200 OK

### 3. Verify Response
In DevTools → Network → `ai-proxy`:
- **Status**: 200 OK
- **Response**: 
  ```json
  {
    "success": true,
    "content": "# DEPARTMENT OF BASIC EDUCATION...",
    "usage": {...}
  }
  ```

---

## 📊 Quota Enforcement

The Edge Function enforces quotas **before** calling Claude AI:

### Default Quotas (per month):
- **Lesson Generation**: 5 requests
- **Grading Assistance**: 5 requests
- **Homework Help**: 15 requests (used for exam prep)

### Quota Response:
If quota exceeded:
```json
{
  "success": false,
  "error": {
    "code": "quota_exceeded",
    "message": "Monthly quota exceeded",
    "quota_info": {
      "used": 15,
      "limit": 15,
      "remaining": 0,
      "reset_at": "2025-11-01T00:00:00Z"
    }
  }
}
```

---

## 💰 Cost Tracking

The Edge Function automatically logs usage to `ai_usage_logs` table:

```sql
SELECT 
  user_id,
  service_type,
  ai_model_used,
  input_tokens,
  output_tokens,
  total_cost,
  status,
  created_at
FROM ai_usage_logs
WHERE service_type = 'homework_help'
ORDER BY created_at DESC
LIMIT 10;
```

### Model Selection by Tier:
- **Free/Starter**: `claude-3-haiku-20240307` (cheaper)
- **Pro/Enterprise**: `claude-3-5-sonnet-20241022` (higher quality)

---

## 🔒 Security Features

The Edge Function includes:

1. **PII Redaction**: Removes emails, phone numbers, ID numbers
2. **Authentication**: Requires valid Supabase session token
3. **Quota Enforcement**: Server-side limits per user
4. **Usage Logging**: All requests logged for audit
5. **Cost Tracking**: Real-time token and cost calculation
6. **Service Role**: No client-side AI API keys

---

## 🚀 Next: Test It!

1. **Save all files** (already done)
2. **Reload browser** (Ctrl + Shift + R)
3. **Test exam generation**
4. **Check Network tab** for 200 OK response
5. **Verify content** in the modal

If you see a full CAPS-aligned exam paper with marking memo, it's working! 🎓

---

## 📝 Common Issues & Solutions

### Issue: Still getting 400 error
**Solution**: Make sure dev server was restarted after adding env variable
```bash
# Stop server (Ctrl+C)
npm run dev
```

### Issue: Quota exceeded message
**Solution**: Check `ai_usage_logs` table or upgrade subscription tier

### Issue: Empty response
**Solution**: Check Edge Function logs:
```bash
npx supabase functions logs ai-proxy --limit 10
```

---

**Status**: ✅ Fixed - Ready to test  
**Last Updated**: 2025-10-30
