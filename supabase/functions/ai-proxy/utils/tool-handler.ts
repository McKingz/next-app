/**
 * Tool Use Handler
 * 
 * Handles agentic tool execution and multi-turn conversations
 */

import { callClaude } from '../ai-client/anthropic-client.ts'
import { callOpenAI } from '../ai-client/openai-client.ts'
import { executeTool } from '../tools/tool-registry.ts'
import { logUsage } from '../security/quota-checker.ts'
import { createSuccessResponse } from './cors.ts'
import type { ToolContext } from '../types.ts'

export async function handleToolExecution(
  aiResult: any,
  toolContext: ToolContext,
  config: {
    apiKey: string
    originalPrompt: string
    tier: string
    hasImages: boolean
    images: any[] | undefined
    availableTools: any[] | undefined
    provider?: 'claude' | 'openai'
  },
  loggingContext: {
    supabaseAdmin: any
    userId: string
    organizationId: string | null
    serviceType: string
    metadata: any
    scope: string
    redactionCount: number
    startTime: number
  }
): Promise<Response> {
  console.log(`[tool-handler] Claude requested ${aiResult.tool_use.length} tool calls`)
  console.log('[tool-handler] Tool calls:', aiResult.tool_use.map((t: any) => ({ name: t.name, input: t.input })))

  // Execute all tools
  const toolResults = await Promise.all(
    aiResult.tool_use.map(async (toolCall: any) => {
      console.log(`[tool-handler] Executing tool: ${toolCall.name}`)
      console.log(`[tool-handler] Tool input:`, toolCall.input)
      
      try {
        const result = await executeTool(toolCall.name, toolCall.input, toolContext)
        
        console.log(`[tool-handler] Tool ${toolCall.name} result:`, {
          success: result.success,
          hasResult: !!result.result,
          error: result.error
        })
        
        return {
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: result.success ? JSON.stringify(result.result) : `Error: ${result.error}`
        }
      } catch (toolError) {
        console.error(`[tool-handler] Tool execution error for ${toolCall.name}:`, toolError)
        return {
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: `Error: ${(toolError as Error).message || 'Unknown tool execution error'}`
        }
      }
    })
  )
  
  const provider = config.provider || 'claude';
  console.log(`[tool-handler] All tools executed, sending results back to ${provider}`)

  let continuationResult: any;
  
  if (provider === 'openai') {
    // OpenAI continuation after tool execution
    const conversationHistory = [
      { role: 'user', content: config.originalPrompt },
      {
        role: 'assistant',
        content: aiResult.content || '',
        tool_calls: aiResult.tool_use.map((tu: any) => ({
          id: tu.id,
          type: 'function',
          function: {
            name: tu.name,
            arguments: JSON.stringify(tu.input)
          }
        }))
      },
      {
        role: 'tool',
        tool_call_id: toolResults[0].tool_use_id,
        content: toolResults.map((tr: any) => tr.content).join('\n\n')
      }
    ];
    
    continuationResult = await callOpenAI({
      apiKey: config.apiKey,
      model: aiResult.model as any,
      prompt: config.originalPrompt,
      conversationHistory,
      tools: config.availableTools
    });
  } else {
    // Claude continuation after tool execution
    continuationResult = await callClaude({
      apiKey: config.apiKey,
      model: aiResult.model,
      prompt: config.originalPrompt,
      images: config.images,
      stream: false,
      tools: config.availableTools,
      conversationHistory: [
        { role: 'user', content: config.originalPrompt },
        {
          role: 'assistant',
          content: [
            ...(aiResult.content ? [{ type: 'text', text: aiResult.content }] : []),
            ...aiResult.tool_use.map((tu: any) => ({
              type: 'tool_use',
              id: tu.id,
              name: tu.name,
              input: tu.input
            }))
          ]
        },
        {
          role: 'user',
          content: toolResults
        }
      ]
    });
  }

  // Log combined usage
  const totalTokensIn = aiResult.tokensIn + continuationResult.tokensIn
  const totalTokensOut = aiResult.tokensOut + continuationResult.tokensOut
  const totalCost = aiResult.cost + continuationResult.cost

  await logUsage(loggingContext.supabaseAdmin, {
    userId: loggingContext.userId,
    organizationId: loggingContext.organizationId,
    serviceType: loggingContext.serviceType,
    model: aiResult.model,
    status: 'success',
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    cost: totalCost,
    processingTimeMs: Date.now() - loggingContext.startTime,
    inputText: config.originalPrompt,
    outputText: continuationResult.content,
    metadata: {
      ...loggingContext.metadata,
      scope: loggingContext.scope,
      tier: config.tier,
      tool_count: toolResults.length,
      redaction_count: loggingContext.redactionCount
    }
  })

  return createSuccessResponse({
    content: continuationResult.content,
    tool_use: aiResult.tool_use,
    tool_results: toolResults,
    usage: {
      tokens_in: totalTokensIn,
      tokens_out: totalTokensOut,
      cost: totalCost
    }
  })
}
