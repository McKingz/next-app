// Supabase Edge Function: ai-proxy
// Purpose: Secure AI service proxy for lesson generation, grading assistance, homework help
// NOTE: Placeholder implementation - replace with actual AI service integration
// To deploy:
//   supabase functions deploy ai-proxy
// To test locally:
//   supabase functions serve --env-file ./supabase/.env

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

serve(async (req: Request) => {
  try {
    const { method } = req
    if (method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    const body = await req.json().catch(() => ({})) as any
    const service_type = body?.service_type || 'homework_help'
    const prompt = body?.prompt || body?.input_text || ''

    // For now, return simulated responses based on service type
    let mockResponse = ''
    
    switch (service_type) {
      case 'lesson_generation':
        mockResponse = `# Sample Lesson Plan

## Objective
Students will learn about ${prompt.slice(0, 50)}...

## Materials Needed
- Whiteboard
- Handouts
- Interactive activities

## Activities
1. Introduction (10 minutes)
2. Main activity (20 minutes)
3. Wrap-up discussion (10 minutes)

## Assessment
Quick quiz to check understanding.

*Note: This is a placeholder response from ai-proxy function*`
        break
        
      case 'grading_assistance':
        mockResponse = `## Grading Summary

**Overall Score: 85/100**

### Strengths:
- Good understanding of key concepts
- Clear explanations
- Well-organized responses

### Areas for improvement:
- Could provide more specific examples
- Mathematical calculations need more precision

### Feedback:
Great work overall! Focus on showing your work step-by-step for math problems.

*Note: This is a placeholder response from ai-proxy function*`
        break
        
      case 'homework_help':
      default:
        mockResponse = `I can help you with that! Here's a step-by-step approach:

1. **Understanding the problem**: ${prompt.slice(0, 100)}...

2. **Key concepts to remember**:
   - Break down complex problems into smaller parts
   - Show your work clearly
   - Double-check your answers

3. **Next steps**:
   Try working through a similar example first, then apply the same method to your homework.

*Note: This is a placeholder response from ai-proxy function*`
        break
    }

    // Simulate some processing delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    return new Response(JSON.stringify({
      response: mockResponse,
      service_type,
      tokens_used: Math.floor(Math.random() * 500) + 100,
      model: 'claude-3-haiku-placeholder',
      status: 'success'
    }), { 
      headers: { 
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      } 
    })

  } catch (e) {
    return new Response(JSON.stringify({ 
      error: String(e?.message || e),
      status: 'error'
    }), { 
      status: 500,
      headers: { 
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
})
