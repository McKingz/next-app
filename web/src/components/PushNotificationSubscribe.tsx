'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, BellOff } from 'lucide-react';

const VAPID_PUBLIC_KEY = 'BHOCSq7oH9Xn1NopQcMTw_ijbBpq-V-2Ux_6DuIzKe3pGt0BDF2LOwzYYajy6EccmDhWV2lpFcX4w_NuKwiZDnQ';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array;
}

export function PushNotificationSubscribe() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [userId, setUserId] = useState<string>();
  const supabase = createClient();

  useEffect(() => {
    const init = async () => {
      // Check if notifications are supported
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return;
      }

      setPermission(Notification.permission);

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
      }

      // Check if already subscribed
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    };

    init();
  }, [supabase]);

  const handleSubscribe = async () => {
    if (!userId) return;

    try {
      setIsLoading(true);

      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        alert('Notification permission denied');
        return;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Get user's preschool_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('preschool_id')
        .eq('id', userId)
        .maybeSingle();

      // Save subscription to database
      const subscriptionJson = subscription.toJSON();
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: userId,
          preschool_id: profile?.preschool_id || null,
          endpoint: subscriptionJson.endpoint!,
          p256dh: subscriptionJson.keys!.p256dh!,
          auth: subscriptionJson.keys!.auth!,
          user_agent: navigator.userAgent,
        }, {
          onConflict: 'user_id,endpoint',
        });

      if (error) {
        console.error('Failed to save subscription:', error);
        alert('Failed to save notification subscription');
        return;
      }

      setIsSubscribed(true);
      alert('✅ Push notifications enabled!');
    } catch (error) {
      console.error('Subscription error:', error);
      alert('Failed to subscribe to push notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!userId) return;

    try {
      setIsLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      alert('Push notifications disabled');
    } catch (error) {
      console.error('Unsubscribe error:', error);
      alert('Failed to unsubscribe from push notifications');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if notifications not supported
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }

  // Don't show if not logged in
  if (!userId) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {isSubscribed ? (
        <button
          onClick={handleUnsubscribe}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg transition-colors"
          title="Disable push notifications"
        >
          <BellOff size={18} />
          <span className="text-sm font-medium">Disable Notifications</span>
        </button>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={isLoading || permission === 'denied'}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          title={permission === 'denied' ? 'Permission denied - check browser settings' : 'Enable push notifications'}
        >
          <Bell size={18} />
          <span className="text-sm font-medium">
            {permission === 'denied' ? 'Notifications Blocked' : 'Enable Notifications'}
          </span>
        </button>
      )}
    </div>
  );
}
