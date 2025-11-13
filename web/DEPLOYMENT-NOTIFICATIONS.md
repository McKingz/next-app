# Deployment Push Notifications Setup

## Overview
Automatically notify users when new versions are deployed to Vercel.

## ✅ What's Implemented

### 1. Push Notification Infrastructure
- **Service Worker** (`/public/sw.js`) - Handles push notifications
- **PWA Update Checker** - Shows UI banner for updates
- **Deployment Notifications** - Sends push when deployed

### 2. Firebase Cloud Messaging Integration
- **Firebase Admin SDK** (`/src/lib/firebase-admin.ts`) - Server-side FCM
- **Environment Variables** - Secure credential storage
- **Topic Subscriptions** - Users auto-subscribe to 'updates' topic

### 3. API Endpoints
- **POST `/api/notifications/deployment`** - Trigger deployment notification
- **POST `/api/notifications/subscribe`** - Subscribe to push notifications
- **DELETE `/api/notifications/subscribe`** - Unsubscribe

### 4. Database
- **`push_subscriptions` table** - Stores user subscriptions
- **RLS policies** - Secure access control

---

## 🔧 Vercel Setup Instructions

### Step 1: Fix Root Directory Setting

**Vercel is looking for Next.js in the wrong directory!**

1. Go to: https://vercel.com/k1ng51-devops/edupro/settings/general
2. Find **"Root Directory"**
3. Click **Edit**
4. Change from `.` to `web`
5. Click **Save**

This fixes the error: `"Error: No Next.js version detected"`

### Step 2: Add Firebase Environment Variables

Go to: https://vercel.com/k1ng51-devops/edupro/settings/environment-variables

Add these variables (you've already set them):

```
FIREBASE_PROJECT_ID=edudashpro
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@edudashpro.iam.gserviceaccount.com
```

**Make sure to set scope: "All Environments"**

### Step 3: Add Deployment Webhook Secret (Optional)

Add this for security (prevents unauthorized deployment notifications):

```
DEPLOYMENT_WEBHOOK_SECRET=your-random-secret-here
```

Generate a random secret:
```bash
openssl rand -base64 32
```

### Step 4: Add Supabase Service Role Key (if not already set)

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 🚀 How It Works

### Automatic Flow:

1. **User visits web app** → Service worker registers
2. **User grants notification permission** → Subscribes to 'updates' topic
3. **Developer deploys to Vercel** → New version deployed
4. **Deployment webhook triggers** → Calls `/api/notifications/deployment`
5. **Server sends FCM notification** → All subscribed users receive push
6. **User sees notification** → "EduDash Pro Updated! 🎉"
7. **User clicks "Update" button** → Page refreshes to new version

### Components Involved:

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Deployment                         │
│  (New version deployed → triggers webhook)                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│          POST /api/notifications/deployment                 │
│  - Gets Firebase access token                               │
│  - Sends FCM message to 'updates' topic                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Firebase Cloud Messaging                        │
│  (Sends push notification to all subscribed users)          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                Service Worker (/sw.js)                      │
│  - Receives push event                                      │
│  - Shows notification banner                                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              PWAUpdateChecker Component                      │
│  - Detects new service worker                               │
│  - Shows "Update Available" UI                              │
│  - User clicks "Update" → page reloads                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Manual Testing

### Test the notification system:

```bash
# 1. Check if Firebase is configured
curl https://your-vercel-domain.vercel.app/api/notifications/deployment

# Expected response:
{
  "configured": true,
  "message": "Push notifications are configured"
}

# 2. Trigger a deployment notification manually
curl -X POST https://your-vercel-domain.vercel.app/api/notifications/deployment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_DEPLOYMENT_WEBHOOK_SECRET" \
  -d '{"version": "1.0.2"}'

# Expected response:
{
  "success": true,
  "message": "Deployment notification sent",
  "version": "1.0.2"
}
```

### Test in browser:

1. Visit your web app
2. Grant notification permission when prompted
3. Open DevTools → Application → Service Workers
4. Verify service worker is active
5. Application → Push Messaging → Test push notification
6. You should see a notification appear

---

## 🔄 Automated Deployment Notifications

### Option A: Use Vercel Deploy Hook + GitHub Action

1. Create Vercel Deploy Hook:
   - Go to: Settings → Git → Deploy Hooks
   - Create hook named "deployment-notification"
   - Copy the webhook URL

2. Add GitHub Action (`.github/workflows/deploy-notification.yml`):

```yaml
name: Deployment Notification

on:
  deployment_status:

jobs:
  notify:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - name: Send Deployment Notification
        run: |
          curl -X POST https://your-domain.vercel.app/api/notifications/deployment \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.DEPLOYMENT_WEBHOOK_SECRET }}" \
            -d "{\"version\": \"${{ github.sha }}\"}"
```

### Option B: Vercel Build Hook (Simpler)

Add this to your `vercel.json`:

```json
{
  "buildCommand": "npm run build && npm run notify-deployment",
  "scripts": {
    "notify-deployment": "node scripts/notify-deployment.js"
  }
}
```

Create `scripts/notify-deployment.js`:

```javascript
async function notifyDeployment() {
  try {
    const response = await fetch(process.env.VERCEL_URL + '/api/notifications/deployment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEPLOYMENT_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify({
        version: process.env.npm_package_version,
      }),
    });
    
    if (response.ok) {
      console.log('✅ Deployment notification sent');
    }
  } catch (error) {
    console.error('❌ Failed to send deployment notification:', error);
  }
}

notifyDeployment();
```

---

## 🐛 Troubleshooting

### "No Next.js version detected"
- ✅ Fix: Set Root Directory to `web` in Vercel settings

### Push notifications not working:
1. Check HTTPS (required for push notifications)
2. Verify Firebase env vars are set in Vercel
3. Check browser DevTools → Console for errors
4. Verify service worker is registered
5. Check notification permission is granted

### Deployment notifications not sent:
1. Verify Firebase credentials are correct
2. Check `/api/notifications/deployment` endpoint works
3. Verify users are subscribed to 'updates' topic
4. Check Vercel Function logs for errors

### Database errors:
1. Run the migration: `web/migrations/create_push_subscriptions.sql`
2. Verify Supabase connection is working
3. Check RLS policies allow subscription inserts

---

## 📊 Monitoring

### Check subscription stats:

```sql
-- How many users are subscribed?
SELECT COUNT(*) FROM push_subscriptions;

-- Which topics are popular?
SELECT topics, COUNT(*) 
FROM push_subscriptions 
GROUP BY topics;

-- Recent subscriptions
SELECT * FROM push_subscriptions 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Vercel Function Logs:
https://vercel.com/k1ng51-devops/edupro/logs

Look for:
- `✅ Push notification sent successfully`
- `🚀 Sending deployment notification`

---

## 🎉 Success Criteria

When everything is working:

1. ✅ Vercel builds successfully (Root Directory = `web`)
2. ✅ Users can visit the web app
3. ✅ Users are prompted for notification permission
4. ✅ Users are subscribed to 'updates' topic
5. ✅ When you deploy, users receive a push notification
6. ✅ Users see "Update Available" banner
7. ✅ Users can click "Update" to reload
8. ✅ New version loads successfully

---

## 🔐 Security Notes

- ✅ Firebase credentials stored in Vercel env vars (encrypted)
- ✅ Webhook endpoint protected with secret
- ✅ RLS policies prevent unauthorized access
- ✅ No secrets committed to git
- ⚠️ Consider rotating Firebase key (was briefly exposed)

---

## 📚 Related Files

- `/public/sw.js` - Service worker
- `/src/lib/firebase-admin.ts` - Firebase FCM logic
- `/src/app/api/notifications/deployment/route.ts` - Deployment webhook
- `/src/app/api/notifications/subscribe/route.ts` - Subscribe API
- `/src/hooks/useDeploymentNotifications.ts` - Auto-subscribe hook
- `/src/components/PWAUpdateChecker.tsx` - Update UI banner
- `/src/components/DeploymentNotificationProvider.tsx` - Provider component
- `/web/migrations/create_push_subscriptions.sql` - Database migration

---

## 🚧 Next Steps (Optional Enhancements)

1. **Add unsubscribe UI** - Let users opt-out of notifications
2. **Per-user preferences** - Choose which notifications to receive
3. **Analytics** - Track notification delivery and click rates
4. **A/B testing** - Test different notification messages
5. **Scheduled notifications** - Send at optimal times
6. **Multi-language** - Translate notifications
7. **Rich notifications** - Add images, actions, buttons
8. **Notification history** - Show past notifications in UI

---

## ✅ Current Status

- [x] Service worker configured
- [x] Firebase integration ready
- [x] API endpoints created
- [x] Database migration prepared
- [x] Auto-subscribe implemented
- [x] Update UI banner working
- [ ] **Vercel Root Directory** - ⚠️ YOU NEED TO SET THIS
- [ ] **Run database migration** - Apply `create_push_subscriptions.sql`
- [ ] **Test deployment notification** - Deploy and verify push works

**Next action: Set Vercel Root Directory to `web`**
