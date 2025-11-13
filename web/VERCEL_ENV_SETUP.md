# Vercel Environment Variables Setup

## Required Variables for Deployment Notifications

### 🔴 CRITICAL - Add to Vercel Now

Go to: **https://vercel.com/your-project/settings/environment-variables**

### Add These Variables:

#### 1. DEPLOYMENT_WEBHOOK_SECRET
```
Name: DEPLOYMENT_WEBHOOK_SECRET
Value: edudash-deploy-webhook-2024
Environment: ✅ Production, ✅ Preview (optional), ❌ Development
```

**Why?** This authenticates the deployment notification webhook to prevent unauthorized access.

#### 2. DEPLOYMENT_WEBHOOK_URL (Optional - auto-detected)
```
Name: DEPLOYMENT_WEBHOOK_URL
Value: https://edudashpro.org.za/api/notifications/deployment
Environment: ✅ Production, ✅ Preview (optional), ❌ Development
```

**Why?** The script uses `NEXT_PUBLIC_WEB_URL` by default, but this overrides it if needed.

---

## 🟡 Optional - Team Notifications

### Slack Webhook (for team deployment alerts)
```
Name: SLACK_DEPLOYMENT_WEBHOOK
Value: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
Environment: ✅ Production, ✅ Preview (optional), ❌ Development
```

**How to get Slack webhook:**
1. Go to https://api.slack.com/apps
2. Create a new app or use existing
3. Enable "Incoming Webhooks"
4. Add webhook to your channel
5. Copy the webhook URL

### Discord Webhook (for team deployment alerts)
```
Name: DISCORD_DEPLOYMENT_WEBHOOK
Value: https://discord.com/api/webhooks/YOUR/WEBHOOK/URL
Environment: ✅ Production, ✅ Preview (optional), ❌ Development
```

**How to get Discord webhook:**
1. Go to your Discord server
2. Server Settings → Integrations → Webhooks
3. Create a webhook for your channel
4. Copy the webhook URL

---

## 📋 Step-by-Step Vercel Setup

### Method 1: Via Vercel Dashboard (Recommended)

1. **Go to your project on Vercel**
   ```
   https://vercel.com/[your-username]/edudashpro
   ```

2. **Navigate to Settings**
   - Click "Settings" tab
   - Click "Environment Variables" in sidebar

3. **Add DEPLOYMENT_WEBHOOK_SECRET**
   - Click "Add New"
   - Name: `DEPLOYMENT_WEBHOOK_SECRET`
   - Value: `edudash-deploy-webhook-2024`
   - Environments: Check ✅ **Production**
   - Click "Save"

4. **Add DEPLOYMENT_WEBHOOK_URL (Optional)**
   - Click "Add New"
   - Name: `DEPLOYMENT_WEBHOOK_URL`
   - Value: `https://edudashpro.org.za/api/notifications/deployment`
   - Environments: Check ✅ **Production**
   - Click "Save"

5. **Add Slack/Discord (Optional)**
   - Follow same process for `SLACK_DEPLOYMENT_WEBHOOK`
   - Follow same process for `DISCORD_DEPLOYMENT_WEBHOOK`

6. **Redeploy**
   - Go to "Deployments" tab
   - Click "⋯" on latest deployment
   - Click "Redeploy"
   - Or just push a new commit

### Method 2: Via Vercel CLI

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login
vercel login

# Link to your project (if not already)
cd /home/king/Desktop/edudashpro/web
vercel link

# Add environment variables
vercel env add DEPLOYMENT_WEBHOOK_SECRET production
# When prompted, enter: edudash-deploy-webhook-2024

vercel env add DEPLOYMENT_WEBHOOK_URL production
# When prompted, enter: https://edudashpro.org.za/api/notifications/deployment

# Optional: Add Slack
vercel env add SLACK_DEPLOYMENT_WEBHOOK production
# Enter your Slack webhook URL

# Optional: Add Discord
vercel env add DISCORD_DEPLOYMENT_WEBHOOK production
# Enter your Discord webhook URL

# Redeploy
vercel --prod
```

---

## ✅ Verification Checklist

After adding environment variables to Vercel:

### 1. Check Variables Are Set
```bash
# List all environment variables (sensitive values hidden)
vercel env ls
```

Should show:
```
✓ DEPLOYMENT_WEBHOOK_SECRET (Production)
✓ DEPLOYMENT_WEBHOOK_URL (Production)
```

### 2. Trigger a Deployment
```bash
# Make a small change and deploy
git add .
git commit -m "test: verify deployment notifications"
git push
```

### 3. Check Deployment Logs
In Vercel deployment logs, you should see:
```
✅ Deployment notification sent successfully!
   Message: Deployment notification received and processed
   Version: 1.0.2
```

Instead of:
```
❌ Failed to send deployment notification: 
   Unexpected token '<', "<!DOCTYPE"...
```

### 4. Test the Health Endpoint
```bash
curl https://edudashpro.org.za/api/notifications/deployment
```

Should return:
```json
{
  "status": "ok",
  "endpoint": "deployment-notifications",
  "configuration": {
    "firebase": true,
    "slack": false,
    "discord": false
  }
}
```

---

## 🔒 Security Notes

### ✅ DO:
- Use strong, unique webhook secrets
- Only enable in Production (unless testing in Preview)
- Rotate secrets periodically
- Keep Discord/Slack webhooks private
- Use environment-specific URLs if needed

### ❌ DON'T:
- Commit webhook secrets to Git (they're already in .gitignore via .env.local)
- Share webhook URLs publicly
- Use the same secret across multiple projects
- Enable in Development environment (unnecessary)

---

## 🎯 What Happens After Setup

### On Every Production Deployment:

1. **Build Completes** ✅
   ```
   ✓ Compiled successfully
   ✓ Linting and checking validity of types
   ✓ Collecting page data
   ```

2. **Post-Build Hook Runs** 📤
   ```
   > web@0.1.0 postbuild
   > node scripts/notify-deployment.js || true
   
   🚀 Sending deployment notification
   📦 Version: 1.0.2
   🌍 Environment: production
   ```

3. **Webhook Endpoint Receives Notification** 📨
   ```
   📦 Deployment notification received:
   - version: 1.0.2
   - environment: production
   - buildId: abc1234
   - branch: main
   ```

4. **Notifications Sent** 🔔
   - ✅ Firebase push notifications (if configured)
   - ✅ Slack message (if configured)
   - ✅ Discord message (if configured)

5. **Response Logged** ✅
   ```
   ✅ Deployment notification sent successfully!
      Message: Deployment notification received and processed
      Version: 1.0.2
   ```

---

## 🚨 Troubleshooting

### "Environment variable not found"
- Make sure you saved the variable in Vercel
- Check you selected the right environment (Production)
- Redeploy after adding variables

### Still seeing "<!DOCTYPE" error
- Verify the API route exists: `/web/src/app/api/notifications/deployment/route.ts`
- Check the route was deployed (view deployment files in Vercel)
- Test the endpoint directly: `curl https://edudashpro.org.za/api/notifications/deployment`

### "Unauthorized" error
- Check `DEPLOYMENT_WEBHOOK_SECRET` matches in:
  - Vercel environment variables
  - Local `.env.local`
- Make sure there are no extra spaces or quotes

### Webhook not sending notifications
- Check Firebase configuration is complete
- Verify Slack/Discord webhook URLs are valid
- Review Vercel function logs for errors
- Test endpoint manually with curl

---

## 📊 Monitoring

### View Deployment Logs
1. Go to Vercel dashboard
2. Click "Deployments"
3. Click on a deployment
4. Scroll to "Build Logs"
5. Look for "postbuild" section

### View Function Logs
1. Go to Vercel dashboard
2. Click "Logs" tab
3. Filter by: `/api/notifications/deployment`
4. View real-time requests and responses

---

## Summary

### Minimum Required (for notifications to work):
```
✅ DEPLOYMENT_WEBHOOK_SECRET = edudash-deploy-webhook-2024
```

### Recommended (for better control):
```
✅ DEPLOYMENT_WEBHOOK_SECRET = edudash-deploy-webhook-2024
✅ DEPLOYMENT_WEBHOOK_URL = https://edudashpro.org.za/api/notifications/deployment
```

### Full Setup (for team collaboration):
```
✅ DEPLOYMENT_WEBHOOK_SECRET = edudash-deploy-webhook-2024
✅ DEPLOYMENT_WEBHOOK_URL = https://edudashpro.org.za/api/notifications/deployment
✅ SLACK_DEPLOYMENT_WEBHOOK = https://hooks.slack.com/...
✅ DISCORD_DEPLOYMENT_WEBHOOK = https://discord.com/api/webhooks/...
```

**Next Step:** Add `DEPLOYMENT_WEBHOOK_SECRET` to Vercel and redeploy! 🚀
