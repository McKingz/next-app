import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const VAPID_PUBLIC_KEY = 'BHOCSq7oH9Xn1NopQcMTw_ijbBpq-V-2Ux_6DuIzKe3pGt0BDF2LOwzYYajy6EccmDhWV2lpFcX4w_NuKwiZDnQ';
const VAPID_PRIVATE_KEY = 'qdFtH6ruCn2b__D7mT_vIAJKhK8i9mhYXVeISRKzGpM';
const VAPID_SUBJECT = 'mailto:noreply@edudashpro.org.za';

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  requireInteraction?: boolean;
}

interface SendPushRequest {
  user_ids?: string[];
  preschool_id?: string;
  payload: PushPayload;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<void> {
  const payloadString = JSON.stringify(payload);
  
  // Import web-push library
  const webpush = await import('https://esm.sh/web-push@3.6.7');
  
  webpush.default.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    await webpush.default.sendNotification(pushSubscription, payloadString);
  } catch (error: any) {
    // If subscription is invalid (410 Gone), we should remove it
    if (error.statusCode === 410) {
      console.log('Subscription expired:', subscription.endpoint);
      throw new Error('SUBSCRIPTION_EXPIRED');
    }
    throw error;
  }
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request
    const { user_ids, preschool_id, payload }: SendPushRequest = await req.json();

    if (!payload || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload: title and body required' }),
        { status: 400 }
      );
    }

    // Build query to get subscriptions
    let query = supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth');

    if (user_ids && user_ids.length > 0) {
      query = query.in('user_id', user_ids);
    } else if (preschool_id) {
      query = query.eq('preschool_id', preschool_id);
    } else {
      return new Response(
        JSON.stringify({ error: 'Either user_ids or preschool_id required' }),
        { status: 400 }
      );
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) {
      console.error('Failed to fetch subscriptions:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { status: 200 }
      );
    }

    // Send push notifications
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload
        )
      )
    );

    // Count successes and failures
    let sent = 0;
    let failed = 0;
    const expiredSubscriptionIds: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        if (result.reason?.message === 'SUBSCRIPTION_EXPIRED') {
          expiredSubscriptionIds.push(subscriptions[index].id);
        }
      }
    });

    // Remove expired subscriptions
    if (expiredSubscriptionIds.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredSubscriptionIds);
    }

    return new Response(
      JSON.stringify({
        message: 'Push notifications sent',
        sent,
        failed,
        expired: expiredSubscriptionIds.length,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error sending push:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500 }
    );
  }
});
