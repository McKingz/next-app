/**
 * useHomeworkGenerator - Tool-enabled homework help for parents
 * 
 * Enhanced with agentic AI capabilities:
 * - Contextual child learning data
 * - AI-generated practice problems
 * - Suggested learning actions
 * - Study reminders
 */

import { useCallback, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { incrementUsage, logUsageEvent } from '@/lib/ai/usage';
import { ParentToolRegistry } from '@/services/dash-ai/ParentToolRegistry';
import { logger } from '@/lib/logger';
import { buildSystemPrompt, parseHomeworkResponse } from './utils/homeworkHelpers';

export type HomeworkGenOptions = {
  question: string;
  subject: string;
  gradeLevel: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  context?: string;
  model?: string;
  studentId?: string;  // NEW: for context retrieval and tool usage
};

export interface HomeworkResult {
  text: string;
  toolsUsed?: Array<{ name: string; result: any }>;
  practiceProblems?: any[];
  suggestedActions?: Array<{ label: string; action: () => void }>;
}

export function useHomeworkGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HomeworkResult | null>(null);

  const generate = useCallback(async (opts: HomeworkGenOptions): Promise<HomeworkResult> => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const client = assertSupabase();
      const toolRegistry = new ParentToolRegistry();
      const toolsUsed: Array<{ name: string; result: any }> = [];

      // Step 1: Get child context if studentId provided
      let childContext: any = null;
      if (opts.studentId) {
        const contextResult = await toolRegistry.execute('get_child_learning_context', {
          student_id: opts.studentId,
          include_homework: true,
          include_attendance: true,
          days_back: 30
        });

        if (contextResult.success) {
          childContext = contextResult.result.data;
          toolsUsed.push({ name: 'get_child_learning_context', result: contextResult.result });
        }
      }

      // Step 2: Build enhanced system prompt with context
      const systemPrompt = buildSystemPrompt(opts, childContext);

      // Step 3: Call AI with tools
      const messages = [{
        role: 'user',
        content: `${opts.question}\n\nSubject: ${opts.subject}\nGrade: ${opts.gradeLevel}\nDifficulty: ${opts.difficulty || 'medium'}`
      }];

      const toolSpecs = toolRegistry.getToolSpecs();

      const { data, error: aiError } = await client.functions.invoke('ai-gateway', {
        body: {
          action: 'homework_help',
          messages,
          system: systemPrompt,
          tools: toolSpecs,
          tool_choice: { type: 'auto' },
          model: opts.model || 'claude-3-sonnet'
        }
      });

      if (aiError) throw aiError;

      // Step 4: Handle tool calls if any
      if (data.tool_calls && data.tool_calls.length > 0) {
        for (const toolCall of data.tool_calls) {
          const toolResult = await toolRegistry.execute(toolCall.name, toolCall.input);
          toolsUsed.push({ name: toolCall.name, result: toolResult.result });
        }

        // Get final response with tool results
        const toolResultMessages = [
          ...messages,
          { role: 'assistant', content: data.raw_content },
          {
            role: 'user',
            content: toolsUsed.map(t => 
              `Tool ${t.name} result: ${JSON.stringify(t.result.data || t.result)}`
            ).join('\n\n')
          }
        ];

        const { data: finalData } = await client.functions.invoke('ai-gateway', {
          body: {
            action: 'homework_help',
            messages: toolResultMessages,
            system: systemPrompt,
            model: opts.model || 'claude-3-sonnet'
          }
        });

        data.content = finalData.content;
      }

      // Step 5: Extract structured data from response
      const parsedResult = parseHomeworkResponse(data.content, toolsUsed);

      // Track usage
      await incrementUsage('homework_help', 1).catch(() => {});
      await logUsageEvent({
        feature: 'homework_help_agentic',
        model: data.model || opts.model || 'claude-3-sonnet',
        tokensIn: data.usage?.input_tokens || 0,
        tokensOut: data.usage?.output_tokens || 0,
        estCostCents: data.cost || 0,
        timestamp: new Date().toISOString(),
        metadata: {
          tools_used: toolsUsed.length,
          student_id: opts.studentId || null
        }
      }).catch(() => {});

      setResult(parsedResult);
      return parsedResult;

    } catch (e: any) {
      logger.error('[useHomeworkGenerator] Error:', e);
      setError(e?.message || 'Failed to generate help');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, result, generate } as const;
}
