/**
 * Exam Parser Utility
 * 
 * Parses generated exam markdown into interactive question components
 * Supports multiple choice, short answer, and essay questions
 */

export interface ExamQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer' | 'essay' | 'numeric';
  text: string;
  marks: number;
  options?: string[]; // For multiple choice
  correctAnswer?: string | number; // For auto-grading
  sectionTitle?: string;
  diagram?: {
    type: 'chart' | 'mermaid' | 'svg' | 'image';
    data: any;
    title?: string;
    caption?: string;
  };
}

export interface ParsedExam {
  title: string;
  grade?: string;
  subject?: string;
  instructions: string[];
  sections: {
    title: string;
    questions: ExamQuestion[];
  }[];
  totalMarks: number;
  hasMemo: boolean;
}

/**
 * Parse exam markdown into structured format
 */
export function parseExamMarkdown(markdown: string): ParsedExam | null {
  try {
    console.log('[ExamParser] Parsing markdown. First 500 chars:', markdown.substring(0, 500));
    const lines = markdown.split('\n');
    console.log('[ExamParser] Total lines:', lines.length);
    
    let title = '';
    const instructions: string[] = [];
    const sections: { title: string; questions: ExamQuestion[] }[] = [];
    let currentSection: { title: string; questions: ExamQuestion[] } | null = null;
    let totalMarks = 0;
    let hasMemo = false;
    
    let inInstructions = false;
    let inMemo = false;
    let currentQuestion: Partial<ExamQuestion> | null = null;
    let questionIdCounter = 0;
    
    // Store answers from marking memorandum
    const memoAnswers: Record<string, string> = {};
    let currentMemoQuestionNum = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Detect title (first # heading)
      if (line.startsWith('# ') && !title) {
        title = line.replace(/^# /, '').trim();
        continue;
      }
      
      // Detect INSTRUCTIONS section
      if (line.includes('INSTRUCTIONS') || line.includes('**INSTRUCTIONS:**')) {
        inInstructions = true;
        continue;
      }
      
      // Detect end of instructions (horizontal rule or section start)
      if (inInstructions && (line.startsWith('---') || line.startsWith('## '))) {
        inInstructions = false;
      }
      
      // Collect instructions
      if (inInstructions && line.match(/^\d+\./)) {
        instructions.push(line.replace(/^\d+\.\s*/, ''));
        continue;
      }
      
      // Detect MARKING MEMORANDUM
      if (line.includes('MARKING MEMORANDUM') || line.includes('MEMO')) {
        hasMemo = true;
        inMemo = true;
        // Save last question before entering memo
        if (currentQuestion && currentQuestion.text && currentSection) {
          currentSection.questions.push(currentQuestion as ExamQuestion);
          totalMarks += currentQuestion.marks || 0;
          currentQuestion = null;
        }
        // Save last section
        if (currentSection) {
          sections.push(currentSection);
          currentSection = null;
        }
        continue;
      }
      
      // Process memo content to extract answers
      if (inMemo) {
        // Match question number in memo: "1.", "1.1", "Question 1:", etc.
        const memoQuestionMatch = line.match(/^\*?\*?(?:Question\s+)?(\d+\.?\d*\.?)\*?\*?[:\s]+(.+)/i);
        if (memoQuestionMatch) {
          currentMemoQuestionNum = memoQuestionMatch[1].replace(/\.$/, ''); // Remove trailing dot
          const answerText = memoQuestionMatch[2].trim();
          // Store answer (could be multi-line, so we'll concatenate)
          memoAnswers[currentMemoQuestionNum] = answerText;
          console.log('[ExamParser] Memo answer for Q' + currentMemoQuestionNum + ':', answerText);
        } else if (currentMemoQuestionNum && line && !line.startsWith('##') && !line.startsWith('---')) {
          // Continue multi-line answer
          memoAnswers[currentMemoQuestionNum] += ' ' + line;
        }
        continue;
      }
      
      // Detect section headers (## SECTION A, etc.)
      if (line.startsWith('## ') && line.toUpperCase().includes('SECTION')) {
        if (currentSection) {
          console.log('[ExamParser] Saving section:', currentSection.title, 'with', currentSection.questions.length, 'questions');
          sections.push(currentSection);
        }
        const sectionTitle = line.replace(/^## /, '').trim();
        console.log('[ExamParser] New section detected:', sectionTitle);
        currentSection = {
          title: sectionTitle,
          questions: [],
        };
        continue;
      }
      
      // Detect question start (numeric pattern like "1.", "1.1", "Question 1:", "**Question 1**")
      const questionMatch = line.match(/^\*?\*?(?:Question\s+)?(\d+\.?\d*\.?)\*?\*?[:\s]+(.+)/i);
      if (questionMatch && currentSection) {
        console.log('[ExamParser] Question detected:', line);
        // Save previous question
        if (currentQuestion && currentQuestion.text) {
          currentSection.questions.push(currentQuestion as ExamQuestion);
          totalMarks += currentQuestion.marks || 0;
          console.log('[ExamParser] Saved question:', currentQuestion.text.substring(0, 50));
        }
        
        const [, questionNum, questionText] = questionMatch;
        
        // Extract marks from question text like "(5 marks)" or "[5]"
        const marksMatch = questionText.match(/\((\d+)\s*marks?\)|\[(\d+)\]/i);
        const marks = marksMatch ? parseInt(marksMatch[1] || marksMatch[2]) : 1;
        
        currentQuestion = {
          id: `q-${++questionIdCounter}`,
          text: questionText.replace(/\((\d+)\s*marks?\)|\[(\d+)\]/gi, '').trim(),
          marks,
          sectionTitle: currentSection.title,
          type: 'short_answer', // Default type
        };
        
        // Detect question type based on keywords and structure
        const lowerText = questionText.toLowerCase();
        
        // Multiple choice detection
        if (lowerText.includes('choose') || 
            lowerText.includes('select') ||
            lowerText.includes('which of the following') ||
            lowerText.match(/circle.*correct|tick.*correct|mark.*correct/)) {
          currentQuestion.type = 'multiple_choice';
          currentQuestion.options = [];
        } 
        // Essay questions
        else if (lowerText.match(/explain|describe|discuss|write.*paragraph|write.*essay/)) {
          currentQuestion.type = 'essay';
        } 
        // Numeric questions (calculations, sequences, formulas)
        else if (lowerText.match(/calculate|solve|sum of|product of|difference|quotient|equation|formula|sequence|pattern|multiples?|factors?|next \d+ numbers/)) {
          currentQuestion.type = 'numeric';
        }
        // If still short_answer, check if it expects a number (place value, count, etc.)
        else if (lowerText.match(/how many|count|place value|value of|digit/)) {
          currentQuestion.type = 'numeric';
        }
        
        continue;
      }
      
      // Detect multiple choice options (a), b), A., B., a. b., A. B., etc.)
      const optionMatch = line.match(/^([a-dA-D])[.)]\s+(.+)/);
      if (optionMatch && currentQuestion && currentQuestion.type === 'multiple_choice') {
        currentQuestion.options = currentQuestion.options || [];
        currentQuestion.options.push(optionMatch[2].trim());
      }
    }
    
    // Save last question
    if (currentQuestion && currentQuestion.text && currentSection) {
      currentSection.questions.push(currentQuestion as ExamQuestion);
      totalMarks += currentQuestion.marks || 0;
    }
    
    // Save last section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    // Attach correct answers from memo to questions
    if (hasMemo && Object.keys(memoAnswers).length > 0) {
      console.log('[ExamParser] Attaching memo answers to questions:', Object.keys(memoAnswers));
      let questionCounter = 0;
      for (const section of sections) {
        for (const question of section.questions) {
          questionCounter++;
          const questionNum = String(questionCounter);
          if (memoAnswers[questionNum]) {
            question.correctAnswer = memoAnswers[questionNum].trim();
            console.log('[ExamParser] Q' + questionNum + ' correct answer:', question.correctAnswer);
          }
        }
      }
    }
    
    // Only return parsed exam if we have questions
    console.log('[ExamParser] Parsing complete. Sections:', sections.length, 'Total questions:', sections.reduce((sum, s) => sum + s.questions.length, 0));
    if (sections.length > 0 && sections.some(s => s.questions.length > 0)) {
      console.log('[ExamParser] Valid exam detected. Title:', title, 'Total marks:', totalMarks);
      return {
        title: title || 'Practice Exam',
        instructions,
        sections,
        totalMarks,
        hasMemo,
      };
    }
    
    console.warn('[ExamParser] No valid sections or questions found');
    return null;
  } catch (error) {
    console.error('[ExamParser] Failed to parse exam:', error);
    return null;
  }
}

/**
 * Validate student answers against memorandum
 * Enhanced version with flexible matching
 */
export function gradeAnswer(
  question: ExamQuestion,
  studentAnswer: string
): { isCorrect: boolean; feedback: string; marks: number } {
  console.log('[gradeAnswer] Grading:', {
    questionText: question.text?.substring(0, 50),
    questionType: question.type,
    correctAnswer: question.correctAnswer,
    studentAnswer,
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
    
    const result = {
      isCorrect,
      feedback: isCorrect 
        ? '✓ Correct!' 
        : `✗ Incorrect. The correct answer is ${correctLetter.toUpperCase()}${question.options && correctLetter ? ': ' + question.options[correctLetter.charCodeAt(0) - 97] : ''}`,
      marks: isCorrect ? question.marks : 0,
    };
    
    console.log('[gradeAnswer] MC Result:', result);
    return result;
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
    const frac = str.match(/(-?\d+(?:\.\d+)?)\s*[/]{1}\s*(-?\d+(?:\.\d+)?)/);
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

  // Try numeric comparison next (handles both pure numbers and number sequences)
  const studentNums = studentNormalized.match(/\d+\.?\d*/g)?.map(n => parseFloat(n)) || [];
  const correctNums = correctNormalized.match(/\d+\.?\d*/g)?.map(n => parseFloat(n)) || [];
  
  // If both have numbers, compare them
  if (studentNums.length > 0 && correctNums.length > 0) {
    // For sequences or multiple numbers
    if (studentNums.length === correctNums.length && studentNums.length > 1) {
      const allMatch = studentNums.every((num, idx) => {
        const tolerance = Math.abs(correctNums[idx] * 0.001) || 0.01;
        return Math.abs(num - correctNums[idx]) <= tolerance;
      });
      
      if (allMatch) {
        return {
          isCorrect: true,
          feedback: '✓ Correct!',
          marks: question.marks,
        };
      }
      
      // Check if close (for encouraging feedback)
      const closeCount = studentNums.filter((num, idx) => {
        const tolerance = Math.abs(correctNums[idx] * 0.1); // 10% tolerance for "close"
        return Math.abs(num - correctNums[idx]) <= tolerance;
      }).length;
      
      if (closeCount >= studentNums.length * 0.7) {
        return {
          isCorrect: false,
          feedback: `🔶 Close! You got ${closeCount}/${studentNums.length} numbers right. Expected: "${question.correctAnswer}"`,
          marks: 0,
        };
      }
      
      return {
        isCorrect: false,
        feedback: `✗ Incorrect. Expected: "${question.correctAnswer}"`,
        marks: 0,
      };
    }
    
    // For single number - extract just the number from both answers
    if (studentNums.length >= 1 && correctNums.length >= 1) {
      // Use first number found in each answer
      const studentNum = studentNums[0];
      const correctNum = correctNums[0];
      
      const tolerance = Math.abs(correctNum * 0.001) || 0.01;
      const isCorrect = Math.abs(studentNum - correctNum) <= tolerance;
      
      // Check if close but not exact
      const isClose = !isCorrect && Math.abs(studentNum - correctNum) <= Math.abs(correctNum * 0.05); // 5% tolerance
      
      if (isCorrect) {
        return {
          isCorrect: true,
          feedback: '✓ Correct!',
          marks: question.marks,
        };
      }
      
      if (isClose) {
        return {
          isCorrect: false,
          feedback: `🔶 Very close! Your answer: ${studentNum}, Expected: ${correctNum}`,
          marks: 0,
        };
      }
      
      return {
        isCorrect: false,
        feedback: `✗ Incorrect. Expected: "${question.correctAnswer}"`,
        marks: 0,
      };
    }
  }
  
  // Text-based comparison (for words like "hundreds", "tens", etc.)
  // Remove all punctuation and extra spaces for comparison
  const studentClean = studentProcessed.replace(/[.,;:!?]/g, '').trim();
  const correctClean = correctProcessed.replace(/[.,;:!?]/g, '').trim();
  
  // Exact match (after normalization and synonym replacement)
  if (studentClean === correctClean) {
    return {
      isCorrect: true,
      feedback: '✓ Correct!',
      marks: question.marks,
    };
  }
  
  // Partial match (student answer contains correct answer or vice versa)
  if (studentClean.includes(correctClean) || correctClean.includes(studentClean)) {
    return {
      isCorrect: true,
      feedback: '✓ Correct!',
      marks: question.marks,
    };
  }
  
  // Check if they wrote out numbers as words (e.g., "six" vs "6")
  const numberWords: Record<string, number> = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70, 
    'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000,
  };
  
  const studentWords = studentClean.split(/\s+/);
  const correctWords = correctClean.split(/\s+/);
  
  // Check if one is word form and other is numeric
  const studentHasWordNumber = studentWords.some(w => numberWords[w] !== undefined);
  const correctHasWordNumber = correctWords.some(w => numberWords[w] !== undefined);
  
  if (studentHasWordNumber || correctHasWordNumber) {
    const studentValue = studentWords.map(w => numberWords[w] ?? w).join(' ');
    const correctValue = correctWords.map(w => numberWords[w] ?? w).join(' ');
    
    if (studentValue === correctValue) {
      return {
        isCorrect: true,
        feedback: '✓ Correct!',
        marks: question.marks,
      };
    }
  }
  
  // Calculate similarity for "close" feedback
  const similarity = calculateSimilarity(studentClean, correctClean);
  
  if (similarity > 0.7) {
    return {
      isCorrect: false,
      feedback: `🔶 Close! Check your spelling and wording. Expected: "${question.correctAnswer}"`,
      marks: 0,
    };
  }
  
  // Not a match
  const result = {
    isCorrect: false,
    feedback: `✗ Your answer: "${studentAnswer}". Expected: "${question.correctAnswer}"`,
    marks: 0,
  };
  
  console.log('[gradeAnswer] Result:', result);
  return result;
}

/**
 * Calculate similarity between two strings (simple Levenshtein-based)
 */
function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance for spell-check tolerance
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

