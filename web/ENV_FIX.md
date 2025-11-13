# Environment Variables Fix

## ? Problem

**Error:** `net::ERR_NAME_NOT_RESOLVED` when trying to connect to Supabase

**Root Cause:** The Next.js web app was missing environment variables.

The root `.env` file uses:
- `EXPO_PUBLIC_SUPABASE_URL` (for React Native mobile app)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

But Next.js requires:
- `NEXT_PUBLIC_SUPABASE_URL` (for web app)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## ? Solution

Created `/workspace/web/.env.local` with the correct environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://lvvvjywrmpcqrpvuptdi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

**Note:** This file is gitignored for security.

## ?? Setup for Other Developers

1. **Copy the example file:**
   ```bash
   cd /workspace/web
   cp .env.example .env.local
   ```

2. **Update with your values:**
   ```bash
   # Get from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

3. **Restart dev server:**
   ```bash
   npm run dev
   ```

## ?? Required Environment Variables

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | Project Settings ? API ? Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key | Project Settings ? API ? `anon` `public` key |
| `NEXT_PUBLIC_DEBUG_SUPABASE` | Debug logging (optional) | Set to `true` for detailed logs |

## ?? How to Verify

1. **Check if file exists:**
   ```bash
   ls -la /workspace/web/.env.local
   ```

2. **Restart dev server:**
   ```bash
   cd /workspace/web
   npm run dev
   ```

3. **Check browser console:**
   - Should see: `[Supabase] Web client initialized { hasUrl: true, hasAnon: true, ... }`
   - No more `ERR_NAME_NOT_RESOLVED` errors

## ?? Important Notes

- **Never commit `.env.local`** - It contains sensitive keys
- **Always use `.env.example`** - Safe template for other developers
- **Restart server** after changing environment variables
- **Clear browser cache** if you still see old errors

## ?? Security

The `.env.local` file is:
- ? Automatically gitignored (see `/workspace/web/.gitignore`)
- ? Never pushed to GitHub
- ? Local to your machine only

The `.env.example` file is:
- ? Committed to GitHub
- ? Contains placeholder values only
- ? Safe for other developers to use as template

---

**Fixed:** 2025-11-02  
**Files Created:**
- `/workspace/web/.env.local` (gitignored)
- `/workspace/web/.env.example` (committed)
