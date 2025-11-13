# ⚠️ CRITICAL: Vercel Configuration Required

## The Error You're Seeing

```
Error: No Next.js version detected. Make sure your package.json has "next" 
in either "dependencies" or "devDependencies". Also check your Root Directory 
setting matches the directory of your package.json file.
```

## ✅ How to Fix (2 minutes)

### 1. Set Root Directory to `web`

**Vercel is looking in the wrong folder!** Your Next.js app is in the `web/` directory.

1. Go to: **https://vercel.com/k1ng51-devops/edupro/settings/general**
2. Scroll to **"Root Directory"**
3. Click **"Edit"**
4. Change from ` . ` (root) to `web`
5. Click **"Save"**

### 2. Verify Build Settings

While you're there, verify:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

### 3. Redeploy

After saving, click **"Redeploy"** to trigger a new build.

---

## 🔐 Environment Variables You Need

Make sure these are set in Vercel → Settings → Environment Variables:

### Required (Already Set ✅):
```
FIREBASE_PROJECT_ID=edudashpro
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@edudashpro.iam.gserviceaccount.com
```

### Optional (Recommended):
```
DEPLOYMENT_WEBHOOK_SECRET=your-random-secret-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Generate webhook secret:
```bash
openssl rand -base64 32
```

---

## 📁 Project Structure

```
edupro/
├── package.json           ← React Native/Expo (mobile)
├── web/                   ← Next.js (WEB) ✅ SET THIS AS ROOT
│   ├── package.json       ← Has "next": "16.0.0"
│   ├── src/
│   ├── public/
│   └── ...
├── android/
├── ios/
└── ...
```

**The Vercel Root Directory MUST be `web`** because that's where the Next.js app lives.

---

## ✅ Expected Result

After setting Root Directory to `web`, Vercel will:

1. ✅ Detect Next.js 16.0.0 in `web/package.json`
2. ✅ Run `npm run build` inside the `web/` directory
3. ✅ Build successfully
4. ✅ Deploy your web app
5. ✅ Send push notifications to users (if Firebase is configured)

---

## 🚀 Deployment Notifications

Once deployed, users will automatically receive push notifications when you deploy:

1. User visits web app → Subscribes to updates
2. You push to GitHub → Vercel builds
3. Build succeeds → Runs `postbuild` script
4. `notify-deployment.js` → Sends FCM notification
5. User receives push → "EduDash Pro Updated! 🎉"
6. User clicks "Update" → Page refreshes

---

## 🐛 Still Having Issues?

### Check the build logs:

1. Go to: https://vercel.com/k1ng51-devops/edupro/deployments
2. Click on the failed deployment
3. Look for errors in the build log

### Common issues:

**"Cannot find module '@/lib/supabase/server'"**
- This is expected - we use client-side Supabase in the web app
- The API routes use `@supabase/supabase-js` directly

**"Firebase not configured"**
- Check environment variables are set correctly
- Verify FIREBASE_PRIVATE_KEY has `\n` preserved (not actual newlines)

**"Push notifications not working"**
- HTTPS required (Vercel provides this automatically)
- Users must grant notification permission
- Service worker must be registered

---

## 📞 Need Help?

If you're still stuck after setting Root Directory to `web`:

1. Check Vercel build logs for specific errors
2. Verify all environment variables are set
3. Try a fresh deployment: **"Redeploy"** → **"Use existing build cache: No"**

---

## 🎉 Success Checklist

- [ ] Root Directory set to `web` in Vercel
- [ ] Deployment succeeds
- [ ] Web app loads at your-domain.vercel.app
- [ ] Service worker registers
- [ ] Users can subscribe to notifications
- [ ] Deployment notifications are sent

---

**👉 NEXT STEP: Set Root Directory to `web` in Vercel settings NOW**
