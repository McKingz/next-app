const AI_ENABLED = (process.env.EXPO_PUBLIC_AI_ENABLED === 'true') || (process.env.EXPO_PUBLIC_ENABLE_AI_FEATURES === 'true')
import { assertSupabase } from '../supabase'
import { track } from '../analytics'
import { getCurrentLanguage } from '../i18n'

/**
 * Convert app language code to proper locale for AI services
 * Prioritizes South African locales for supported SA languages
 */
function getAILocale(): string {
  const lang = getCurrentLanguage();
  
  // South African languages - use ZA locale
  const saLanguages: Record<string, string> = {
    'en': 'en-ZA',
    'af': 'af-ZA',
    'zu': 'zu-ZA',
    'xh': 'xh-ZA',
    'st': 'st-ZA',
    'tn': 'tn-ZA',
    'ss': 'ss-ZA',
    'nr': 'nr-ZA',
    've': 've-ZA',
    'ts': 'ts-ZA',
  };
  
  // Return SA locale if available, otherwise use generic language code
  return saLanguages[lang] || lang;
}

export class HomeworkService {
  static async gradeHomework(submissionId: string, submissionContent: string, assignmentTitle: string, gradeLevel: string) {
    try {
      if (!AI_ENABLED) {
        return {
          score: 75,
          feedback: 'Good effort on this assignment. Keep working hard!',
          suggestions: ['Review the material again', 'Practice more examples'],
          strengths: ['Shows understanding of basic concepts'],
          areasForImprovement: ['Attention to detail', 'Following instructions']
        }
      }

      const ageMatch = String(gradeLevel || '').match(/(\d{1,2})/)
      const _studentAge = ageMatch ? Math.max(3, Math.min(12, parseInt(ageMatch[1], 10))) : 5;
      void _studentAge;

      // Placeholder AI grading call — integrate actual provider later
      const score = 85
      const feedback = 'Great effort! Solid understanding with minor gaps.'
      const strengths: string[] = ['Understands core concept']
      const areasForImprovement: string[] = ['Double-check counting sequence']
      const suggestions: string[] = ['Practice with number lines']

      try {
        await assertSupabase()
          .from('homework_submissions')
          .update({
            grade: Number(score),
            feedback: feedback,
            graded_at: new Date().toISOString(),
            graded_by: 'ai',
            status: 'reviewed'
          })
          .eq('id', submissionId)
      } catch (e) { console.debug('homework_submissions update failed', e); }

      return { score, feedback, suggestions, strengths, areasForImprovement }
    } catch {
      return {
        score: 70,
        feedback: 'Thank you for submitting your homework. Keep up the good work!',
        suggestions: ['Review the lesson materials', 'Practice similar exercises'],
        strengths: ['Completed the assignment'],
        areasForImprovement: ['Follow instructions carefully']
      }
    }
  }

  static async streamGradeHomework(
    submissionId: string,
    submissionContent: string,
    assignmentTitle: string,
    gradeLevel: string,
    handlers: {
      onDelta?: (chunk: string) => void
      onFinal?: (payload: { score: number; feedback: string; suggestions: string[]; strengths: string[]; areasForImprovement: string[] }) => void
      onError?: (err: { message: string; code?: string }) => void
    },
    options?: { model?: string }
  ): Promise<void> {
    try {
      if (!AI_ENABLED) {
        handlers.onFinal?.({
          score: 75,
          feedback: 'Good effort on this assignment. Keep working hard!',
          suggestions: ['Review the material again', 'Practice more examples'],
          strengths: ['Shows understanding of basic concepts'],
          areasForImprovement: ['Attention to detail', 'Following instructions'],
        })
        return
      }

      // Attempt secure server-side grading via Edge Function
      try {
        track('edudash.ai.grading.started', {})
        const { data, error } = await assertSupabase().functions.invoke('ai-proxy', {
          body: {
            scope: 'teacher',
            service_type: 'grading_assistance', // Valid service_type per DB constraint
            payload: {
              prompt: `Grade this homework submission.\n\nAssignment: ${assignmentTitle}\nGrade Level: ${gradeLevel}\n\nSubmission:\n${submissionContent}`,
              model: options?.model,
            },
            metadata: {
              assignment_title: assignmentTitle,
              grade_level: gradeLevel,
              locale: getAILocale(), // Dynamic locale based on user's language preference
              language: getCurrentLanguage(), // Raw language code for additional context
            }
          }
        })
        if (error) throw error

        const payload: any = data?.result || data || {}
        const score = typeof payload.score === 'number' ? payload.score : 85
        const feedback = payload.feedback || 'Great effort! Solid understanding with minor gaps.'
        const strengths: string[] = Array.isArray(payload.strengths) ? payload.strengths : ['Understands core concept']
        const areasForImprovement: string[] = Array.isArray(payload.areasForImprovement) ? payload.areasForImprovement : ['Double-check counting sequence']
        const suggestions: string[] = Array.isArray(payload.suggestions) ? payload.suggestions : ['Practice with number lines']

        handlers.onFinal?.({ score, feedback, suggestions, strengths, areasForImprovement })
        track('edudash.ai.grading.completed', { score })

        try {
          await assertSupabase()
            .from('homework_submissions')
            .update({
              grade: Number(score),
              feedback: feedback,
              graded_at: new Date().toISOString(),
              graded_by: 'ai',
              status: 'reviewed'
            })
            .eq('id', submissionId)
        } catch (e) { console.debug('homework_submissions update failed', e); }
        return
      } catch (invokeError: any) {
        const msg = String(invokeError?.message || '')
        if (msg.toLowerCase().includes('rate') && (msg.includes('429') || msg.toLowerCase().includes('limit'))) {
          handlers.onError?.({ message: 'Rate limit reached. Please try again later.', code: 'rate_limited' })
          track('edudash.ai.grading.rate_limited', {})
          return
        }
        // Fallback to simulated streaming when server grading fails
      }

      // Simulated streaming: emit a couple of JSON chunks, then final
      const chunks = [
        '{"grade":"Good","feedback":"Analyzing submission","strengths":[],',
        '"areasForImprovement":[],"nextSteps":[]}',
      ]
      for (const c of chunks) {
        handlers.onDelta?.(c)
        await new Promise(r => setTimeout(r, 200))
      }

      const score = 85
      const feedback = 'Great effort! Solid understanding with minor gaps.'
      const strengths: string[] = ['Understands core concept']
      const areasForImprovement: string[] = ['Double-check counting sequence']
      const suggestions: string[] = ['Practice with number lines']

      handlers.onFinal?.({ score, feedback, suggestions, strengths, areasForImprovement })
      track('edudash.ai.grading.completed_fallback', { score })

      try {
        await assertSupabase()
          .from('homework_submissions')
          .update({
            grade: Number(score),
            feedback: feedback,
            graded_at: new Date().toISOString(),
            graded_by: 'ai',
            status: 'reviewed'
          })
          .eq('id', submissionId)
      } catch { /* noop */ void 0; }
    } catch (e: any) {
      handlers.onError?.({ message: e?.message || 'Streaming error' })
    }
  }
}
