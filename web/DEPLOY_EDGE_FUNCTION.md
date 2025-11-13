# Deploy Edge Function - REQUIRED

## ?? **CRITICAL: Backend Edge Function Must Be Deployed**

The code changes we made to `/workspace/supabase/functions/ai-proxy/index.ts` are **NOT live yet**.

Edge Functions require **manual deployment** to take effect.

---

## ?? **Deployment Steps**

### **Option 1: Deploy via Supabase CLI (Recommended)**

```bash
# 1. Navigate to project root
cd /workspace

# 2. Login to Supabase (if not already logged in)
supabase login

# 3. Link project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# 4. Deploy the ai-proxy Edge Function
supabase functions deploy ai-proxy --no-verify-jwt

# 5. Wait for deployment (30-60 seconds)
```

**Success message should appear:**
```
Deploying function ai-proxy (v1.x.x)
Function ai-proxy deployed successfully!
```

---

### **Option 2: Deploy via Supabase Dashboard**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **"Edge Functions"** in left sidebar
4. Find `ai-proxy` function
5. Click **"Deploy New Version"**
6. Upload the file from `/workspace/supabase/functions/ai-proxy/index.ts`
7. Click **"Deploy"**
8. Wait for green "Deployed" status

---

## ? **Verify Deployment**

After deploying, check the version:

```bash
supabase functions list
```

Should show `ai-proxy` with a recent timestamp.

---

## ?? **Test the Fix**

1. **Refresh your web browser** (hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`)
2. Navigate to `/dashboard/parent`
3. Scroll to **"CAPS Exam Preparation"**
4. Select:
   - Grade: **Grade 2** (Foundation Phase)
   - Subject: **Mathematics**
   - Type: **Practice Test**
   - Language: **English**
5. Click **"Generate Practice Test with Dash AI"**
6. Click **"Generate Exam"** in the preview modal
7. **Wait 15-30 seconds**

**Expected Result:**
- ? Loading animation appears
- ? Exam generates successfully
- ? No "missing action verb" errors
- ? Full-screen exam appears with questions

---

## ?? **If Still Failing:**

### **Check 1: Verify Deployment**
```bash
supabase functions list
```
Look for recent timestamp on `ai-proxy`.

### **Check 2: Check Edge Function Logs**
```bash
supabase functions logs ai-proxy --limit 50
```

### **Check 3: Browser Console**
Open DevTools (F12) and check for:
- ? `[Supabase] Web client initialized`
- ? `[GenerateExam] Asking Dash AI to generate your exam...`
- ? Any error messages

### **Check 4: Test Direct API Call**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/ai-proxy \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "parent",
    "service_type": "homework_help",
    "enable_tools": true,
    "payload": {
      "prompt": "Generate a Grade 2 Math exam with circle questions",
      "context": "caps_exam_preparation"
    }
  }'
```

---

## ?? **What Changed in ai-proxy**

**Added Action Verbs** (Foundation Phase):
- `circle` ?
- `complete` ?
- `fill` ?
- `change` ?
- `correct` ?
- `rewrite` ?

**File Modified:**
- `/workspace/supabase/functions/ai-proxy/index.ts` (line 555)

**Regex Pattern:**
```typescript
/\b(count|circle|match|choose|select|find|name|list|show|draw|color|colour|write|identify|point|tick|cross|trace|cut|paste|measure|sort|group|build|make|complete|fill|change|correct|rewrite)\b/i
```

---

## ?? **Auto-Deployment (Future)**

To avoid manual deployments, consider:

1. **GitHub Actions CI/CD**
   ```yaml
   # .github/workflows/deploy-edge-functions.yml
   name: Deploy Edge Functions
   on:
     push:
       branches: [main]
       paths:
         - 'supabase/functions/**'
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: supabase/setup-cli@v1
         - run: supabase functions deploy ai-proxy --no-verify-jwt
           env:
             SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
   ```

2. **Supabase CLI Watch Mode** (dev only)
   ```bash
   supabase functions serve ai-proxy --watch
   ```

---

## ?? **Need Help?**

If deployment fails:
1. Check Supabase CLI version: `supabase --version` (should be v1.130+)
2. Check project link: `supabase projects list`
3. Check authentication: `supabase login`
4. Review logs: `supabase functions logs ai-proxy`

---

**Status:** ? **Awaiting Deployment**  
**Once deployed:** ? Exam generation will work!
