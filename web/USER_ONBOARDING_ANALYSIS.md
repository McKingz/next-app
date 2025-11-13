# User Onboarding & AI Proxy Issues - Analysis

## Issues Identified

### 1. ✅ Google Sign-In Works But User Has No School
```
⚠️ Profile found but NO preschool_id
⚠️ User needs to be linked to a school
```

**This is EXPECTED behavior!** When a user signs in with Google for the first time:
1. ✅ User is created in Supabase auth
2. ✅ Profile is created in `profiles` table
3. ❌ User is NOT linked to any school yet

**Why?** Because EduDash Pro is multi-tenant:
- Parents need to join a specific school using a school code
- Teachers need to be invited by a principal
- Principals create their own schools

### 2. ❌ AI Proxy Returning 503
```
POST https://lvvvjywrmpcqrpvuptdi.supabase.co/functions/v1/ai-proxy 503 (Service Unavailable)
```

This is a **separate issue** - the Supabase Edge Function is down or erroring.

---

## Solution 1: User Onboarding Flow

### Current Flow (Broken):
```
Sign in with Google → Dashboard → ⚠️ No school → Errors everywhere
```

### Fixed Flow:
```
Sign in with Google → Check if has school
                       ├─ YES → Dashboard
                       └─ NO  → Onboarding wizard
                               ├─ Parent? → Enter school code
                               ├─ Teacher? → Enter invite code
                               └─ Principal? → Create school
```

### What Needs to Be Done:

1. **After Google Sign-In, check for `preschool_id`**
2. **If null, redirect to onboarding**
3. **Onboarding asks: "What's your role?"**
   - Parent → Show "Enter School Code" page
   - Teacher → Show "Enter Invite Code" page  
   - Principal → Show "Create Your School" wizard

### Files to Modify:

**1. Modify Google Sign-In success handler:**
```typescript
// In GoogleSignInButton.tsx or sign-in page
onSuccess={(user) => {
  // Check if user has preschool_id
  if (!user.preschool_id) {
    router.push('/onboarding');
  } else {
    router.push('/dashboard');
  }
}}
```

**2. Create `/onboarding/page.tsx`:**
```typescript
// Role selection page
"What brings you to EduDash Pro?"
- [ ] I'm a parent (join existing school)
- [ ] I'm a teacher (use invite code)
- [ ] I'm a principal/admin (create a school)
```

**3. Create `/onboarding/parent/page.tsx`:**
```typescript
// School code entry
"Enter your school code"
"Your school will provide this code"
[____________]
[Join School]
```

**4. Create `/onboarding/principal/page.tsx`:**
```typescript
// School creation wizard
"Create Your School"
- School Name
- Address
- Grade levels
- etc.
```

---

## Solution 2: Fix AI Proxy 503

### Check Supabase Edge Function

The `ai-proxy` function is returning 503, which means:
1. Function doesn't exist
2. Function is crashing on startup
3. Function has an error in the code
4. Anthropic API key is missing

### To Debug:

1. **Check if function exists:**
   ```bash
   # List Supabase functions
   cd /home/king/Desktop/edudashpro
   supabase functions list
   ```

2. **Check function logs:**
   - Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/functions
   - Click on `ai-proxy`
   - View logs for errors

3. **Common causes:**
   - Missing `ANTHROPIC_API_KEY` in Supabase secrets
   - Function not deployed
   - Function code has errors

### Quick Fix:

**Check if Anthropic API key is set in Supabase:**
```bash
# Via Supabase dashboard:
# 1. Go to Project Settings → Edge Functions
# 2. Check "Secrets" tab
# 3. Should have: ANTHROPIC_API_KEY
```

**Redeploy the function:**
```bash
cd /home/king/Desktop/edudashpro
supabase functions deploy ai-proxy
```

---

## Immediate Action Items

### Priority 1: Get User Into System (Onboarding)

**Option A: Quick Fix - Manually Set School ID**
```sql
-- Run this in Supabase SQL Editor for testing
UPDATE profiles 
SET preschool_id = (
  SELECT id FROM preschools LIMIT 1
)
WHERE email = 'davecon12martin@outlook.com';
```

**Option B: Proper Fix - Create Onboarding Flow**
1. Create onboarding pages
2. Update sign-in flow
3. Test complete flow

### Priority 2: Fix AI Proxy

**Check Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/functions/ai-proxy
2. Check if function exists
3. Check logs for errors
4. Verify `ANTHROPIC_API_KEY` is set in secrets

**If function doesn't exist:**
```bash
cd /home/king/Desktop/edudashpro
supabase functions deploy ai-proxy
```

---

## Testing Steps

### After Quick Fix (Manually Setting School ID):

1. **Refresh browser**
2. **Check console** - should no longer see preschool_id warnings
3. **Check dashboard** - should show school name/banner
4. **Try creating exam** - should work if AI proxy is fixed

### After Proper Onboarding Flow:

1. **Sign out**
2. **Sign in again with Google**
3. **Should see onboarding wizard**
4. **Complete onboarding**
5. **Should land on dashboard with school linked**

---

## Which Fix Do You Want?

### 🚀 Quick Fix (5 minutes):
- Manually set `preschool_id` in database
- Fix AI proxy issue
- **Pro:** Get you working immediately
- **Con:** Doesn't solve onboarding for new users

### 🏗️ Proper Fix (30-60 minutes):
- Build complete onboarding flow
- Fix AI proxy issue
- **Pro:** Complete solution, production-ready
- **Con:** Takes longer

**Recommendation:** Do quick fix NOW to test, then build proper onboarding separately.

---

## Summary

**What's Working:**
- ✅ Google Sign-In
- ✅ User creation
- ✅ Profile creation
- ✅ Authentication

**What's Broken:**
- ❌ User not linked to school (expected for new users!)
- ❌ No onboarding flow for new users
- ❌ AI proxy returning 503

**Next Steps:**
1. Manually link your user to a school (SQL above)
2. Check/fix AI proxy function
3. Build onboarding flow (separate task)

Tell me which approach you prefer, and I'll help you implement it! 🚀
