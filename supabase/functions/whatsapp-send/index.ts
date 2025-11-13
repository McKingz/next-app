import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// Environment variables
// Note: Supabase reserves the SUPABASE_* prefix for system envs. Do NOT set secrets with that prefix.
// SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically by the runtime
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
const META_API_VERSION = Deno.env.get('META_API_VERSION') || 'v22.0'

// Validate required environment variables at startup
if (!WHATSAPP_ACCESS_TOKEN) {
  console.error('❌ WHATSAPP_ACCESS_TOKEN not found - Please set this in Supabase Edge Functions environment variables')
}
if (!WHATSAPP_PHONE_NUMBER_ID) {
  console.error('❌ WHATSAPP_PHONE_NUMBER_ID not found - Please set this in Supabase Edge Functions environment variables') 
}
console.log('✅ WhatsApp credentials loaded:', {
  hasAccessToken: !!WHATSAPP_ACCESS_TOKEN,
  hasPhoneNumberId: !!WHATSAPP_PHONE_NUMBER_ID,
  phoneNumberId: WHATSAPP_PHONE_NUMBER_ID ? `***${WHATSAPP_PHONE_NUMBER_ID.slice(-4)}` : 'missing',
  apiVersion: META_API_VERSION
})

// CORS helpers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers || {}) },
  })
}

// Create Supabase client with service role for bypassing RLS
let supabase: SupabaseClient;
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Warning: SERVICE_ROLE_KEY not found, falling back to anon key with limited permissions')
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
} else {
  console.log('Using service role key for database access')
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

interface SendMessageRequest {
  thread_id?: string
  message_id?: string
  contact_id?: string
  phone_number?: string
  message_type: 'text' | 'template' | 'image' | 'document'
  content?: string
  template_name?: string
  template_params?: string[]
  media_url?: string
  filename?: string
  broadcast?: boolean
  preschool_id?: string
  job_posting_id?: string
}

interface WhatsAppResponse {
  messaging_product: string
  contacts: Array<{
    input: string
    wa_id: string
  }>
  messages: Array<{
    id: string
  }>
}

/**
 * Send text message via WhatsApp Cloud API
 */
async function sendTextMessage(to: string, content: string): Promise<WhatsAppResponse> {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`
  
  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: {
      body: content
    }
  }

  console.log('Sending WhatsApp text message:', { to, payload })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('WhatsApp Text Message API Error:', {
      status: response.status,
      statusText: response.statusText,
      errorBody: errorText,
      url: url,
      phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
      hasAccessToken: !!WHATSAPP_ACCESS_TOKEN,
      tokenPrefix: WHATSAPP_ACCESS_TOKEN ? WHATSAPP_ACCESS_TOKEN.substring(0, 10) + '...' : 'missing'
    })
    
    // Parse error response if possible
    let errorDetails = errorText
    try {
      const errorJson = JSON.parse(errorText)
      if (errorJson.error?.message) {
        errorDetails = errorJson.error.message
      }
    } catch {
      // Use raw error text
    }
    
    throw new Error(`WhatsApp Text API error (${response.status}): ${errorDetails}`)
  }

  return await response.json()
}

/**
 * Send template message via WhatsApp Cloud API
 */
async function sendTemplateMessage(to: string, templateName: string, params: string[] = []): Promise<WhatsAppResponse> {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`
  
  const components = params.length > 0 ? [{
    type: "body",
    parameters: params.map(param => ({ type: "text", text: param }))
  }] : []

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: "en" // Could be dynamic based on user preference
      },
      components: components
    }
  }

  console.log('Sending WhatsApp template message:', { to, templateName, payload })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('WhatsApp Template Message API Error:', {
      status: response.status,
      statusText: response.statusText,
      errorBody: errorText,
      templateName: templateName,
      url: url,
      phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
      hasAccessToken: !!WHATSAPP_ACCESS_TOKEN,
      tokenPrefix: WHATSAPP_ACCESS_TOKEN ? WHATSAPP_ACCESS_TOKEN.substring(0, 10) + '...' : 'missing'
    })
    
    // Parse error response if possible
    let errorDetails = errorText
    try {
      const errorJson = JSON.parse(errorText)
      if (errorJson.error?.message) {
        errorDetails = errorJson.error.message
      }
    } catch {
      // Use raw error text
    }
    
    throw new Error(`WhatsApp Template API error (${response.status}): ${errorDetails}`)
  }

  return await response.json()
}

/**
 * Send media message via WhatsApp Cloud API
 */
async function sendMediaMessage(to: string, mediaUrl: string, messageType: 'image' | 'document', caption?: string, filename?: string): Promise<WhatsAppResponse> {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`
  
  let mediaObject: any = {
    link: mediaUrl
  }

  if (caption && messageType === 'image') {
    mediaObject.caption = caption
  }

  if (filename && messageType === 'document') {
    mediaObject.filename = filename
  }

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: messageType,
    [messageType]: mediaObject
  }

  console.log('Sending WhatsApp media message:', { to, messageType, payload })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('WhatsApp API error:', error)
    throw new Error(`WhatsApp API error: ${response.status} ${error}`)
  }

  return await response.json()
}

/**
 * Get contact information for sending message
 */
async function getContactInfo(request: SendMessageRequest) {
  console.log('Getting contact info for request:', { 
    contact_id: request.contact_id,
    thread_id: request.thread_id,
    phone_number: request.phone_number 
  })
  
  if (request.contact_id) {
    try {
      const { data: contact, error } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .eq('id', request.contact_id)
        .single()

      if (error) {
        console.error('Error fetching contact by ID:', error)
        throw new Error(`Contact not found: ${error.message}`)
      }

      return contact
    } catch (error) {
      console.error('Database error fetching contact:', error)
      throw new Error(`Database error: ${(error as any)?.message || String(error)}`)
    }
  }

  if (request.thread_id) {
    // Try to get thread, but if message_threads table doesn't exist, skip this
    try {
      const { data: thread, error: threadError } = await supabase
        .from('message_threads')
        .select(`
          *,
          whatsapp_contacts!inner(*)
        `)
        .eq('id', request.thread_id)
        .eq('channel', 'whatsapp')
        .single()

      if (threadError) {
        console.warn('Message threads table not available:', threadError.message)
        throw new Error('Thread lookup not available - please provide phone_number instead')
      }

      return thread.whatsapp_contacts
    } catch (error) {
      console.warn('Thread lookup failed:', error)
      throw new Error('Thread lookup not available - please provide phone_number instead')
    }
  }

  if (request.phone_number) {
    try {
      const { data: contact, error } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .eq('phone_e164', request.phone_number)
        .single()

      if (error) {
        console.log('Contact not found, creating new contact for:', request.phone_number)

        // Get the authenticated user's info to determine preschool_id
        // In Edge Functions, we need to get the Authorization header from the request
        let userId: string | null = null
        let preschoolId: string | null = null

        // Try to get user from profiles table instead of users table
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, organization_id')
            .limit(1)
            .single()

          if (profile) {
            userId = profile.id
            preschoolId = profile.organization_id
          }
        } catch (error) {
          console.warn('Could not get profile info:', error)
        }

        // Fallback to getting a valid preschool from database
        if (!preschoolId) {
          try {
            const { data: preschool } = await supabase
              .from('preschools')
              .select('id')
              .limit(1)
              .single()

            preschoolId = preschool?.id || null
          } catch (error) {
            console.warn('Could not get preschool info:', error)
          }
        }

        if (!preschoolId || !userId) {
          throw new Error('Could not determine preschool or user for contact creation')
        }

        // Create contact if doesn't exist
        try {
          const { data: newContact, error: createError } = await supabase
            .from('whatsapp_contacts')
            .insert({
              phone_e164: request.phone_number,
              consent_status: 'pending',
              preschool_id: preschoolId,
              user_id: userId
            })
            .select()
            .single()

          if (createError) {
            console.error('Error creating contact:', createError)
            throw new Error(`Failed to create contact: ${createError.message}`)
          }

          console.log('Created new contact:', newContact)
          return newContact
        } catch (createError) {
          console.error('Error creating contact:', createError)
          throw new Error(`Failed to create contact: ${(createError as any)?.message || String(createError)}`)
        }
      }

      return contact
    } catch (error) {
      console.error('Database error with phone number:', error)
      throw new Error(`Database error: ${(error as any)?.message || String(error)}`)
    }
  }

  throw new Error('No contact information provided')
}

/**
 * Record outbound message in database
 */
async function recordOutboundMessage(contact: any, request: SendMessageRequest, waResponse: WhatsAppResponse | null) {
  if (!waResponse) {
    console.warn('No WhatsApp response to record')
    return null
  }

  const metaMessageId = waResponse.messages?.[0]?.id

  try {
    // Insert into whatsapp_messages
    const { data: waMessage, error: waError } = await supabase
      .from('whatsapp_messages')
      .insert({
        contact_id: contact.id,
        direction: 'out',
        message_type: request.message_type,
        content: request.content || `Template: ${request.template_name}`,
        media_url: request.media_url,
        meta_message_id: metaMessageId,
        status: 'sent'
      })
      .select()
      .single()

    if (waError) {
      console.warn('WhatsApp messages table not available, skipping database recording:', waError.message)
      return null
    }

    console.log('WhatsApp message recorded successfully:', waMessage.id)
    return waMessage
  } catch (error) {
    console.warn('Error recording WhatsApp message:', error)
    return null
  }
}

/**
 * Broadcast message to all opted-in contacts for a preschool
 */
async function broadcastMessage(sendRequest: SendMessageRequest): Promise<Response> {
  if (!sendRequest.preschool_id) {
    return json({ error: 'preschool_id is required for broadcast' }, { status: 400 })
  }

  console.log('Broadcasting message for preschool:', sendRequest.preschool_id)

  // Get all opted-in contacts for the preschool
  const { data: contacts, error: contactsError } = await supabase
    .from('whatsapp_contacts')
    .select('*')
    .eq('preschool_id', sendRequest.preschool_id)
    .eq('consent_status', 'opted_in')

  if (contactsError) {
    console.error('Error fetching contacts for broadcast:', contactsError)
    return json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }

  if (!contacts || contacts.length === 0) {
    return json({ 
      success: true, 
      message: 'No opted-in contacts found for broadcast',
      sent_count: 0 
    }, { status: 200 })
  }

  console.log(`Broadcasting to ${contacts.length} contacts`)

  // Send message to each contact
  const results = await Promise.allSettled(
    contacts.map(async (contact) => {
      try {
        let waResponse: WhatsAppResponse | null = null

        switch (sendRequest.message_type) {
          case 'text':
            if (!sendRequest.content) throw new Error('content required')
            waResponse = await sendTextMessage(contact.phone_e164, sendRequest.content)
            break
          case 'template':
            if (!sendRequest.template_name) throw new Error('template_name required')
            waResponse = await sendTemplateMessage(
              contact.phone_e164,
              sendRequest.template_name,
              sendRequest.template_params || []
            )
            break
          default:
            throw new Error('Unsupported broadcast message type')
        }

        // Record the message
        if (waResponse) {
          await recordOutboundMessage(contact, sendRequest, waResponse)
        }

        return { success: true, contact_id: contact.id, phone: contact.phone_e164 }
      } catch (error) {
        console.error(`Failed to send to ${contact.phone_e164}:`, error)
        return { success: false, contact_id: contact.id, phone: contact.phone_e164, error: String(error) }
      }
    })
  )

  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  const failureCount = results.length - successCount

  // Update job_distributions table if job_posting_id provided
  if (sendRequest.job_posting_id) {
    try {
      await supabase
        .from('job_distributions')
        .update({ recipients_count: successCount })
        .eq('job_posting_id', sendRequest.job_posting_id)
        .eq('channel', 'whatsapp')
    } catch (error) {
      console.warn('Failed to update distribution count:', error)
    }
  }

  return json({
    success: true,
    broadcast: true,
    sent_count: successCount,
    failed_count: failureCount,
    total_contacts: contacts.length,
    results: results.map((r, i) => ({
      contact_id: contacts[i].id,
      status: r.status,
      ...(r.status === 'fulfilled' ? r.value : { error: (r.reason as any)?.message || String(r.reason) })
    }))
  }, { status: 200 })
}

/**
 * Main send message handler
 */
async function sendMessage(request: Request): Promise<Response> {
  try {
    // Validate environment variables before processing
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error('❌ Missing WhatsApp credentials')
      console.error('Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Supabase Edge Functions environment variables')
      console.error('Documentation: https://docs.edudashpro.com/whatsapp-setup')
      
      return json({ 
        error: 'whatsapp_not_configured',
        message: 'WhatsApp Business API is not configured for this organization. Please complete the WhatsApp setup in your settings.',
        action: 'configure_whatsapp',
        details: {
          hasAccessToken: !!WHATSAPP_ACCESS_TOKEN,
          hasPhoneNumberId: !!WHATSAPP_PHONE_NUMBER_ID,
          setup_guide: 'Go to Settings > WhatsApp Integration to complete setup'
        }
      }, { status: 503 })
    }

    const sendRequest: SendMessageRequest = await request.json()
    console.log('Processing send request:', { 
      messageType: sendRequest.message_type,
      hasContactId: !!sendRequest.contact_id,
      hasPhoneNumber: !!sendRequest.phone_number,
      hasContent: !!sendRequest.content,
      templateName: sendRequest.template_name,
      broadcast: !!sendRequest.broadcast
    })

    // Handle broadcast mode
    if (sendRequest.broadcast) {
      return await broadcastMessage(sendRequest)
    }

    // Validate request
    if (!sendRequest.message_type) {
      return json({ error: 'message_type is required' }, { status: 400 })
    }

    // Get contact information
    const contact = await getContactInfo(sendRequest)
    console.log('Sending to contact:', contact.phone_e164)

    // Check consent status
    if (contact.consent_status !== 'opted_in') {
      console.warn('Contact has not opted in to WhatsApp messaging:', contact.phone_e164)
      // Still allow template messages for opt-in flows
      if (sendRequest.message_type !== 'template') {
        return json({ error: 'Contact has not opted in to WhatsApp messaging' }, { status: 403 })
      }
    }

    let waResponse: WhatsAppResponse | null = null

    // Send message based on type
    try {
      switch (sendRequest.message_type) {
        case 'text':
          if (!sendRequest.content) {
            return json({ error: 'content is required for text messages' }, { status: 400 })
          }
          waResponse = await sendTextMessage(contact.phone_e164, sendRequest.content)
          break

        case 'template':
          if (!sendRequest.template_name) {
            return json({ error: 'template_name is required for template messages' }, { status: 400 })
          }
          waResponse = await sendTemplateMessage(
            contact.phone_e164,
            sendRequest.template_name,
            sendRequest.template_params || []
          )
          break

        case 'image':
        case 'document':
          if (!sendRequest.media_url) {
            return json({ error: 'media_url is required for media messages' }, { status: 400 })
          }
          waResponse = await sendMediaMessage(
            contact.phone_e164,
            sendRequest.media_url,
            sendRequest.message_type,
            sendRequest.content,
            sendRequest.filename
          )
          break

        default:
          return json({ error: 'Unsupported message type' }, { status: 400 })
      }
    } catch (apiError) {
      console.error('WhatsApp API error:', apiError)
      return json({
        error: 'Failed to send WhatsApp message',
        details: (apiError as any)?.message || String(apiError)
      }, { status: 500 })
    }

    // Record message in database (optional, don't fail if this fails)
    let recordedMessage = null
    if (waResponse) {
      try {
        recordedMessage = await recordOutboundMessage(contact, sendRequest, waResponse)
      } catch (dbError) {
        console.warn('Failed to record message in database (continuing anyway):', dbError)
      }
    }

    if (!waResponse) {
      return json({
        error: 'Failed to get response from WhatsApp API'
      }, { status: 500 })
    }

    return json({
      success: true,
      meta_message_id: waResponse.messages?.[0]?.id || null,
      wa_id: waResponse.contacts?.[0]?.wa_id || null,
      recorded_message_id: recordedMessage?.id || null
    }, { status: 200 })

  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return json({ 
      error: 'Failed to send message',
      details: (error as any)?.message || String(error)
    }, { status: 500 })
  }
}

/**
 * Handle database trigger for outbound messages
 */
async function handleMessageTrigger(request: Request): Promise<Response> {
  try {
    const { record, type } = await request.json()
    
    // Only process INSERT events for outbound WhatsApp messages
    if (type !== 'INSERT' || record.direction !== 'out' || !record.channel || record.channel !== 'whatsapp') {
      return json({ success: true, skipped: true }, { status: 200 })
    }

    // Construct send request from database record
    const sendRequest: SendMessageRequest = {
      thread_id: record.thread_id,
      message_type: record.content_type || 'text',
      content: record.content,
      media_url: record.media_url
    }

    // Process the send request
    return await sendMessage(new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sendRequest)
    }))

  } catch (error) {
    console.error('Error processing message trigger:', error)
    return json({ 
      error: 'Failed to process trigger',
      details: (error as any)?.message || String(error)
    }, { status: 500 })
  }
}

/**
 * Main handler
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  // Handle different endpoints
  if (url.pathname.includes('trigger')) {
    return await handleMessageTrigger(request)
  } else {
    return await sendMessage(request)
  }
}

// Serve the function
serve(handleRequest)