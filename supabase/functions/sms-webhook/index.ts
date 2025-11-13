import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_PHONE_NUMBER = Deno.env.get('EXPO_PUBLIC_TWILIO_PHONE_NUMBER')!;

// Create Supabase client with service role for bypassing RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TwilioStatusWebhook {
  MessageSid: string;
  MessageStatus: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  To: string;
  From: string;
  ErrorCode?: string;
  ErrorMessage?: string;
}

interface TwilioInboundWebhook {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

/**
 * Validate Twilio webhook signature
 */
function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, any>
): boolean {
  if (!signature) {
    console.error('No signature provided');
    return false;
  }

  try {
    // Sort parameters alphabetically and concatenate
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    sortedKeys.forEach((key) => {
      data += key + params[key];
    });

    // Create HMAC SHA256 hash
    const hmac = createHmac('sha256', TWILIO_AUTH_TOKEN);
    hmac.update(data);
    const expectedSignature = hmac.digest('base64');

    const isValid = signature === expectedSignature;
    if (!isValid) {
      console.error('Signature validation failed');
      console.error('Expected:', expectedSignature);
      console.error('Received:', signature);
    }

    return isValid;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
}

/**
 * Parse URL-encoded body from Twilio
 */
function parseFormData(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = body.split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  }
  
  return params;
}

/**
 * Handle SMS delivery status update
 */
async function handleDeliveryStatus(webhook: TwilioStatusWebhook): Promise<void> {
  try {
    console.log('Handling delivery status update:', webhook.MessageSid, webhook.MessageStatus);

    // Update sms_messages table
    const { error } = await supabase
      .from('sms_messages')
      .update({
        status: webhook.MessageStatus,
        delivered_at:
          webhook.MessageStatus === 'delivered' ? new Date().toISOString() : null,
        error_code: webhook.ErrorCode || null,
        error_message: webhook.ErrorMessage || null,
      })
      .eq('provider_message_id', webhook.MessageSid);

    if (error) {
      console.error('Error updating SMS status:', error);
      return;
    }

    console.log(`SMS ${webhook.MessageSid} status updated to ${webhook.MessageStatus}`);

    // Log audit event
    await supabase.from('integration_audit_log').insert({
      integration_type: 'twilio_sms',
      action: 'delivery_status_update',
      request_payload: {
        messageSid: webhook.MessageSid,
        status: webhook.MessageStatus,
        errorCode: webhook.ErrorCode,
      },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error handling delivery status:', error);
    throw error;
  }
}

/**
 * Handle inbound SMS message
 */
async function handleInboundSMS(webhook: TwilioInboundWebhook): Promise<string> {
  try {
    console.log('Handling inbound SMS from:', webhook.From);
    console.log('Message body:', webhook.Body);

    const from = webhook.From;
    const body = webhook.Body?.trim() || '';
    const messageSid = webhook.MessageSid;

    // Check for STOP keyword (opt-out)
    if (/^STOP$/i.test(body)) {
      await handleOptOut(from);
      return "You've been unsubscribed from SMS alerts. Reply START to opt back in.";
    }

    // Check for START keyword (opt-in)
    if (/^START$/i.test(body)) {
      await handleOptIn(from);
      return 'Welcome back! You will now receive SMS alerts from EduDash Pro.';
    }

    // Check for HELP keyword
    if (/^HELP$/i.test(body)) {
      return 'EduDash Pro SMS Service. Reply STOP to unsubscribe. Support: support@edudashpro.app';
    }

    // Forward message to inbox
    await forwardToInbox(from, body, messageSid);
    return 'Thank you! Your message has been received.';
  } catch (error) {
    console.error('Error handling inbound SMS:', error);
    return 'We encountered an error processing your message. Please try again.';
  }
}

/**
 * Handle SMS opt-out
 */
async function handleOptOut(phoneNumber: string): Promise<void> {
  try {
    console.log('Handling opt-out for:', phoneNumber);

    // Find parent with this phone number
    const { data: parent } = await supabase
      .from('parents')
      .select('id, preschool_id')
      .eq('phone_number', phoneNumber)
      .single();

    if (!parent) {
      console.warn('No parent found for phone:', phoneNumber);
      // Still record opt-out even if parent not found
      // Use a default preschool or handle differently
      return;
    }

    // Insert or update opt-out record
    const { error } = await supabase.from('sms_opt_outs').upsert(
      {
        preschool_id: parent.preschool_id,
        phone_number: phoneNumber,
        opt_out_method: 'sms_reply',
        opted_out_at: new Date().toISOString(),
        opted_in_at: null, // Clear any previous opt-in
      },
      { onConflict: 'preschool_id,phone_number' }
    );

    if (error) {
      console.error('Error recording opt-out:', error);
      return;
    }

    console.log('Opt-out recorded successfully');

    // Log audit event
    await supabase.from('integration_audit_log').insert({
      integration_type: 'twilio_sms',
      action: 'opt_out',
      preschool_id: parent.preschool_id,
      request_payload: {
        phoneNumber,
        method: 'sms_reply',
      },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error handling opt-out:', error);
  }
}

/**
 * Handle SMS opt-in (re-subscribe)
 */
async function handleOptIn(phoneNumber: string): Promise<void> {
  try {
    console.log('Handling opt-in for:', phoneNumber);

    // Update opt-out record to mark as opted back in
    const { error } = await supabase
      .from('sms_opt_outs')
      .update({ opted_in_at: new Date().toISOString() })
      .eq('phone_number', phoneNumber)
      .is('opted_in_at', null);

    if (error) {
      console.error('Error recording opt-in:', error);
      return;
    }

    console.log('Opt-in recorded successfully');

    // Log audit event
    await supabase.from('integration_audit_log').insert({
      integration_type: 'twilio_sms',
      action: 'opt_in',
      request_payload: {
        phoneNumber,
      },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error handling opt-in:', error);
  }
}

/**
 * Forward inbound SMS to teacher/admin inbox
 */
async function forwardToInbox(
  from: string,
  body: string,
  messageSid: string
): Promise<void> {
  try {
    console.log('Forwarding SMS to inbox from:', from);

    // Find parent with this phone number
    const { data: parent } = await supabase
      .from('parents')
      .select('id, full_name, preschool_id')
      .eq('phone_number', from)
      .single();

    if (!parent) {
      console.warn('No parent found for phone:', from);
      return;
    }

    // TODO: Integrate with existing message inbox system
    // Options:
    // 1. Create entry in WhatsApp inbox (if unified inbox exists)
    // 2. Create separate SMS inbox
    // 3. Send notification to principal/admin

    // For now, log the message
    console.log(`Message from ${parent.full_name}: ${body}`);

    // Create notification for principal/admin
    const { data: principals } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('preschool_id', parent.preschool_id)
      .eq('role', 'principal');

    if (principals && principals.length > 0) {
      // Call notifications dispatcher
      await supabase.functions.invoke('notifications-dispatcher', {
        body: {
          event_type: 'sms_received',
          preschool_id: parent.preschool_id,
          parent_id: parent.id,
          parent_name: parent.full_name,
          message_body: body,
          phone_number: from,
        },
      });
    }

    console.log('SMS forwarded to inbox successfully');
  } catch (error) {
    console.error('Error forwarding SMS to inbox:', error);
  }
}

/**
 * Send TwiML response
 */
function sendTwiMLResponse(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
</Response>`;

  return new Response(twiml, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}

/**
 * Main webhook handler
 */
async function handleWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    // Only handle POST requests from Twilio
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Parse form data from Twilio
    const body = await request.text();
    const params = parseFormData(body);

    // Validate Twilio signature
    const signature = request.headers.get('X-Twilio-Signature');
    if (!validateTwilioSignature(signature, url.toString(), params)) {
      console.error('Invalid Twilio signature');
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('Twilio webhook received:', params.MessageSid);

    // Check if this is a status callback or inbound message
    // Status callbacks have MessageStatus field
    // Inbound messages have From, To, Body fields
    
    if (params.MessageStatus) {
      // Handle delivery status update
      const webhook: TwilioStatusWebhook = {
        MessageSid: params.MessageSid,
        MessageStatus: params.MessageStatus as TwilioStatusWebhook['MessageStatus'],
        To: params.To,
        From: params.From,
        ErrorCode: params.ErrorCode,
        ErrorMessage: params.ErrorMessage,
      };

      await handleDeliveryStatus(webhook);
      return new Response('OK', { status: 200 });
    } else if (params.From && params.Body !== undefined) {
      // Handle inbound SMS
      const webhook: TwilioInboundWebhook = {
        MessageSid: params.MessageSid,
        From: params.From,
        To: params.To,
        Body: params.Body,
        NumMedia: params.NumMedia,
        MediaUrl0: params.MediaUrl0,
        MediaContentType0: params.MediaContentType0,
      };

      const responseMessage = await handleInboundSMS(webhook);
      
      // Return TwiML response to send back to user
      return sendTwiMLResponse(responseMessage);
    }

    return new Response('No action needed', { status: 200 });
  } catch (error) {
    console.error('Error handling Twilio webhook:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Serve the function
serve(handleWebhook);
