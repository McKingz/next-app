/**
 * Streaming Response Handler
 * 
 * Handles Server-Sent Events (SSE) streaming from Claude API
 */

import { processStream, calculateCost } from '../ai-client/anthropic-client.ts'
import { logUsage } from '../security/quota-checker.ts'
import { getCorsHeaders } from './cors.ts'

export async function createStreamingResponse(
  response: Response,
  model: string,
  context: {
    supabaseAdmin: any
    userId: string
    organizationId: string | null
    serviceType: string
    inputText: string
    metadata: any
    scope: string
    tier: string
    hasImages: boolean
    imageCount: number
    redactionCount: number
    startTime: number
  }
): Promise<Response> {
  const encoder = new TextEncoder()
  let fullContent = ''
  let tokensIn = 0
  let tokensOut = 0

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await processStream(
          response,
          (text) => {
            fullContent += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'content_block_delta',
              delta: { text }
            })}\n\n`))
          },
          () => {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          }
        ).then(async (result) => {
          tokensIn = result.tokensIn
          tokensOut = result.tokensOut

          // Log streaming usage
          await logUsage(context.supabaseAdmin, {
            userId: context.userId,
            organizationId: context.organizationId,
            serviceType: context.serviceType,
            model,
            status: 'success',
            tokensIn,
            tokensOut,
            cost: calculateCost(model as any, tokensIn, tokensOut),
            processingTimeMs: Date.now() - context.startTime,
            inputText: context.inputText,
            outputText: fullContent,
            metadata: {
              ...context.metadata,
              scope: context.scope,
              tier: context.tier,
              streaming: true,
              has_images: context.hasImages,
              image_count: context.imageCount,
              redaction_count: context.redactionCount
            }
          })
        })
      } catch (error) {
        console.error('[streaming-handler] Error:', error)
        controller.error(error)
      }
    }
  })

  return new Response(stream, {
    status: 200,
    headers: {
      ...getCorsHeaders(),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
