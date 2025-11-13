# Google Sign-In Errors - Fixed ✅

## Issues Identified

### 1. ❌ Cross-Origin-Opener-Policy (COOP) Error
```
popup.ts:302 Cross-Origin-Opener-Policy policy would block the window.closed call.
```
**Cause**: Missing COOP headers preventing Google popup from communicating with parent window

### 2. ❌ 401 Unauthorized
```
api/auth/google:1 Failed to load resource: the server responded with a status of 401 (Unauthorized)
```
**Cause**: Missing `SUPABASE_SERVICE_ROLE_KEY` environment variable

### 3. ❌ Invalid or Expired Token
```
Google sign-in error: Error: Invalid or expired token
```
**Cause**: Token verification failing due to missing service role key

---

## Fixes Applied

### ✅ Fix 1: Added COOP Headers to Next.js Config

**File**: `/web/next.config.ts`

```typescript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Cross-Origin-Opener-Policy',
          value: 'same-origin-allow-popups', // Allow Google popups
        },
        {
          key: 'Cross-Origin-Embedder-Policy',
          value: 'unsafe-none',
        },
      ],
    },
  ];
}
```

**Result**: Google Sign-In popup can now communicate with parent window ✅

---

### ✅ Fix 2: Added Missing Environment Variable

**File**: `/web/.env.local`

```bash
# Added prominent placeholder for Supabase Service Role Key
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY_HERE"
```

**Action Required**: You need to add your actual Supabase Service Role Key

**How to get it**:
1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/api
2. Scroll to "Project API keys"
3. Copy the **service_role** key (NOT the anon key)
4. Replace `YOUR_SERVICE_ROLE_KEY_HERE` with the actual key

**Security Warning**: 
- ⚠️ Never commit this key to Git
- ⚠️ Never expose it to client-side code
- ⚠️ Only use it in server-side API routes

---

### ✅ Fix 3: Improved Error Handling & Debugging

**File**: `/web/src/components/GoogleSignInButton.tsx`

**Improvements**:
- ✅ Added configuration validation
- ✅ Added Google OAuth scopes (profile, email)
- ✅ Added detailed console logging for debugging
- ✅ Better error messages for users
- ✅ Fixed session token property names (accessToken, refreshToken)

**Console Output** (for debugging):
```
🔐 Initiating Google Sign-In...
✅ Google Sign-In successful, getting ID token...
📤 Sending ID token to backend for verification...
✅ Authentication successful!
✅ Supabase session established
```

**User-friendly error messages**:
- "Sign-in was cancelled" (if user closes popup)
- "Pop-up was blocked. Please allow pop-ups for this site."
- "Network error. Please check your connection."
- "Session expired. Please try again."
- "Google Sign-In is not configured correctly. Please contact support."

---

## Setup Instructions

### Step 1: Get Your Supabase Service Role Key

```bash
# Option A: Use the Supabase Dashboard
# 1. Go to: https://supabase.com/dashboard/project/lvvvjywrmpcqrpvuptdi/settings/api
# 2. Copy the "service_role" key (keep it secret!)

# Option B: Use Supabase CLI (if installed)
cd /home/king/Desktop/edudashpro
supabase status
# Look for "service_role key" in the output
```

### Step 2: Update .env.local

```bash
cd /home/king/Desktop/edudashpro/web

# Edit .env.local and replace YOUR_SERVICE_ROLE_KEY_HERE with the actual key
nano .env.local
# or
code .env.local
```

Find this line:
```bash
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY_HERE"
```

Replace with:
```bash
SUPABASE_SERVICE_ROLE_KEY="eyJhbGc...YOUR_ACTUAL_KEY_HERE...xyz"
```

### Step 3: Add to Vercel (for Production)

```bash
# Option A: Via Vercel Dashboard
# 1. Go to: https://vercel.com/your-project/settings/environment-variables
# 2. Add: SUPABASE_SERVICE_ROLE_KEY = <your-key>
# 3. Environment: Production, Preview (optional)

# Option B: Via Vercel CLI
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste your service role key when prompted
```

### Step 4: Restart Development Server

```bash
# Stop current server (Ctrl+C)
# Then restart
cd /home/king/Desktop/edudashpro/web
npm run dev
```

### Step 5: Test Google Sign-In

1. Open: http://localhost:3000/sign-in
2. Click "Sign in with Google"
3. Select your Google account
4. Should see: ✅ Success!

---

## Verification Checklist

### ✅ Before Testing
- [ ] `SUPABASE_SERVICE_ROLE_KEY` added to `.env.local`
- [ ] Development server restarted
- [ ] Browser cache cleared (Ctrl+Shift+R)
- [ ] Pop-ups enabled for localhost

### ✅ Expected Behavior
- [ ] No COOP errors in console
- [ ] Google popup opens successfully
- [ ] No 401 Unauthorized errors
- [ ] Console shows "✅ Authentication successful!"
- [ ] Console shows "✅ Supabase session established"
- [ ] User is redirected to dashboard

### ✅ Production Deployment
- [ ] `SUPABASE_SERVICE_ROLE_KEY` added to Vercel
- [ ] Deployed with updated `next.config.ts`
- [ ] Tested on production URL
- [ ] No COOP errors on production

---

## Testing the API Endpoint

### Test Configuration:
```bash
curl http://localhost:3000/api/auth/google
```

**Expected Response** (if configured correctly):
```json
{
  "configured": true,
  "firebase": true,
  "supabase": true,
  "message": "Google Sign-In is ready"
}
```

**If not configured**:
```json
{
  "configured": false,
  "firebase": true,
  "supabase": false,
  "message": "Google Sign-In not fully configured"
}
```

---

## Troubleshooting

### Issue: Still seeing "Invalid or expired token"

**Solution**:
1. Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
2. Check it's not the anon key (should start with `eyJhbGc...`)
3. Restart dev server
4. Clear browser cache

### Issue: "Pop-up blocked"

**Solution**:
1. Enable pop-ups for localhost
2. Chrome: Click 🚫 icon in address bar → "Always allow"
3. Try again

### Issue: COOP warnings still appearing

**Solution**:
1. Verify `next.config.ts` was saved
2. Restart dev server (important!)
3. Hard refresh browser (Ctrl+Shift+R)

### Issue: "Authentication service not configured"

**Solution**:
```bash
# Check environment variables are loaded
cd /home/king/Desktop/edudashpro/web
node -e "console.log(process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing')"

# If Missing, check .env.local file exists and has the key
ls -la .env.local
cat .env.local | grep SUPABASE_SERVICE_ROLE_KEY
```

### Issue: Network errors in production

**Solution**:
1. Check Vercel environment variables are set
2. Verify Firebase Auth domain matches production URL
3. Check CORS settings in Firebase Console
4. Ensure Supabase project is accessible

---

## Security Best Practices

### ✅ DO:
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret
- Use it only in server-side code (API routes)
- Add it to `.gitignore` (via .env.local)
- Rotate keys periodically
- Use different keys for dev/prod

### ❌ DON'T:
- Commit service role key to Git
- Expose it to client-side code
- Share it publicly
- Use it in environment variables starting with `NEXT_PUBLIC_`

---

## Files Modified

1. ✅ `/web/next.config.ts` - Added COOP headers
2. ✅ `/web/.env.local` - Added SUPABASE_SERVICE_ROLE_KEY placeholder
3. ✅ `/web/src/components/GoogleSignInButton.tsx` - Improved error handling

---

## Summary

### What Was Fixed:
- ✅ Cross-Origin-Opener-Policy errors
- ✅ 401 Unauthorized errors
- ✅ Invalid/expired token errors
- ✅ Poor error messages
- ✅ Missing debugging information

### What You Need to Do:
1. 🔑 Add your Supabase Service Role Key to `.env.local`
2. 🔁 Restart development server
3. 🧪 Test Google Sign-In
4. 🚀 Add key to Vercel for production

### Expected Result:
```
🔐 Initiating Google Sign-In...
✅ Google Sign-In successful, getting ID token...
📤 Sending ID token to backend for verification...
✅ Authentication successful!
✅ Supabase session established
```

**Status**: Ready to test once Service Role Key is added! 🚀
