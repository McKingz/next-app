# OAuth Consolidation - Supabase Only

## Decision: Use Supabase OAuth (Remove Firebase)

**Date**: 2025-11-09  
**Status**: Implemented

## Previous State (Mixed Implementation)

The application had **two different OAuth implementations** running simultaneously:

1. **Firebase OAuth** → Backend API → Supabase (complex flow)
2. **Supabase OAuth** → Direct (simple flow)

This caused:
- Double sign-in prompts
- Confusion in codebase
- Unnecessary Firebase dependency
- Harder debugging and maintenance

## New State (Consolidated)

**All Google OAuth now uses Supabase native implementation:**

```typescript
// Single OAuth flow
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${origin}/auth/callback?next=/dashboard`,
    queryParams: {
      access_type: 'offline',
      prompt: 'select_account',
    }
  }
})
```

## Benefits

✅ **Simpler Architecture**: One auth provider instead of two  
✅ **Better Performance**: Direct Google → Supabase flow  
✅ **Easier Maintenance**: Single codebase path  
✅ **Cost Effective**: No Firebase project needed  
✅ **Native Integration**: Supabase handles tokens automatically  
✅ **Single Sign-In**: No more double prompts

## Files Modified

### 1. `GoogleSignInButton.tsx` - Consolidated to Supabase
**Before**: 165 lines with Firebase implementation  
**After**: 95 lines with Supabase OAuth

**Changes**:
- Removed Firebase dependencies
- Removed backend API call to `/api/auth/google`
- Uses `supabase.auth.signInWithOAuth()` directly
- Added `isSignup` and `redirectTo` props for flexibility

### 2. Auth Flow (Unchanged)
- `/auth/callback/route.ts` - Handles OAuth callback
- Auto-activates 7-day trial for new independent users
- Properly detects signup vs login flows

## Configuration Required

### Supabase Dashboard Configuration

1. Go to **Authentication** → **Providers** → **Google**
2. Enable Google provider
3. Add authorized redirect URLs:
   ```
   https://[your-project].supabase.co/auth/v1/callback
   ```
4. Configure Google OAuth consent screen in Google Cloud Console

### Environment Variables

```bash
# .env.local (for web app)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# No Firebase variables needed anymore!
```

## Components Using OAuth

### `GoogleSignInButton` Component
```typescript
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

// For signup flows
<GoogleSignInButton 
  isSignup={true}
  redirectTo="/dashboard/parent"
  onError={(error) => console.error(error)}
>
  Sign up with Google
</GoogleSignInButton>

// For login flows
<GoogleSignInButton 
  isSignup={false}
  redirectTo="/dashboard/parent"
>
  Sign in with Google
</GoogleSignInButton>
```

### Direct Usage in Pages
```typescript
const supabase = createClient();

await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/parent&signup=true`,
    queryParams: {
      access_type: 'offline',
      prompt: 'select_account',
    },
    data: {
      role: 'parent',
      signup_flow: 'true',
    }
  }
});
```

## Removed/Deprecated

### Files No Longer Needed
- `/api/auth/google/route.ts` - Backend Firebase handler (can be deleted)
- `/lib/firebase-google-auth.ts` - Firebase utilities (can be deleted)
- `/lib/firebase-admin.ts` - Firebase admin SDK (can be deleted)

### Environment Variables No Longer Needed
```bash
# These can be removed
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
```

## Testing

### Test OAuth Flow
1. Go to `/sign-up/parent` or `/sign-in`
2. Click "Sign in/up with Google"
3. Should redirect to Google **once** (not twice)
4. After authentication, should redirect to dashboard
5. For new users: Trial banner should appear immediately

### Verify Trial Activation
1. Sign up as new user with Google OAuth
2. Check console logs for: `[Auth Callback] ✅ 7-day Premium trial started`
3. Visit `/dashboard/parent` 
4. Verify trial banner appears showing "7 Days Left"

## Rollback Plan

If issues arise, revert these commits:
1. `GoogleSignInButton.tsx` consolidation
2. Auth callback signup flag handling

The old Firebase flow files are still in the repository but unused.

## Future Considerations

- Can add other OAuth providers (GitHub, Azure, etc.) using same Supabase pattern
- Consider adding social login analytics tracking
- May want to customize OAuth consent screen text
