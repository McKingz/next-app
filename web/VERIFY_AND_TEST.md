# ✅ Verification & Testing Steps

## You've completed: Fix AI Usage Logs Schema ✅

Now let's verify everything works!

---

## Step 1: Verify Database Changes

**Go back to Supabase SQL Editor and run:**

```sql
-- Check that columns were added
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_usage_logs'
  AND column_name IN ('metadata', 'processing_time_ms')
ORDER BY column_name;
```

**Expected Output:**
```
metadata           | jsonb   | YES | '{}'::jsonb
processing_time_ms | integer | YES | NULL
```

✅ If you see both columns, the database fix is complete!

---

## Step 2: Link Your User to a School

**Still in Supabase SQL Editor, run this:**

```sql
-- Create test school and link user
DO $$
DECLARE
  new_school_id UUID;
  user_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO user_id 
  FROM profiles 
  WHERE email = 'davecon12martin@outlook.com';
  
  -- Check if school exists
  SELECT id INTO new_school_id 
  FROM preschools 
  WHERE name = 'Test School';
  
  -- Create school if needed
  IF new_school_id IS NULL THEN
    INSERT INTO preschools (
      name, address, contact_email, 
      contact_phone, subscription_tier
    )
    VALUES (
      'Test School',
      '123 Test St, Johannesburg',
      'admin@testschool.co.za',
      '+27123456789',
      'free'
    )
    RETURNING id INTO new_school_id;
  END IF;
  
  -- Link user to school
  UPDATE profiles 
  SET preschool_id = new_school_id
  WHERE id = user_id;
  
  RAISE NOTICE 'User linked to school: %', new_school_id;
END $$;

-- Verify user is linked
SELECT 
  email, 
  first_name, 
  preschool_id,
  (SELECT name FROM preschools WHERE id = profiles.preschool_id) as school_name
FROM profiles 
WHERE email = 'davecon12martin@outlook.com';
```

**Expected Output:**
```
email                        | first_name | preschool_id | school_name
davecon12martin@outlook.com | Dave       | <uuid>       | Test School
```

✅ If you see `preschool_id` is NOT null and `school_name` shows "Test School", you're ready!

---

## Step 3: Restart Your Next.js Dev Server

**In your terminal (where Next.js is running):**

1. **Stop the server:** Press `Ctrl+C`
2. **Start it again:**
   ```bash
   npm run dev
   ```
3. **Wait for:** "✓ Ready in X ms"

---

## Step 4: Test in Browser

### A. Refresh Dashboard

1. Go to: http://localhost:3000/dashboard/parent
2. **Hard refresh:** `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
3. **Open DevTools:** Press `F12`
4. **Check Console tab**

**Before fixes:**
```
❌ ⚠️ User has no preschool_id
❌ OrganizationBanner NOT rendering
```

**After fixes:**
```
✅ No preschool warnings
✅ Organization banner visible with "Test School"
```

### B. Test Exam Builder

1. Click **"AI Help"** or **"Exam Builder"** in sidebar
2. Try to create a new exam
3. Click **"Generate Section A"** or similar

**Watch Network Tab (F12 → Network):**

**Before fix:**
```
POST /api/ai-proxy → 503 Service Unavailable
```

**After fix:**
```
POST /api/ai-proxy → 200 OK
Response: Generated exam content
```

### C. Check Edge Function Logs

**Go to Supabase Edge Function logs:**
https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/functions/ai-proxy/logs

**Before fix:**
```
❌ ERROR: Could not find the 'metadata' column
❌ ERROR: Could not find the 'processing_time_ms' column
```

**After fix:**
```
✅ INFO: AI request successful
✅ INFO: Usage logged successfully
```

---

## Step 5: Full Integration Test

Try this complete workflow:

1. **Dashboard loads** → See "Test School" banner
2. **Click "AI Help"** → Opens exam builder
3. **Enter exam details:**
   - Subject: "Mathematics"
   - Grade: "Grade 1"
   - Duration: "30 minutes"
4. **Click "Generate with AI"**
5. **Wait for response** → Should see exam questions appear
6. **Check console** → No errors

**Success criteria:**
- ✅ No 503 errors
- ✅ AI generates content
- ✅ Questions display correctly
- ✅ No database errors in logs

---

## 🔍 Troubleshooting

### If AI Proxy Still Returns 503:

**Check columns exist in database:**
```sql
\d ai_usage_logs
```

Should show `metadata` and `processing_time_ms` columns.

**If missing, run migration again:**
```sql
ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE ai_usage_logs 
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
```

### If User Warnings Persist:

**Check preschool_id:**
```sql
SELECT email, preschool_id 
FROM profiles 
WHERE email = 'davecon12martin@outlook.com';
```

If null, run the user linking SQL again (Step 2 above).

### If Edge Function Still Crashes:

**Redeploy the function:**
```bash
cd /home/king/Desktop/edudashpro
supabase functions deploy ai-proxy --no-verify-jwt
```

---

## ✅ Success Checklist

- [ ] `metadata` column exists in `ai_usage_logs`
- [ ] `processing_time_ms` column exists in `ai_usage_logs`
- [ ] User has `preschool_id` set (not null)
- [ ] User is linked to "Test School"
- [ ] Dashboard shows school banner
- [ ] No console warnings about preschool_id
- [ ] AI proxy returns 200 (not 503)
- [ ] Exam builder generates content
- [ ] Edge Function logs show no errors

---

## 🎉 You're Done When:

1. ✅ Database columns verified
2. ✅ User linked to school
3. ✅ Dashboard loads without warnings
4. ✅ Exam builder generates AI content
5. ✅ No 503 errors in Network tab

**Next test:** Try generating a complete exam with multiple sections!

---

## Need Help?

If anything doesn't work:

1. **Screenshot the error** (browser console + network tab)
2. **Copy Edge Function logs** (from Supabase dashboard)
3. **Run verification SQL** (from Step 1 and Step 2)
4. **Share the output** so we can diagnose

Everything should be working now! 🚀
