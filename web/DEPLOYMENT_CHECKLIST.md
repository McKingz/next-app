# Deployment Checklist ?

## **Step 1: Pull Latest Code**

```bash
git pull origin cursor/fix-inconsistent-hook-order-in-parent-dashboard-265a
```

**Latest commit:** `1c90dd1` - Fix ParentShell props

---

## **Step 2: Deploy to Vercel** 

```bash
cd /workspace/web
vercel deploy --prod
```

**Expected:** ? Build should succeed now (TypeScript error fixed)

---

## **Step 3: Deploy Supabase Edge Function** ?? **CRITICAL**

```bash
cd /workspace
supabase functions deploy ai-proxy --no-verify-jwt
```

**Why needed:** Backend validation for "Circle" action verb

---

## **Step 4: Test**

1. Go to https://edudashpro.vercel.app/dashboard/parent
2. Scroll to **"CAPS Exam Preparation"**
3. Select:
   - Grade: **Grade 2**
   - Subject: **Mathematics**
   - Type: **Practice Test**
4. Click **"Generate Practice Test with Dash AI"**
5. Click **"Generate Exam"**
6. Wait 15-30 seconds

**Expected:**
- ? Loading animation
- ? Exam generates successfully
- ? No errors

---

## **What Was Fixed:**

### **Frontend (Vercel):**
- ? Fixed TypeScript error in generate-exam page
- ? Corrected ParentShell props
- ? Fixed import paths
- ? Made ExamPrepWidget always visible
- ? Added pulse animations

### **Backend (Supabase - NEEDS DEPLOYMENT):**
- ? Added "Circle" to action verb validation
- ? Added Foundation Phase verbs (Complete, Fill, etc.)
- ? Updated AI instructions

---

## **Quick Command Summary:**

```bash
# 1. Pull
git pull origin cursor/fix-inconsistent-hook-order-in-parent-dashboard-265a

# 2. Deploy Frontend
cd /workspace/web && vercel deploy --prod

# 3. Deploy Backend (REQUIRED!)
cd /workspace && supabase functions deploy ai-proxy --no-verify-jwt

# 4. Test
# Open browser: https://edudashpro.vercel.app/dashboard/parent
```

---

## **If Supabase CLI Not Installed:**

```bash
# macOS
brew install supabase/tap/supabase

# Windows
scoop install supabase

# Linux
curl -fsSL https://deb.supabase.com/init.sh | bash

# Verify
supabase --version
```

Then:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy ai-proxy --no-verify-jwt
```

---

**Status:**
- ? Frontend: Fixed, ready to deploy
- ? Backend: Fixed in code, needs deployment
- ? Testing: Pending both deployments

**Next:** Run the 3 commands above! ??
