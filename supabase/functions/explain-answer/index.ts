import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

interface ExplanationRequest {
  questionText: string;
  questionType: string;
  options?: string[];
  studentAnswer: string;
  correctAnswer: string;
  grade: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ExplanationRequest = await req.json();
    const { questionText, questionType, options, studentAnswer, correctAnswer, grade } = body;

    if (!questionText || !studentAnswer || !correctAnswer || !grade) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the comprehensive, teacher-like explanation prompt
    const optionsText = questionType === 'multiple_choice' && options
      ? `Options:\n${options.map((opt, i) => `${String.fromCharCode(97 + i)}) ${opt}`).join('\n')}\n\n`
      : '';

    const prompt = `You are Dash, a patient and encouraging CAPS-aligned South African teacher. A Grade ${grade} student has answered this question incorrectly, and they need your help to understand what went wrong and how to get it right.

Question: ${questionText}
${optionsText}Student's Answer: ${studentAnswer}
Correct Answer: ${correctAnswer}

As a caring teacher in a classroom, provide a detailed, step-by-step explanation that includes:

1. **Understanding the Mistake**: Start by acknowledging their effort, then gently explain what went wrong with their answer. Help them see where their thinking diverged from the correct path.

2. **Teaching the Concept**: Like explaining at a chalkboard, break down the correct concept in simple, clear steps. Use examples, analogies, or real-world connections that a Grade ${grade} student would relate to. Build understanding from the ground up.

3. **Working Through It**: Show them how to arrive at the correct answer step-by-step, as if you're working through it together. Explain your reasoning at each stage.

4. **CAPS Alignment**: Connect this to what they're learning in their CAPS curriculum for Grade ${grade}. Mention the relevant topic or skill they're practicing.

5. **Encouragement & Next Steps**: End with warm encouragement and a tip or strategy they can use for similar questions in future.

Use conversational, age-appropriate language. Be thorough but not overwhelming. Think of this as a one-on-one tutoring session where you have time to really help them understand. Aim for 4-6 well-structured paragraphs.`;

    // Call Claude API with retry logic
    let retries = 3;
    let lastError: Error | null = null;

    while (retries > 0) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307', // Use Haiku for faster responses
            max_tokens: 800, // Increased for detailed teacher-like explanations
            temperature: 0.8, // Slightly higher for more natural, conversational tone
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        });

        if (response.status === 529) {
          // Overloaded - wait and retry
          retries--;
          if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
            continue;
          }
          throw new Error('Claude API is overloaded. Please try again in a moment.');
        }

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Claude API error: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        const explanation = data.content?.[0]?.text || 'Could not generate explanation.';

        return new Response(
          JSON.stringify({ explanation }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        lastError = error as Error;
        retries--;
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    // All retries failed - return comprehensive fallback explanation
    const fallbackExplanation = questionType === 'multiple_choice'
      ? `**Let's work through this together! 🎓**

The correct answer is **${correctAnswer}**, but I can see you selected **${studentAnswer}**. Don't worry - mistakes are how we learn!

**Understanding What Happened:**
When answering multiple choice questions, it's important to carefully read each option and compare them to what the question is asking. Your answer might have seemed right at first, but let's think about why ${correctAnswer} is the better choice.

**How to Approach Similar Questions:**
1. Read the question twice to make sure you understand what's being asked
2. Look at each option carefully before choosing
3. Eliminate options that you know are incorrect
4. Choose the best remaining answer

**Keep Practicing!**
You're building important skills by working through these questions. Each attempt helps you understand the material better. Try reviewing the concepts related to this question and then attempt similar practice questions. You've got this! 💪`
      : `**Let's learn from this together! 🎓**

The correct answer is **${correctAnswer}**. I can see your answer was **${studentAnswer}**.

**Understanding the Difference:**
Sometimes we make mistakes because we're still building our understanding of the topic. That's completely normal and part of the learning process! The key is to figure out where our thinking needs adjusting.

**Building Your Understanding:**
Take some time to review the concepts related to this question. Look back at your notes or textbook to strengthen your grasp of the material. Try to understand *why* ${correctAnswer} is correct - not just memorize it.

**Strategy for Success:**
Break down complex questions into smaller parts. Make sure you understand what each part is asking before you answer. Practice similar questions to build confidence.

**You're Making Progress!**
Every question you attempt is helping you learn and grow. Keep up the great work, and don't hesitate to ask for help when you need it! 🌟`;

    return new Response(
      JSON.stringify({ 
        explanation: fallbackExplanation,
        warning: 'AI explanation service is temporarily unavailable. Here\'s a detailed explanation to help you understand.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in explain-answer function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
