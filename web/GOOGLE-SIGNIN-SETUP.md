# Google Sign-In with Firebase Authentication

## Overview
Complete Google Sign-In integration using Firebase Authentication, synced with Supabase backend.

## ✅ What's Implemented

### 1. Firebase Admin SDK Integration
- **Server-side verification** of Google ID tokens
- **JWT creation** for Firebase Cloud Messaging
- **Secure credential storage** in Vercel environment variables

### 2. Google Authentication API
- **Endpoint**: `POST /api/auth/google`
- **Token verification**: Validates Google ID tokens
- **User sync**: Creates/updates users in Supabase
- **Session generation**: Returns Supabase access/refresh tokens

### 3. Client-Side Component
- **GoogleSignInButton**: React component for sign-in
- **Firebase SDK**: Dynamically loaded (code splitting)
- **Popup authentication**: Google Sign-In popup
- **Automatic sync**: Seamless Supabase session creation

---

## 🔧 Setup Instructions

### Step 1: Install Dependencies

```bash
cd web
npm install firebase@^11.0.2
```

### Step 2: Add Firebase Client Environment Variables

Add these to Vercel → Environment Variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=edudashpro.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=edudashpro
```

Get these from Firebase Console:
1. Go to: https://console.firebase.google.com/project/edudashpro/settings/general
2. Scroll to "Your apps" → Web app
3. Copy the config values

### Step 3: Enable Google Sign-In in Firebase

1. Go to: https://console.firebase.google.com/project/edudashpro/authentication/providers
2. Click "Google" provider
3. Click "Enable"
4. Add authorized domains:
   - `localhost` (for testing)
   - `your-domain.vercel.app` (production)
5. Save

### Step 4: Verify Existing Environment Variables

Already set in Vercel (✅):
```
FIREBASE_PROJECT_ID=edudashpro
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@edudashpro.iam.gserviceaccount.com
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 📋 How It Works

### Authentication Flow:

```
┌─────────────────────────────────────────────────────────────┐
│                   User clicks "Sign in with Google"          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Firebase Authentication (Client)                │
│  - Opens Google Sign-In popup                                │
│  - User selects Google account                               │
│  - Returns Google ID token                                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│          POST /api/auth/google (Server)                     │
│  - Verifies Google ID token signature                       │
│  - Validates token claims (email verified, not expired)     │
│  - Extracts user info (email, name, picture)                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Sync with Supabase (Server)                    │
│  - Creates user in Supabase auth if doesn't exist           │
│  - Updates user metadata (name, picture, provider)          │
│  - Generates Supabase session tokens                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Set Supabase Session (Client)                  │
│  - Sets access_token and refresh_token                      │
│  - User is now authenticated in Supabase                    │
│  - Redirect to dashboard                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 Usage Examples

### Basic Usage

```tsx
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

export default function LoginPage() {
  return (
    <GoogleSignInButton 
      onSuccess={(user) => {
        console.log('Signed in:', user);
        router.push('/dashboard');
      }}
      onError={(error) => {
        toast.error(`Sign-in failed: ${error}`);
      }}
    >
      Sign in with Google
    </GoogleSignInButton>
  );
}
```

### Custom Styling

```tsx
<GoogleSignInButton 
  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg"
  onSuccess={handleSuccess}
>
  Continue with Google
</GoogleSignInButton>
```

### With Loading State

```tsx
const [isLoading, setIsLoading] = useState(false);

<GoogleSignInButton 
  onSuccess={(user) => {
    setIsLoading(true);
    // Redirect or fetch user data
  }}
  onError={(error) => {
    setIsLoading(false);
    showError(error);
  }}
/>
```

---

## 🔐 Security Features

### Token Verification
- ✅ **Signature verification** using Google's public keys
- ✅ **Expiration check** - rejects expired tokens
- ✅ **Audience validation** - ensures token is for your project
- ✅ **Email verification** - only verified emails allowed

### Server-Side Processing
- ✅ All verification happens server-side
- ✅ Client never sees service account credentials
- ✅ Supabase Service Role Key only on server
- ✅ No sensitive data in client code

### Session Management
- ✅ Secure session tokens from Supabase
- ✅ Automatic token refresh
- ✅ HttpOnly cookies (via Supabase)
- ✅ CSRF protection

---

## 📂 Files Created

**Server-Side:**
- `web/src/lib/firebase-google-auth.ts` - Token verification and user sync
- `web/src/app/api/auth/google/route.ts` - Authentication endpoint

**Client-Side:**
- `web/src/components/GoogleSignInButton.tsx` - Sign-in button component

**Configuration:**
- `web/package.json` - Added `firebase@^11.0.2` dependency

---

## 🧪 Testing

### Test Configuration

```bash
# Check if Google auth is configured
curl https://your-domain.vercel.app/api/auth/google

# Expected response:
{
  "configured": true,
  "firebase": true,
  "supabase": true,
  "message": "Google Sign-In is ready"
}
```

### Test Sign-In Flow

1. Add the button to your login page
2. Click "Sign in with Google"
3. Select Google account in popup
4. Check browser console for success message
5. Verify user is created in Supabase → Authentication
6. Check user metadata includes Google info

### Check Supabase

```sql
-- View users with Google provider
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'provider' as provider,
  raw_user_meta_data->>'full_name' as name,
  created_at
FROM auth.users
WHERE raw_user_meta_data->>'provider' = 'google'
ORDER BY created_at DESC;
```

---

## 🐛 Troubleshooting

### "Firebase not configured"
- ✅ Check `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` in Vercel
- ✅ Check `NEXT_PUBLIC_FIREBASE_*` variables for client

### "Invalid or expired token"
- ✅ Token expires after 1 hour - user needs to sign in again
- ✅ Check system clock is correct
- ✅ Verify Firebase project ID matches

### "Failed to create user session"
- ✅ Check `SUPABASE_SERVICE_ROLE_KEY` is set
- ✅ Verify Supabase URL is correct
- ✅ Check Supabase project is running

### "Email not verified"
- ✅ Google accounts are auto-verified
- ✅ If user has unverified email, they'll see error
- ✅ Direct user to verify email in Google account

### Popup Blocked
- ✅ Check browser popup blocker settings
- ✅ Ensure HTTPS (required for Firebase Auth)
- ✅ Try incognito mode to test

---

## 🔄 Migration Path

### For Existing Users

If users already have accounts with email/password:

1. **Email Matching**: Firebase uses email to match accounts
2. **Account Linking**: Supabase will link Google provider to existing account
3. **Metadata Update**: Google info (name, picture) will be added
4. **No Data Loss**: All existing user data is preserved

### Database Query

```sql
-- Check if user already exists before Google sign-in
SELECT * FROM auth.users WHERE email = 'user@example.com';

-- After Google sign-in, check provider is added
SELECT 
  email, 
  raw_user_meta_data->'providers' as providers 
FROM auth.users 
WHERE email = 'user@example.com';
```

---

## 🎨 UI Customization

### Default Button Styles

The component includes a default Google-style button:
- White background
- Gray border
- Google logo (SVG)
- Hover effects
- Loading spinner

### Override Styles

```tsx
<GoogleSignInButton className="your-custom-classes">
  Custom Text
</GoogleSignInButton>
```

### Dark Mode Support

```tsx
<GoogleSignInButton 
  className={`
    ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-700'}
    hover:shadow-lg transition-all
  `}
/>
```

---

## 📊 Analytics & Monitoring

### Track Sign-In Events

```tsx
<GoogleSignInButton 
  onSuccess={(user) => {
    // Analytics
    analytics.track('google_signin_success', {
      userId: user.id,
      email: user.email,
      provider: 'google',
    });
    
    // Redirect
    router.push('/dashboard');
  }}
  onError={(error) => {
    // Error tracking
    analytics.track('google_signin_error', {
      error: error,
      timestamp: new Date(),
    });
  }}
/>
```

### Monitor in Supabase

```sql
-- Google sign-ins today
SELECT COUNT(*) 
FROM auth.users 
WHERE raw_user_meta_data->>'provider' = 'google'
AND created_at >= CURRENT_DATE;

-- Most recent Google sign-ins
SELECT 
  email,
  raw_user_meta_data->>'full_name' as name,
  created_at
FROM auth.users
WHERE raw_user_meta_data->>'provider' = 'google'
ORDER BY created_at DESC
LIMIT 10;
```

---

## ✅ Success Checklist

- [ ] Install `firebase` package in web/
- [ ] Add Firebase client env vars to Vercel
- [ ] Enable Google provider in Firebase Console
- [ ] Add authorized domains
- [ ] Test sign-in flow
- [ ] Verify user created in Supabase
- [ ] Check session tokens work
- [ ] Test on production domain

---

## 🚀 Next Steps (Optional)

1. **Add Sign-In with Apple** - Similar flow with Apple ID
2. **Add Sign-In with Microsoft** - For enterprise users
3. **Social Profile Sync** - Fetch additional Google profile data
4. **Account Linking UI** - Allow users to link multiple providers
5. **Provider Management** - Let users disconnect providers
6. **Two-Factor Auth** - Add 2FA for extra security

---

## 📚 Related Documentation

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Google Sign-In Guide](https://developers.google.com/identity/sign-in/web)

---

**Status**: ✅ Code implemented, ready for testing after npm install
**Note**: No Edge Function redeployment needed - all logic in Next.js API routes
