/* eslint-disable @typescript-eslint/no-unused-vars */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') || 'edudash_verify_2024'
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!

// Create Supabase client with service role for bypassing RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface WebhookEntry {
  id: string
  changes: Array<{
    value: {
      messaging_product: string
      metadata: {
        display_phone_number: string
        phone_number_id: string
      }
      contacts?: Array<{
        profile: { name: string }
        wa_id: string
      }>
      messages?: Array<{
        from: string
        id: string
        timestamp: string
        type: 'text' | 'image' | 'audio' | 'document'
        text?: { body: string }
        image?: { 
          id: string
          mime_type: string
          sha256: string
          caption?: string
        }
        audio?: {
          id: string
          mime_type: string
        }
        document?: {
          id: string
          filename: string
          mime_type: string
          sha256: string
        }
      }>
      statuses?: Array<{
        id: string
        status: 'sent' | 'delivered' | 'read' | 'failed'
        timestamp: string
        recipient_id: string
      }>
    }
    field: string
  }>
}

interface WebhookPayload {
  object: string
  entry: WebhookEntry[]
}

/**
 * Verifies the webhook challenge from Meta
 */
function verifyWebhook(url: URL): Response {
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token') 
  const challenge = url.searchParams.get('hub.challenge')

  console.log('Verifying webhook:', { mode, token, challenge })

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified successfully')
    return new Response(challenge, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  } else {
    console.error('Webhook verification failed')
    return new Response('Forbidden', { status: 403 })
  }
}

/**
 * Find or create WhatsApp contact by phone number and wa_user_id
 */
async function findOrCreateContact(phone: string, waUserId: string, preschoolId?: string) {
  // First try to find by wa_user_id
  let { data: contact, error } = await supabase
    .from('whatsapp_contacts')
    .select('*')
    .eq('wa_user_id', waUserId)
    .single()

  if (error || !contact) {
    // Try to find by phone number
    const { data: phoneContact, error: phoneError } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('phone_e164', phone)
      .single()

    if (!phoneError && phoneContact) {
      // Update existing contact with wa_user_id
      const { data: updated, error: updateError } = await supabase
        .from('whatsapp_contacts')
        .update({ wa_user_id: waUserId })
        .eq('id', phoneContact.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating contact:', updateError)
        return null
      }
      contact = updated
    } else if (preschoolId) {
      // Create new contact - we need to determine preschool_id and user_id
      // In a real scenario, you might have a lookup table or different logic
      const { data: newContact, error: createError } = await supabase
        .from('whatsapp_contacts')
        .insert({
          preschool_id: preschoolId,
          user_id: null, // Will be set when user opts in
          phone_e164: phone,
          wa_user_id: waUserId,
          consent_status: 'pending'
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating contact:', createError)
        return null
      }
      contact = newContact
    }
  }

  return contact
}

/**
 * Process incoming WhatsApp message
 */
async function processIncomingMessage(message: any, contact: any) {
  console.log('Processing incoming message:', message)

  // Insert into whatsapp_messages
  const { data: waMessage, error: waError } = await supabase
    .from('whatsapp_messages')
    .insert({
      contact_id: contact.id,
      direction: 'in',
      message_type: message.type,
      content: message.text?.body || message.image?.caption || '',
      media_url: null, // Will be populated if we download media
      meta_message_id: message.id,
      status: 'received'
    })
    .select()
    .single()

  if (waError) {
    console.error('Error saving WhatsApp message:', waError)
    return
  }

  // Create corresponding message thread and message entry
  if (contact.user_id && contact.preschool_id) {
    // Find or create message thread for this contact
    let { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .select('*')
      .eq('preschool_id', contact.preschool_id)
      .eq('parent_id', contact.user_id)
      .eq('channel', 'whatsapp')
      .single()

    if (threadError || !thread) {
      // Create new thread
      const { data: newThread, error: newThreadError } = await supabase
        .from('message_threads')
        .insert({
          preschool_id: contact.preschool_id,
          parent_id: contact.user_id,
          teacher_id: null, // Will be set based on context
          channel: 'whatsapp'
        })
        .select()
        .single()

      if (newThreadError) {
        console.error('Error creating message thread:', newThreadError)
        return
      }
      thread = newThread
    }

    // Insert message into messages table
    const { data: messageEntry, error: messageError } = await supabase
      .from('messages')
      .insert({
        thread_id: thread.id,
        sender_role: 'parent',
        sender_id: contact.user_id,
        content: message.text?.body || message.image?.caption || '',
        content_type: message.type,
        media_url: null, // Will be set if media is downloaded
        status: 'received'
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error saving message entry:', messageError)
    } else {
      console.log('Message saved successfully:', messageEntry.id)
      
      // Track engagement event
      await supabase
        .from('parent_engagement_events')
        .insert({
          preschool_id: contact.preschool_id,
          parent_id: contact.user_id,
          event_type: 'received_whatsapp_message',
          metadata: {
            message_id: messageEntry.id,
            message_type: message.type,
            thread_id: thread.id
          }
        })
    }

    // Trigger push notification to teacher/admin
    await triggerNotification(thread, messageEntry, contact)
  }
}

/**
 * Trigger push notification for new message
 */
async function triggerNotification(thread: any, message: any, contact: any) {
  try {
    // Call notifications dispatcher
    await supabase.functions.invoke('notifications-dispatcher', {
      body: {
        event_type: 'new_message',
        thread_id: thread.id,
        message_id: message.id,
        sender_id: message.sender_id,
        preschool_id: thread.preschool_id
      }
    })
  } catch (error) {
    console.error('Error triggering notification:', error)
  }
}

/**
 * Process message status updates
 */
async function processStatusUpdate(status: any) {
  console.log('Processing status update:', status)

  // Update WhatsApp message status
  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ status: status.status })
    .eq('meta_message_id', status.id)

  if (error) {
    console.error('Error updating message status:', error)
  }

  // Update corresponding message in messages table
  const { error: messageError } = await supabase
    .from('messages')
    .update({ status: status.status })
    .eq('id', status.id) // Assuming we store Meta message ID as our message ID

  if (messageError) {
    console.error('Error updating message entry status:', messageError)
  }
}

/**
 * Main webhook handler
 */
async function handleWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url)
  
  // Handle webhook verification (GET request)
  if (request.method === 'GET') {
    return verifyWebhook(url)
  }

  // Handle webhook events (POST request)
  if (request.method === 'POST') {
    try {
      const payload: WebhookPayload = await request.json()
      console.log('Received webhook payload:', JSON.stringify(payload, null, 2))

      if (payload.object !== 'whatsapp_business_account') {
        return new Response('Not a WhatsApp webhook', { status: 400 })
      }

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const { messages, contacts, statuses } = change.value

            // Process incoming messages
            if (messages) {
              for (const message of messages) {
                // Find or create contact
                const contact = await findOrCreateContact(
                  message.from,
                  message.from,
                  // You might need additional logic to determine preschool_id
                  undefined
                )

                if (contact) {
                  await processIncomingMessage(message, contact)
                }
              }
            }

            // Process status updates
            if (statuses) {
              for (const status of statuses) {
                await processStatusUpdate(status)
              }
            }
          }
        }
      }

      return new Response('OK', { status: 200 })
    } catch (error) {
      console.error('Error processing webhook:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }

  return new Response('Method Not Allowed', { status: 405 })
}

// Serve the function
serve(handleWebhook)