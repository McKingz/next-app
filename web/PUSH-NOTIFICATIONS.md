# Push Notifications Setup

## Overview

EduDash Pro Web now supports Web Push notifications using the Push API and Service Workers.

## Components

### 1. VAPID Keys (Generated)
- **Public Key**: `BHOCSq7oH9Xn1NopQcMTw_ijbBpq-V-2Ux_6DuIzKe3pGt0BDF2LOwzYYajy6EccmDhWV2lpFcX4w_NuKwiZDnQ`
- **Private Key**: `qdFtH6ruCn2b__D7mT_vIAJKhK8i9mhYXVeISRKzGpM`
- **Subject**: `mailto:noreply@edudashpro.org.za`

⚠️ **Security Note**: Store private key in Supabase secrets, not in code.

### 2. Database Table
- **Table**: `push_subscriptions`
- **Columns**: `user_id`, `preschool_id`, `endpoint`, `p256dh`, `auth`, `user_agent`
- **RLS**: Enabled with user-level policies
- **Migration**: `20251030081500_create_push_subscriptions.sql`

### 3. Service Worker (`public/sw.js`)
- **Push Event**: Displays notification with custom payload
- **Notification Click**: Opens app to specified URL
- **Subscription Change**: Auto-resubscribes and updates server

### 4. Client Component (`PushNotificationSubscribe.tsx`)
- **Permission Request**: Asks user for notification permission
- **Subscribe**: Registers push subscription with VAPID key
- **Unsubscribe**: Removes subscription from browser and database
- **Status Display**: Shows enable/disable button based on subscription state

### 5. Edge Function (`send-push`)
- **Endpoint**: `https://[project-ref].supabase.co/functions/v1/send-push`
- **Method**: `POST`
- **Auth**: Requires `Authorization: Bearer <token>`
- **Payload**:
  ```json
  {
    "user_ids": ["uuid1", "uuid2"],
    "payload": {
      "title": "Notification Title",
      "body": "Notification message",
      "icon": "/icon-192.png",
      "data": { "url": "/dashboard/parent" }
    }
  }
  ```

## Usage

### Subscribe to Notifications

Add the component to any authenticated page:

```tsx
import { PushNotificationSubscribe } from '@/components/PushNotificationSubscribe';

export default function Dashboard() {
  return (
    <div>
      <PushNotificationSubscribe />
      {/* Rest of dashboard */}
    </div>
  );
}
```

### Send Notification (Server-Side)

```typescript
const { data, error } = await supabase.functions.invoke('send-push', {
  body: {
    user_ids: ['user-uuid-1', 'user-uuid-2'],
    payload: {
      title: 'New Assignment',
      body: 'You have a new homework assignment',
      icon: '/icon-192.png',
      data: {
        url: '/dashboard/parent/homework',
      },
    },
  },
});
```

### Send to Entire Preschool

```typescript
await supabase.functions.invoke('send-push', {
  body: {
    preschool_id: 'preschool-uuid',
    payload: {
      title: 'School Announcement',
      body: 'Tomorrow is a public holiday',
    },
  },
});
```

## Testing

### 1. Deploy Migration
```bash
supabase db push
```

### 2. Deploy Edge Function
```bash
supabase functions deploy send-push
```

### 3. Test in Browser
1. Open app in Chrome/Edge (HTTPS required)
2. Click "Enable Notifications" button
3. Grant permission when prompted
4. Check Application → Service Workers → Push subscription

### 4. Send Test Notification
```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/send-push \
  -H "Authorization: Bearer [YOUR_TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["your-user-id"],
    "payload": {
      "title": "Test Notification",
      "body": "This is a test push notification"
    }
  }'
```

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Requires HTTPS |
| Edge | ✅ Full | Requires HTTPS |
| Firefox | ✅ Full | Requires HTTPS |
| Safari (macOS) | ✅ Full | Requires HTTPS |
| Safari (iOS) | ⚠️ Limited | iOS 16.4+ only |
| Samsung Internet | ✅ Full | Requires HTTPS |

## Security

1. **HTTPS Required**: Push notifications only work on HTTPS (or localhost)
2. **User Consent**: Always request permission before subscribing
3. **RLS Policies**: Database enforces user-level access control
4. **Service Role**: Edge Function uses service role for sending
5. **VAPID Keys**: Private key stored in Supabase secrets

## Troubleshooting

### Notifications Not Showing
1. Check browser permission: Settings → Site Settings → Notifications
2. Verify service worker is registered: DevTools → Application → Service Workers
3. Check subscription exists: DevTools → Application → Push Messaging

### Subscription Fails
1. Ensure HTTPS is enabled (or using localhost)
2. Check VAPID public key matches in service worker and client
3. Verify service worker is activated

### Edge Function Errors
1. Check Supabase logs: `supabase functions logs send-push`
2. Verify VAPID keys are correct
3. Ensure subscriptions exist in database

## Next Steps

1. Add notification preferences UI (by type: assignments, messages, etc.)
2. Implement notification batching and scheduling
3. Add notification history/inbox
4. Support notification actions (Reply, Dismiss, etc.)
5. Add rich notifications with images

## Resources

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [VAPID Keys](https://blog.mozilla.org/services/2016/04/04/using-vapid-with-webpush/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
