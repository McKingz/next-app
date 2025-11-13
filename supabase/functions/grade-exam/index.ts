// Grade Exam Edge Function
// Handles server-side exam grading, validation, and progress tracking

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Question interface
interface ExamQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer' | 'essay' | 'numeric';
  text: string;
  marks: number;
  options?: string[];
  correctAnswer?: string | number;
}

// Grading result interface
interface GradingResult {
  isCorrect: boolean;
  feedback: string;
  marks: number;
}

/**
 * Grade a single answer
 * Ported from frontend examParser.ts for server-side validation
 */
function gradeAnswer(question: ExamQuestion, studentAnswer: string): GradingResult {
  console.log('[gradeAnswer] Grading:', {
    questionId: question.id,
    questionType: question.type,
    correctAnswer: question.correctAnswer,
    studentAnswer: studentAnswer?.substring(0, 50),
  });
  
  // Empty answer check
  if (!studentAnswer || studentAnswer.trim() === '') {
    return {
      isCorrect: false,
      feedback: 'No answer provided',
      marks: 0,
    };
  }
  
  // If no correct answer provided, can't auto-grade
  if (!question.correctAnswer) {
    console.log('[gradeAnswer] No correct answer provided - cannot auto-grade');
    return {
      isCorrect: false,
      feedback: '⏳ Answer recorded. Awaiting teacher review.',
      marks: 0,
    };
  }
  
  // Normalize both answers
  const studentNormalized = studentAnswer.trim().toLowerCase().replace(/\s+/g, ' ');
  const correctNormalized = question.correctAnswer.toString().trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Math operation synonyms for better matching
  const mathSynonyms: Record<string, string[]> = {
    'add': ['plus', 'sum', 'addition', 'added', 'total', '+'],
    'subtract': ['minus', 'difference', 'take away', 'less', 'subtracted', '-'],
    'multiply': ['times', 'product', 'multiplied by', 'x', '*', '×'],
    'divide': ['divided by', 'quotient', 'split', '÷', '/'],
    'equal': ['equals', 'is', '=', 'same as'],
    'hundred': ['hundreds', '100'],
    'thousand': ['thousands', '1000'],
    'million': ['millions', '1000000'],
  };
  
  // Replace synonyms in both answers for better matching
  let studentProcessed = studentNormalized;
  let correctProcessed = correctNormalized;
  
  // Helper to escape regex special characters
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  for (const [key, synonyms] of Object.entries(mathSynonyms)) {
    for (const synonym of synonyms) {
      const escapedSynonym = escapeRegex(synonym);
      studentProcessed = studentProcessed.replace(new RegExp(`\\b${escapedSynonym}\\b`, 'g'), key);
      correctProcessed = correctProcessed.replace(new RegExp(`\\b${escapedSynonym}\\b`, 'g'), key);
    }
  }
  
  // Multiple choice with correct answer
  if (question.type === 'multiple_choice') {
    // Handle different formats: "A", "a", "A.", "a)", "Option A", etc.
    let studentLetter = studentNormalized.match(/([a-d])/)?.[1] || '';
    let correctLetter = correctNormalized.match(/([a-d])/)?.[1] || '';
    
    // If correctAnswer is not a letter, try to match it with the options
    if (!correctLetter && question.options) {
      // The correct answer might be the actual text of an option
      const correctText = correctNormalized.trim();
      const optionIndex = question.options.findIndex(opt => 
        opt.toLowerCase().trim() === correctText ||
        opt.toLowerCase().includes(correctText) ||
        correctText.includes(opt.toLowerCase().trim())
      );
      
      if (optionIndex !== -1) {
        correctLetter = String.fromCharCode(97 + optionIndex); // 'a', 'b', 'c', 'd'
        console.log('[gradeAnswer] Matched correct answer text to option', correctLetter.toUpperCase(), ':', question.options[optionIndex]);
      }
    }
    
    // If student answer is just a letter, normalize it
    if (studentNormalized.length === 1 && studentNormalized.match(/[a-d]/)) {
      studentLetter = studentNormalized;
    }
    
    const isCorrect = studentLetter === correctLetter;
    
    return {
      isCorrect,
      feedback: isCorrect 
        ? '✓ Correct!' 
        : `✗ Incorrect. The correct answer is ${correctLetter.toUpperCase()}${question.options && correctLetter ? ': ' + question.options[correctLetter.charCodeAt(0) - 97] : ''}`,
      marks: isCorrect ? question.marks : 0,
    };
  }
  
  // Try math expression parsing first (fractions like 3/6 or 3 ÷ 6, percents, decimals)
  const parseMathValue = (s: string): number | null => {
    let str = s.trim().toLowerCase();
    // normalize decimal comma if there's no dot
    if (str.includes(',') && !str.includes('.')) {
      str = str.replace(/,/g, '.');
    }
    // normalize division symbol to '/'
    str = str.replace(/÷/g, '/');
    // fraction a/b
    const frac = str.match(/(-?\d+(?:\.\d+)?)\s*[\/]{1}\s*(-?\d+(?:\.\d+)?)/);
    if (frac) {
      const num = parseFloat(frac[1]);
      const den = parseFloat(frac[2]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return num / den;
      }
    }
    // percent
    const percent = str.match(/(-?\d+(?:\.\d+)?)\s*%/);
    if (percent) {
      const val = parseFloat(percent[1]);
      if (!isNaN(val)) return val / 100;
    }
    // single number
    const nums = str.match(/-?\d+(?:\.\d+)?/g) || [];
    if (nums.length === 1) {
      const val = parseFloat(nums[0]);
      return isNaN(val) ? null : val;
    }
    return null;
  };

  const studentParsed = parseMathValue(studentNormalized);
  const correctParsed = parseMathValue(correctNormalized);
  if (studentParsed !== null && correctParsed !== null) {
    const tolerance = Math.abs(correctParsed * 0.001) || 0.01;
    const isCorrect = Math.abs(studentParsed - correctParsed) <= tolerance;
    if (isCorrect) {
      return {
        isCorrect: true,
        feedback: '✓ Correct!',
        marks: question.marks,
      };
    }
    // fall through to other strategies for close feedback
  }

  // Exact match after synonym processing
  if (studentProcessed === correctProcessed) {
    return {
      isCorrect: true,
      feedback: '✓ Correct!',
      marks: question.marks,
    };
  }
  
  // Partial match (contains)
  if (studentProcessed.includes(correctProcessed) || correctProcessed.includes(studentProcessed)) {
    return {
      isCorrect: true,
      feedback: '✓ Correct! (partial match)',
      marks: question.marks,
    };
  }
  
  // Wrong answer
  return {
    isCorrect: false,
    feedback: `✗ Incorrect. The correct answer is: ${question.correctAnswer}`,
    marks: 0,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { examId, answers } = await req.json();
    
    if (!examId || !answers || typeof answers !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid request: examId and answers required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[grade-exam] Grading exam ${examId} for user ${user.id}`);

    // Fetch exam from database
    const { data: examData, error: fetchError } = await supabase
      .from('exam_generations')
      .select('generated_content, grade, subject')
      .eq('id', examId)
      .single();

    if (fetchError || !examData) {
      return new Response(
        JSON.stringify({ error: 'Exam not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse exam content
    const exam = JSON.parse(examData.generated_content);
    
    // Grade all answers
    const gradingResults: Record<string, GradingResult> = {};
    let totalMarksEarned = 0;
    let totalMarksPossible = 0;
    let questionsAnswered = 0;
    let questionsCorrect = 0;

    // Flatten all questions from all sections
    const allQuestions: ExamQuestion[] = exam.sections.flatMap((section: any) => section.questions || []);

    for (const question of allQuestions) {
      const studentAnswer = answers[question.id];
      
      if (studentAnswer && studentAnswer.trim() !== '') {
        questionsAnswered++;
        const result = gradeAnswer(question, studentAnswer);
        gradingResults[question.id] = result;
        
        totalMarksEarned += result.marks;
        if (result.isCorrect) {
          questionsCorrect++;
        }
      }
      
      totalMarksPossible += question.marks;
    }

    const percentage = totalMarksPossible > 0 
      ? Math.round((totalMarksEarned / totalMarksPossible) * 100) 
      : 0;

    console.log(`[grade-exam] Results: ${totalMarksEarned}/${totalMarksPossible} (${percentage}%)`);

    // Save progress to database
    const { error: progressError } = await supabase
      .from('exam_user_progress')
      .insert({
        user_id: user.id,
        exam_generation_id: examId,
        score_obtained: totalMarksEarned,
        score_total: totalMarksPossible,
        percentage,
        answers: answers,
        feedback: gradingResults,
        completed_at: new Date().toISOString(),
      });

    if (progressError) {
      console.error('[grade-exam] Error saving progress:', progressError);
      // Don't fail the request if progress save fails
    }

    // Return grading results
    return new Response(
      JSON.stringify({
        success: true,
        results: {
          feedback: gradingResults,
          score: {
            earned: totalMarksEarned,
            total: totalMarksPossible,
            percentage,
          },
          stats: {
            questionsAnswered,
            questionsCorrect,
            questionsTotal: allQuestions.length,
          },
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[grade-exam] Error:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.stack?.substring(0, 500),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
