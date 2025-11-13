import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('EXPO_PUBLIC_GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const CALENDAR_WEBHOOK_TOKEN = Deno.env.get('GOOGLE_CALENDAR_WEBHOOK_TOKEN') || 'edudash_calendar_2024';

// Create Supabase client with service role for bypassing RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  created?: string;
  updated?: string;
}

interface CalendarWebhookPayload {
  kind: string; // 'api#channel'
  id: string; // Channel ID
  resourceId: string;
  resourceUri: string;
  expiration?: string;
}

/**
 * Verify webhook signature from Google
 */
function verifyWebhookToken(headers: Headers): boolean {
  const token = headers.get('X-Goog-Channel-Token');
  return token === CALENDAR_WEBHOOK_TOKEN;
}

/**
 * Refresh OAuth access token if expired
 */
async function refreshAccessToken(userId: string): Promise<string | null> {
  try {
    const { data: tokenData, error } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();

    if (error || !tokenData) {
      console.error('Token not found for user:', userId);
      return null;
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() - now.getTime() > bufferTime) {
      // Token still valid
      return tokenData.access_token;
    }

    // Refresh token
    console.log('Refreshing expired token for user:', userId);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: tokenData.refresh_token,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Token refresh failed:', error);
      return null;
    }

    const newTokens = await response.json();

    // Update database
    await supabase
      .from('oauth_tokens')
      .update({
        access_token: newTokens.access_token,
        expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        last_used_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google');

    return newTokens.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

/**
 * Fetch calendar event details from Google Calendar API
 */
async function fetchCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<GoogleCalendarEvent | null> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch calendar event:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching calendar event:', error);
    return null;
  }
}

/**
 * Sync Google Calendar event to EduDash database
 */
async function syncEventToEduDash(
  event: GoogleCalendarEvent,
  userId: string,
  preschoolId: string
): Promise<void> {
  try {
    console.log('Syncing event to EduDash:', event.id);

    // Check if mapping exists
    const { data: mapping } = await supabase
      .from('calendar_event_mappings')
      .select('*')
      .eq('external_event_id', event.id)
      .eq('provider', 'google')
      .single();

    if (event.status === 'cancelled') {
      // Delete event from EduDash if exists
      if (mapping?.internal_event_id) {
        console.log('Deleting cancelled event from EduDash');
        // TODO: Delete from appropriate internal event table
      }

      // Remove mapping
      await supabase
        .from('calendar_event_mappings')
        .delete()
        .eq('external_event_id', event.id)
        .eq('provider', 'google');

      return;
    }

    // Create or update event in EduDash
    const eventData = {
      title: event.summary,
      description: event.description,
      location: event.location,
      start_time: event.start.dateTime || event.start.date,
      end_time: event.end.dateTime || event.end.date,
      preschool_id: preschoolId,
      created_by: userId,
      // Add more fields as needed based on your internal event schema
    };

    if (mapping?.internal_event_id) {
      // Update existing internal event
      console.log('Updating existing internal event');
      // TODO: Update based on your internal event table structure
    } else {
      // Create new internal event
      console.log('Creating new internal event from Google Calendar');
      // TODO: Insert based on your internal event table structure
      
      // Create mapping
      await supabase.from('calendar_event_mappings').insert({
        preschool_id: preschoolId,
        internal_event_id: null, // Set after creating internal event
        provider: 'google',
        external_event_id: event.id,
        external_calendar_id: 'primary',
        created_by_user_id: userId,
        sync_direction: 'from_external',
        last_synced_at: new Date().toISOString(),
      });
    }

    // Update sync timestamp
    await supabase
      .from('calendar_event_mappings')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('external_event_id', event.id)
      .eq('provider', 'google');

    // Log audit event
    await supabase.from('integration_audit_log').insert({
      integration_type: 'google_calendar',
      action: 'sync_event_from_google',
      user_id: userId,
      preschool_id: preschoolId,
      request_payload: {
        eventId: event.id,
        summary: event.summary,
        status: event.status,
      },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    console.log('Event synced successfully');
  } catch (error) {
    console.error('Error syncing event to EduDash:', error);
    throw error;
  }
}

/**
 * Process calendar webhook notification
 */
async function processCalendarNotification(payload: CalendarWebhookPayload): Promise<void> {
  try {
    console.log('Processing calendar notification:', payload);

    // Find all users with active Google Calendar connections
    const { data: tokens } = await supabase
      .from('oauth_tokens')
      .select('user_id, preschool_id')
      .eq('provider', 'google');

    if (!tokens || tokens.length === 0) {
      console.log('No active Google Calendar connections found');
      return;
    }

    // Process each user's calendar changes
    for (const token of tokens) {
      const accessToken = await refreshAccessToken(token.user_id);
      if (!accessToken) {
        console.warn('Failed to refresh token for user:', token.user_id);
        continue;
      }

      // Fetch recent changes from Google Calendar
      // Note: You would typically use Google Calendar Push Notifications
      // with a sync token to fetch only changed events
      // For now, we'll fetch upcoming events
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' +
          new Date().toISOString() +
          '&maxResults=50&singleEvents=true&orderBy=startTime',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch calendar events for user:', token.user_id);
        continue;
      }

      const data = await response.json();
      const events: GoogleCalendarEvent[] = data.items || [];

      console.log(`Found ${events.length} events for user ${token.user_id}`);

      // Sync each event
      for (const event of events) {
        await syncEventToEduDash(event, token.user_id, token.preschool_id);
      }
    }
  } catch (error) {
    console.error('Error processing calendar notification:', error);
    throw error;
  }
}

/**
 * Setup Google Calendar push notifications
 */
async function setupPushNotifications(userId: string, accessToken: string): Promise<void> {
  try {
    const channelId = `edudash_${userId}_${Date.now()}`;
    const webhookUrl = `${SUPABASE_URL}/functions/v1/google-calendar-sync`;

    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: CALENDAR_WEBHOOK_TOKEN,
          expiration: Date.now() + 604800000, // 7 days
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to setup push notifications:', error);
      return;
    }

    const channel = await response.json();
    console.log('Push notifications setup successfully:', channel);

    // Store channel info for later management
    // You might want to create a calendar_channels table to track these
  } catch (error) {
    console.error('Error setting up push notifications:', error);
  }
}

/**
 * Main webhook handler
 */
async function handleWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    // Handle POST requests (webhook notifications)
    if (request.method === 'POST') {
      // Verify webhook token
      if (!verifyWebhookToken(request.headers)) {
        console.error('Invalid webhook token');
        return new Response('Unauthorized', { status: 401 });
      }

      // Check for sync trigger (Google sends empty POST for notifications)
      const resourceState = request.headers.get('X-Goog-Resource-State');
      
      if (resourceState === 'sync') {
        console.log('Sync message received, channel verified');
        return new Response('OK', { status: 200 });
      }

      if (resourceState === 'exists') {
        console.log('Calendar change detected');
        
        // Process the notification
        const payload: CalendarWebhookPayload = {
          kind: 'api#channel',
          id: request.headers.get('X-Goog-Channel-Id') || '',
          resourceId: request.headers.get('X-Goog-Resource-Id') || '',
          resourceUri: request.headers.get('X-Goog-Resource-URI') || '',
          expiration: request.headers.get('X-Goog-Channel-Expiration') || undefined,
        };

        await processCalendarNotification(payload);
        return new Response('OK', { status: 200 });
      }

      return new Response('No action needed', { status: 200 });
    }

    // Handle GET requests (manual sync or setup)
    if (request.method === 'GET') {
      const action = url.searchParams.get('action');

      if (action === 'setup') {
        // Setup push notifications for a user
        const userId = url.searchParams.get('userId');
        if (!userId) {
          return new Response('Missing userId', { status: 400 });
        }

        const accessToken = await refreshAccessToken(userId);
        if (!accessToken) {
          return new Response('Failed to get access token', { status: 401 });
        }

        await setupPushNotifications(userId, accessToken);
        return new Response('Push notifications setup', { status: 200 });
      }

      return new Response('Invalid action', { status: 400 });
    }

    return new Response('Method Not Allowed', { status: 405 });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Serve the function
serve(handleWebhook);
