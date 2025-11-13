import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/notifications/subscribe
 * 
 * Subscribe a user to push notifications and specific topics
 */
export async function POST(request: NextRequest) {
  try {
    const { subscription, topics, userId } = await request.json();

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription object required' },
        { status: 400 }
      );
    }

    // Create server-side Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Store subscription in database
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId || null,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.keys?.p256dh || null,
      auth_key: subscription.keys?.auth || null,
      topics: topics || ['updates'],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'endpoint',
    });

    if (error) {
      console.error('Failed to store subscription:', error);
      return NextResponse.json(
        { error: 'Failed to store subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Subscribed to notifications',
      topics: topics || ['updates'],
    });
  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/subscribe
 * 
 * Unsubscribe from push notifications
 */
export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);

    if (error) {
      console.error('Failed to delete subscription:', error);
      return NextResponse.json(
        { error: 'Failed to unsubscribe' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Unsubscribed from notifications',
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
