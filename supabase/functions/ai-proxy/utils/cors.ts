/**
 * CORS Utility
 * 
 * Handles CORS headers and OPTIONS preflight requests.
 */

/**
 * Get CORS headers
 */
export function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

/**
 * Handle OPTIONS preflight request
 */
export function handlePreflight(): Response {
  return new Response('ok', {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  })
}

/**
 * Create error response with CORS headers
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400
): Response {
  return new Response(
    JSON.stringify({ 
      success: false,
      error: { code, message }
    }),
    {
      status,
      headers: {
        ...getCorsHeaders(),
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * Create success response with CORS headers
 */
export function createSuccessResponse(
  data: any,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      ...data
    }),
    {
      status,
      headers: {
        ...getCorsHeaders(),
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * Create streaming response with CORS headers
 */
export function createStreamingResponse(
  stream: ReadableStream
): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      ...getCorsHeaders(),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
