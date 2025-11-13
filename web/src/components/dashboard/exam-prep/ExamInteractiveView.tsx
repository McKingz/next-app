'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, FileCheck, AlertCircle, Bot, Sparkles, Save as SaveIcon, Printer, X } from 'lucide-react';
import { ParsedExam, ExamQuestion, gradeAnswer } from '@/lib/examParser';
import { useExamSession } from '@/lib/hooks/useExamSession';
import { createClient } from '@/lib/supabase/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExamDiagram } from './ExamDiagram';
import '../exam-modal-close-fix.css';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

// Helper component to render text with optional math support
// Only uses KaTeX if the text contains actual math expressions
function MathText({ text }: { text: string }) {
  // More conservative math detection - only treat as math if it has clear math indicators
  // Avoid false positives on regular text with numbers or basic punctuation
  const hasMath = (
    /\\[a-zA-Z]+/.test(text) ||           // LaTeX commands like \frac, \sqrt, \int
    /\^[{0-9]/.test(text) ||               // Superscripts like x^2, x^{10}
    /_[{0-9]/.test(text) ||                // Subscripts like x_1, x_{10}
    /\$.*\$/.test(text) ||                 // Inline math delimiters
    /\\\(.*\\\)/.test(text) ||             // LaTeX inline math
    /\\\[.*\\\]/.test(text) ||             // LaTeX display math
    (/[0-9]+\/[0-9]+/.test(text) && text.length < 20) // Fractions like 3/4 (but not dates or long text)
  );
  
  if (!hasMath) {
    // Plain text - no math font, just regular system font
    return <span style={{ fontFamily: 'inherit' }}>{text}</span>;
  }
  
  // Has math - use KaTeX
  try {
    return <InlineMath math={text} />;
  } catch (error) {
    // Fallback if KaTeX fails to parse
    console.warn('[MathText] KaTeX parsing failed:', error);
    return <span style={{ fontFamily: 'inherit' }}>{text}</span>;
  }
}



interface ExamInteractiveViewProps {
  exam: ParsedExam;
  generationId?: string | null;
  onClose?: () => void;
  onSubmitted?: (score: { earned: number; total: number }) => void;
}

interface StudentAnswers {
  [questionId: string]: string;
}

interface QuestionFeedback {
  isCorrect: boolean;
  feedback: string;
  marks: number;
}

export function ExamInteractiveView({ exam, generationId, onClose, onSubmitted }: ExamInteractiveViewProps) {
  const [studentAnswers, setStudentAnswers] = useState<StudentAnswers>({});
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, QuestionFeedback>>({});
  const [score, setScore] = useState<{ earned: number; total: number } | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loadingExplanations, setLoadingExplanations] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const { saveProgress } = useExamSession(generationId || null);

  // Helper key for clearing active exam session from parent page (set there)
  const activeKeyFromMeta = typeof window !== 'undefined' && exam?.grade && exam?.subject
    ? `ACTIVE_EXAM_${String(exam.grade)}_${String(exam.subject)}_practice_test`
    : null;

  // Autosave: persist answers so refresh won't reset progress
  const autosaveKey = typeof window !== 'undefined'
    ? `EXAM_AUTOSAVE_${generationId || (exam?.title || 'untitled')}`
    : '';

  // Hydrate from autosave on mount
  useEffect(() => {
    try {
      if (!autosaveKey) return;
      const raw = localStorage.getItem(autosaveKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.answers && typeof saved.answers === 'object') {
          setStudentAnswers(saved.answers);
        }
      }
    } catch (e) {
      console.warn('[ExamInteractiveView] Failed to load autosave:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save on every answer change (lightweight)
  useEffect(() => {
    try {
      if (!autosaveKey) return;
      const payload = {
        answers: studentAnswers,
        examTitle: exam?.title,
        grade: exam?.grade,
        subject: exam?.subject,
        updatedAt: Date.now(),
      };
      localStorage.setItem(autosaveKey, JSON.stringify(payload));
    } catch (e) {
      console.warn('[ExamInteractiveView] Failed to autosave:', e);
    }
  }, [studentAnswers, autosaveKey, exam?.title, exam?.grade, exam?.subject]);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };  
  
  /**
   * Get AI-powered explanations for incorrect answers
   */
  const supabase = createClient();

  // Individual question explanation
  const getAIExplanation = async (questionId: string) => {
    setLoadingExplanations((prev) => ({ ...prev, [questionId]: true }));
    const user = await supabase.auth.getUser();
    if (!user.data.user?.id) {
      console.error('User not authenticated');
      setLoadingExplanations((prev) => ({ ...prev, [questionId]: false }));
      return;
    }

    const questionFeedback = feedback[questionId];
    const question = exam.sections.flatMap(s => s.questions).find((q) => q.id === questionId);
    if (!question || !questionFeedback) {
      setLoadingExplanations((prev) => ({ ...prev, [questionId]: false }));
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('explain-answer', {
        body: {
          questionText: question.text,
          questionType: question.type,
          options: question.options,
          studentAnswer: studentAnswers[questionId],
          correctAnswer: question.correctAnswer,
          grade: exam.grade,
        },
      });

      if (error) {
        console.error('Explanation service error:', error);
        // Show fallback explanation on error
        const fallbackExplanation = generateFallbackExplanation(question, studentAnswers[questionId]);
        setExplanations((prev) => ({
          ...prev,
          [questionId]: fallbackExplanation,
        }));
      } else if (data?.explanation) {
        setExplanations((prev) => ({
          ...prev,
          [questionId]: data.explanation,
        }));
      } else if (data?.warning) {
        // Service returned a fallback with warning
        const fallbackExplanation = data.explanation || generateFallbackExplanation(question, studentAnswers[questionId]);
        setExplanations((prev) => ({
          ...prev,
          [questionId]: `⚠️ ${data.warning}\n\n${fallbackExplanation}`,
        }));
      }
    } catch (err) {
      console.error('Error getting AI explanation:', err);
      // Show fallback explanation on exception
      const fallbackExplanation = generateFallbackExplanation(question, studentAnswers[questionId]);
      setExplanations((prev) => ({
        ...prev,
        [questionId]: fallbackExplanation,
      }));
    }

    setLoadingExplanations((prev) => ({ ...prev, [questionId]: false }));
  };

  // Generate a comprehensive, teacher-like fallback explanation when AI is unavailable
  const generateFallbackExplanation = (question: ExamQuestion, studentAnswer: string): string => {
    const correctAnswer = question.correctAnswer || 'N/A';
    
    if (question.type === 'multiple_choice') {
      return `**Let's work through this together! 🎓**

The correct answer is **${correctAnswer}**, but I can see you selected **${studentAnswer}**. Don't worry - mistakes are how we learn!

**Understanding What Happened:**
When answering multiple choice questions, it's important to carefully read each option and compare them to what the question is asking. Your answer might have seemed right at first, but let's think about why ${correctAnswer} is the better choice.

**How to Approach Similar Questions:**
1. Read the question twice to make sure you understand what's being asked
2. Look at each option carefully before choosing
3. Eliminate options that you know are incorrect
4. Choose the best remaining answer

**Keep Practicing!**
You're building important skills by working through these questions. Each attempt helps you understand the material better. Try reviewing the concepts related to this question and then attempt similar practice questions. You've got this! 💪`;
    } else {
      return `**Let's learn from this together! 🎓**

**Correct Answer:** ${correctAnswer}

**Your Answer:** ${studentAnswer}

**Understanding the Difference:**
Sometimes we make mistakes because we're still building our understanding of the topic. That's completely normal and part of the learning process! The key is to figure out where our thinking needs adjusting.

**Building Your Understanding:**
Take some time to review the concepts related to this question. Look back at your notes or textbook to strengthen your grasp of the material. Try to understand *why* ${correctAnswer} is correct - not just memorize it.

**Strategy for Success:**
Break down complex questions into smaller parts. Make sure you understand what each part is asking before you answer. Practice similar questions to build confidence.

**You're Making Progress!**
Every question you attempt is helping you learn and grow. Keep up the great work, and don't hesitate to ask for help when you need it! 🌟`;
    }
  };

  const getAIExplanations = async () => {
    const wrongAnswers = Object.entries(feedback).filter(([_, f]) => !f.isCorrect);
    
    // Call getAIExplanation for each wrong answer sequentially to avoid overload
    for (const [questionId] of wrongAnswers) {
      if (!explanations[questionId]) {
        await getAIExplanation(questionId);
        // Add a small delay between requests to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    const feedbackResults: Record<string, QuestionFeedback> = {};
    let earnedMarks = 0;

    exam.sections.forEach((section) => {
      section.questions.forEach((question) => {
        const answer = studentAnswers[question.id] || '';
        const result = gradeAnswer(question, answer);
        feedbackResults[question.id] = result;
        earnedMarks += result.marks;
      });
    });

    setFeedback(feedbackResults);
    const finalScore = { earned: earnedMarks, total: exam.totalMarks };
    setScore(finalScore);
    setSubmitted(true);

    // Save progress to database
    await saveProgress(
      studentAnswers,
      finalScore,
      exam.title,
      exam.grade || 'Grade 12',
      exam.subject || 'General'
    );

    // Clear autosave after successful submission and active exam key
    try {
      if (autosaveKey) localStorage.removeItem(autosaveKey);
      if (activeKeyFromMeta) localStorage.removeItem(activeKeyFromMeta);
    } catch {}
    
    setSaving(false);

    // Notify parent
    try { onSubmitted?.(finalScore); } catch {}

    // Scroll to top to see results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderQuestion = (question: ExamQuestion) => {
    const answer = studentAnswers[question.id] || '';
    const questionFeedback = feedback[question.id];
    const isAnswered = answer.trim() !== '';

    return (
      <div
        key={question.id}
        style={{
          padding: isMobile ? 'var(--space-4)' : 'var(--space-5)',
          background: 'var(--card)',
          borderRadius: isMobile ? '0' : 'var(--radius-2)',
          ...(submitted ? {
            borderTop: `2px solid ${questionFeedback?.isCorrect ? 'var(--success)' : 'var(--danger)'}`,
            borderRight: `2px solid ${questionFeedback?.isCorrect ? 'var(--success)' : 'var(--danger)'}`,
            borderBottom: `2px solid ${questionFeedback?.isCorrect ? 'var(--success)' : 'var(--danger)'}`,
            borderLeft: `2px solid ${questionFeedback?.isCorrect ? 'var(--success)' : 'var(--danger)'}`,
          } : {
            borderTop: '1px solid var(--border)',
            borderRight: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            borderLeft: '1px solid var(--border)',
          }),
          marginBottom: isMobile ? '0' : 'var(--space-4)',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Question Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
          <div style={{ flex: 1 }}>
            <p style={{ 
              fontWeight: 600, 
              fontSize: isMobile ? 17 : 16, 
              lineHeight: 1.5, 
              marginBottom: 'var(--space-2)',
              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
            }}>
              <MathText text={question.text} />
            </p>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), rgba(124, 58, 237, 0.85))',
            color: '#fff',
            padding: '5px 10px',
            borderRadius: 'var(--radius-1)',
            fontSize: 13,
            fontWeight: 700,
            marginLeft: 'var(--space-2)',
            letterSpacing: '0.02em',
            boxShadow: '0 2px 4px rgba(124, 58, 237, 0.3)',
          }}>
            [{question.marks} {question.marks === 1 ? 'mark' : 'marks'}]
          </div>
        </div>

        {/* Diagram (if present) */}
        {question.diagram && <ExamDiagram diagram={question.diagram} />}

        {/* Question Input */}
        {question.type === 'multiple_choice' && question.options ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 'var(--space-3)' : 'var(--space-2)' }}>
            {question.options.map((option, idx) => {
              const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D
              // Strip any existing letter prefix (A., A), a., a), etc.)
              const cleanOption = option.replace(/^[a-dA-D][\.\)]\s*/, '');
              const isSelected = answer === optionLetter;
              return (
                <label
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: isMobile ? 'var(--space-4)' : 'var(--space-3)',
                    background: isSelected ? 'rgba(var(--primary-rgb), 0.1)' : 'var(--surface)',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                    borderRadius: isMobile ? 'var(--radius-1)' : 'var(--radius-2)',
                    cursor: submitted ? 'not-allowed' : 'pointer',
                    opacity: submitted ? 0.7 : 1,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!submitted) {
                      e.currentTarget.style.background = isSelected 
                        ? 'rgba(var(--primary-rgb), 0.15)' 
                        : 'var(--surface-1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isSelected 
                      ? 'rgba(var(--primary-rgb), 0.1)' 
                      : 'var(--surface)';
                  }}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={optionLetter}
                    checked={isSelected}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    disabled={submitted}
                    style={{ 
                      marginRight: isMobile ? 'var(--space-3)' : 'var(--space-2)',
                      minWidth: isMobile ? '18px' : '16px',
                      minHeight: isMobile ? '18px' : '16px',
                      marginTop: '2px',
                      flexShrink: 0
                    }}
                  />
                  <span style={{ 
                    fontSize: isMobile ? 15 : 16, 
                    lineHeight: isMobile ? 1.6 : 1.5,
                    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                    flex: 1
                  }}>
                    <strong>{optionLetter}.</strong> <MathText text={cleanOption} />
                  </span>
                </label>
              );
            })}
          </div>
        ) : question.type === 'essay' ? (
          <textarea
            value={answer}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            disabled={submitted}
            placeholder="Write your answer here..."
            rows={isMobile ? 8 : 6}
            style={{
              width: '100%',
              padding: isMobile ? 'var(--space-4)' : 'var(--space-3)',
              borderRadius: 'var(--radius-2)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: isMobile ? 16 : 15,
              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              lineHeight: 1.6,
              resize: 'vertical',
              minHeight: isMobile ? 150 : 120,
            }}
          />
        ) : (
          <input
            type="text"
            inputMode={question.type === 'numeric' ? 'text' : 'text'}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={answer}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            disabled={submitted}
            placeholder={question.type === 'numeric' ? 'Enter your answer (e.g., 3/6 or 0.5)' : 'Enter your answer...'}
            style={{
              width: '100%',
              padding: isMobile ? '14px 16px' : '12px 14px',
              minHeight: isMobile ? 48 : 44,
              borderRadius: 'var(--radius-2)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: isMobile ? 16 : 15,
              lineHeight: 1.5,
              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            }}
          />
        )}

        {/* Feedback */}
        {submitted && questionFeedback && (
          <>
            <div
              style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-3)',
                background: questionFeedback.isCorrect
                  ? 'rgba(52, 199, 89, 0.1)'
                  : 'rgba(255, 59, 48, 0.1)',
                borderRadius: 'var(--radius-2)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-2)',
              }}
            >
              {questionFeedback.isCorrect ? (
                <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
              ) : (
                <XCircle className="w-5 h-5" style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, margin: 0, lineHeight: 1.5 }}>{questionFeedback.feedback}</p>
                <p className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 0 }}>
                  Marks awarded: {questionFeedback.marks}/{question.marks}
                </p>
                
                {/* Individual Explain Button for Wrong Answers */}
                {!questionFeedback.isCorrect && !explanations[question.id] && (
                  <button
                    className="btn"
                    onClick={() => getAIExplanation(question.id)}
                    disabled={loadingExplanations[question.id]}
                    style={{
                      marginTop: 'var(--space-2)',
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: 'linear-gradient(135deg, var(--primary), rgba(124, 58, 237, 0.8))',
                      color: '#fff',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                    {loadingExplanations[question.id] ? 'Loading...' : 'Explain Answer'}
                  </button>
                )}
              </div>
            </div>
            
            {/* AI Explanation (if available) */}
            {explanations[question.id] && (
              <div style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.05), rgba(124, 58, 237, 0.1))',
                borderRadius: 'var(--radius-2)',
                borderLeft: '3px solid var(--primary)',
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.1)'
              }}>
                <div style={{ 
                  fontWeight: 600, 
                  marginBottom: 'var(--space-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--primary)'
                }}>
                  <Bot className="icon20" />
                  <span style={{ fontSize: 15 }}>?? Dash AI Explanation</span>
                </div>
                <div className="markdown-content" style={{ fontSize: 14, lineHeight: 1.6 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {explanations[question.id]}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const answeredCount = Object.values(studentAnswers).filter(a => a.trim() !== '').length;
  const totalQuestions = exam.sections.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <div style={{ 
      maxWidth: isMobile ? '100vw' : 900, 
      margin: '0 auto', 
      padding: '0',
      width: '100%',
      minHeight: '100vh',
      background: isMobile ? 'var(--bg)' : 'transparent',
    }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? 'var(--space-4)' : 'var(--space-5)',
        background: 'var(--card)',
        borderRadius: isMobile ? '0' : 'var(--radius-2)',
        marginBottom: isMobile ? '0' : 'var(--space-4)',
        marginLeft: isMobile ? '0' : 'var(--space-4)',
        marginRight: isMobile ? '0' : 'var(--space-4)',
        borderBottom: isMobile ? '1px solid var(--border)' : undefined,
        position: 'relative',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      }}>
        {/* Close button for mobile-friendly exit */}
        {onClose && (
          <button 
            className="close-button" 
            onClick={onClose}
            aria-label="Close exam and return to chat"
            title="Close exam and return to chat"
            style={{
              position: 'absolute',
              top: isMobile ? 'var(--space-4)' : 'var(--space-5)',
              right: isMobile ? 'var(--space-4)' : 'var(--space-5)',
              zIndex: 10,
            }}
          >
            <X size={isMobile ? 24 : 20} strokeWidth={2.5} />
          </button>
        )}
        
        {/* Title */}
        <h1 style={{ 
          fontSize: isMobile ? 20 : 26, 
          fontWeight: 700, 
          marginBottom: isMobile ? 'var(--space-3)' : 'var(--space-4)', 
          paddingRight: isMobile ? '40px' : '0',
          letterSpacing: '-0.02em',
          lineHeight: 1.3
        }}>
          {exam.title}
        </h1>
        
        {/* Actions: Export / Save */}
        <div style={{ 
          display: 'flex', 
          gap: 'var(--space-2)',
          flexDirection: isMobile ? 'column' : 'row',
          width: isMobile ? '100%' : 'auto'
        }}>
            <button
              className="btn"
              onClick={() => {
                try {
                  // Print-friendly export
                  const printWindow = window.open('', '_blank');
                  if (!printWindow) return;
                  const html = `<!doctype html><html><head><title>${exam.title}</title>
                    <style>
                      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding:24px; color:#111}
                      h1,h2{margin:0 0 12px 0}
                      .q{margin:12px 0; padding:12px; border:1px solid #ddd; border-radius:8px}
                      .marks{font-size:12px;color:#666}
                    </style>
                  </head><body>
                    <h1>${exam.title}</h1>
                    ${exam.sections.map(s => `
                      <h2>${s.title}</h2>
                      ${s.questions.map(q => `<div class='q'><div>${q.text}</div><div class='marks'>[${q.marks} ${q.marks===1?'mark':'marks'}]</div></div>`).join('')}
                    `).join('')}
                  </body></html>`;
                  printWindow.document.write(html);
                  printWindow.document.close();
                  printWindow.focus();
                  printWindow.print();
                } catch (e) {
                  console.error('Print failed', e);
                }
              }}
              style={{
                width: isMobile ? '100%' : 'auto',
                justifyContent: isMobile ? 'center' : 'flex-start'
              }}
            >
              <Printer className="icon16" />
              {isMobile ? 'Export PDF' : 'Export PDF'}
            </button>
            <button
              className="btn btnSecondary"
              onClick={async () => {
                try {
                  const supabase = createClient();
                  if (!generationId) return;
                  await supabase
                    .from('exam_generations')
                    .update({ downloaded_at: new Date().toISOString() })
                    .eq('id', generationId);
                  alert('Saved to your exam history.');
                } catch (e) {
                  console.error('Save failed', e);
                }
              }}
              style={{
                width: isMobile ? '100%' : 'auto',
                justifyContent: isMobile ? 'center' : 'flex-start'
              }}
            >
              <SaveIcon className="icon16" />
              {isMobile ? 'Save Exam' : 'Save Exam'}
            </button>
          </div>

        {/* Score Display (if submitted) */}
        {submitted && score && (
          <div style={{
            padding: 'var(--space-4)',
            margin: isMobile ? 'var(--space-3) 0' : 'var(--space-3) 0',
            background: score.earned / score.total >= 0.5
              ? 'linear-gradient(135deg, rgba(52, 199, 89, 0.1) 0%, rgba(52, 199, 89, 0.2) 100%)'
              : 'linear-gradient(135deg, rgba(255, 149, 0, 0.1) 0%, rgba(255, 149, 0, 0.2) 100%)',
            borderRadius: isMobile ? '0' : 'var(--radius-2)',
            border: '2px solid',
            borderColor: score.earned / score.total >= 0.5 ? 'var(--success)' : 'var(--warning)',
            borderLeft: isMobile ? 'none' : '2px solid',
            borderRight: isMobile ? 'none' : '2px solid',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 'var(--space-2)', letterSpacing: '-0.02em' }}>
              {score.earned}/{score.total}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {Math.round((score.earned / score.total) * 100)}% Score
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 'var(--space-2)', marginBottom: 0 }}>
              {score.earned / score.total >= 0.8 ? '?? Outstanding!' :
               score.earned / score.total >= 0.7 ? '? Well done!' :
               score.earned / score.total >= 0.5 ? '?? Good effort!' :
               '?? Keep practicing!'}
            </p>
          </div>
        )}

        {/* Instructions */}
        {exam.instructions && Array.isArray(exam.instructions) && exam.instructions.length > 0 && !submitted && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text)' }}>
              Instructions:
            </h3>
            <ul style={{ paddingLeft: 'var(--space-4)', margin: 0 }}>
              {exam.instructions.map((instruction, idx) => (
                <li key={idx} style={{ fontSize: 14, marginBottom: 'var(--space-1)', lineHeight: 1.6 }}>
                  {instruction}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Progress Indicator */}
        {!submitted && (
          <div style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}>
            <AlertCircle className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 14 }}>
              Answered: {answeredCount}/{totalQuestions} questions
            </span>
          </div>
        )}
      </div>

      {/* Sections */}
      {exam.sections && Array.isArray(exam.sections) && exam.sections.map((section, sectionIdx) => (
        <div 
          key={sectionIdx} 
          style={{ 
            marginBottom: isMobile ? '0' : 'var(--space-4)',
            marginLeft: isMobile ? '0' : 'var(--space-4)',
            marginRight: isMobile ? '0' : 'var(--space-4)',
            paddingBottom: (sectionIdx === exam.sections.length - 1 && !submitted) ? '140px' : '0'
          }}
        >
          <h2 style={{
            fontSize: isMobile ? 17 : 18,
            fontWeight: 700,
            marginBottom: isMobile ? '0' : 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--primary)',
            color: '#fff',
            borderRadius: isMobile ? '0' : 'var(--radius-2)',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase'
          }}>
            {section.title}
          </h2>
          {section.questions && Array.isArray(section.questions) && section.questions.map(renderQuestion)}
        </div>
      ))}

      {/* Submit Button */}
      {!submitted && (
        <div style={{ 
          position: 'fixed',
          bottom: 0, 
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100vw',
          margin: '0',
          padding: 'var(--space-4)', 
          background: 'var(--bg)', 
          borderTop: '1px solid var(--border)', 
          zIndex: 1000,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <button
            className="btn btnPrimary"
            onClick={handleSubmit}
            disabled={answeredCount === 0 || saving}
            style={{ 
              width: '100%', 
              fontSize: isMobile ? 18 : 16, 
              padding: isMobile ? 'var(--space-4) var(--space-3)' : 'var(--space-4)',
              fontWeight: 600
            }}
          >
            <FileCheck className="icon16" />
            {saving ? 'Submitting...' : `Submit Exam (${answeredCount}/${totalQuestions} answered)`}
          </button>
          {answeredCount === 0 && (
            <p className="muted text-center" style={{ fontSize: 12, marginTop: 'var(--space-2)', marginBottom: 0 }}>
              Please answer at least one question before submitting
            </p>
          )}
          </div>
        </div>
      )}
      
      {/* AI Explanations Button */}
      {submitted && Object.values(feedback).some(f => !f.isCorrect) && (
        <div style={{ 
          marginTop: 'var(--space-4)', 
          padding: 'var(--space-4)',
          background: 'linear-gradient(135deg, var(--surface), var(--surface-2))',
          borderRadius: 'var(--radius-2)',
          border: '1px solid var(--border)',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Sparkles style={{ width: 32, height: 32, color: 'var(--primary)', margin: '0 auto' }} />
          </div>
          <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 'var(--space-2)', letterSpacing: '-0.01em' }}>
            Need help understanding your mistakes?
          </h3>
          <p className="muted" style={{ fontSize: 14, marginBottom: 'var(--space-4)' }}>
            Dash AI can provide detailed step-by-step explanations for each question you got wrong, helping you learn from your mistakes.
          </p>
          <button 
            className="btn btnPrimary"
            onClick={getAIExplanations}
            disabled={Object.values(loadingExplanations).some(loading => loading) || Object.keys(explanations).length > 0}
            style={{ 
              fontSize: 16, 
              padding: 'var(--space-3) var(--space-6)',
              minWidth: 280
            }}
          >
            <Bot className="icon20" />
            {Object.values(loadingExplanations).some(loading => loading)
              ? 'Getting Explanations...' 
              : Object.keys(explanations).length > 0
              ? '✓ Explanations Loaded'
              : '🤖 Get AI Explanations'}
          </button>
          {Object.keys(explanations).length > 0 && (
            <p className="muted" style={{ fontSize: 12, marginTop: 'var(--space-2)', marginBottom: 0 }}>
              ? Scroll up to see explanations for each incorrect answer
            </p>
          )}
        </div>
      )}

      {/* Close Button (after submission) */}
      {submitted && onClose && (
        <div style={{ marginTop: 'var(--space-4)', textAlign: 'center' }}>
          <button
            className="btn btnSecondary"
            onClick={onClose}
            style={{ padding: 'var(--space-3) var(--space-6)' }}
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
