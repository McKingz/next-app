'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { useParentDashboardData } from '@/lib/hooks/useParentDashboardData';
import { ExamInteractiveView } from '@/components/dashboard/exam-prep/ExamInteractiveView';
import { createClient } from '@/lib/supabase/client';
import { Loader2, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';

/**
 * Generate Exam Page - Simplified Version
 * 
 * Uses new generate-exam edge function for all generation logic.
 * Frontend is just UI state management (~150 lines vs 700 lines before).
 */

type GenerateStatus = 'loading' | 'success' | 'error';

function GenerateExamContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    userId,
    profile,
    unreadCount,
    loading: dashboardLoading,
    hasOrganization,
  } = useParentDashboardData();
  
  // Simple state: loading → success/error
  const [status, setStatus] = useState<GenerateStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<any>(null);
  const [examId, setExamId] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('Initializing...');
  const hasStartedRef = useRef(false);
  
  // Get params from URL
  const grade = searchParams.get('grade');
  const subject = searchParams.get('subject');
  const examType = searchParams.get('type');
  const customPrompt = searchParams.get('prompt');
  
  // Check for existing exam in URL
  const existingExamId = searchParams.get('genId');

  // Key to persist active exam
  const activeKey = typeof window !== 'undefined' && grade && subject && examType
    ? `ACTIVE_EXAM_${grade}_${subject}_${examType}`
    : null;
  
  useEffect(() => {
    if (!grade || !subject || !examType) {
      setError('Missing exam parameters. Please go back and try again.');
      setStatus('error');
      return;
    }
    
    if (!userId || dashboardLoading || hasStartedRef.current) {
      return;
    }
    
    hasStartedRef.current = true;
    
    // Try to load existing exam first
    if (existingExamId || activeKey) {
      loadExistingExam(existingExamId || localStorage.getItem(activeKey));
    } else {
      generateNewExam();
    }
  }, [grade, subject, examType, userId, dashboardLoading]);
  
  /**
   * Load existing exam from database
   */
  const loadExistingExam = async (examIdToLoad: string | null) => {
    if (!examIdToLoad) {
      generateNewExam();
      return;
    }
    
    try {
      setProgress('Loading your existing exam...');
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('exam_generations')
        .select('*')
        .eq('id', examIdToLoad)
        .single();
      
      if (error || !data) {
        console.warn('[GenerateExam] Could not load existing exam:', error);
        generateNewExam();
        return;
      }
      
      const parsedExam = JSON.parse(data.generated_content);
      setExam(parsedExam);
      setExamId(examIdToLoad);
      setStatus('success');
      setProgress('Ready!');
    } catch (err) {
      console.error('[GenerateExam] Load error:', err);
      generateNewExam();
    }
  };
  
  /**
   * Generate new exam using edge function
   * THIS IS THE ONLY GENERATION LOGIC - Super simple!
   */
  const generateNewExam = async () => {
    setStatus('loading');
    setError(null);
    setProgress('Preparing your exam...');
    
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      setProgress('Asking Dash AI to generate your exam...');
      
      // Call the new generate-exam edge function
      // All validation, retries, and saving happens server-side!
      console.log('[GenerateExam] Calling generate-exam edge function...');
      const { data, error: invokeError } = await supabase.functions.invoke('generate-exam', {
        body: {
          grade,
          subject,
          examType,
          customPrompt
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (invokeError) {
        console.error('[GenerateExam] Edge function error:', invokeError);
        throw new Error(invokeError.message || 'Failed to generate exam');
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate exam');
      }
      
      console.log('[GenerateExam] ✅ Exam generated successfully:', data.examId);
      
      // Set state - that's it!
      setExam(data.exam);
      setExamId(data.examId);
      setStatus('success');
      setProgress('Ready!');
      
      // Persist exam ID
      if (activeKey) {
        try {
          localStorage.setItem(activeKey, data.examId);
        } catch (e) {
          console.warn('[GenerateExam] Could not save to localStorage:', e);
        }
      }
      
    } catch (err: any) {
      console.error('[GenerateExam] Error:', err);
      
      // User-friendly error messages
      let errorMessage = err.message || 'Failed to generate exam. Please try again.';
      
      if (errorMessage.toLowerCase().includes('429') || errorMessage.toLowerCase().includes('rate limit')) {
        errorMessage = 'The AI service is experiencing high demand right now. Please wait 2-3 minutes and try again.';
      } else if (errorMessage.toLowerCase().includes('timeout')) {
        errorMessage = 'The request took too long. Please try again with simpler requirements.';
      }
      
      setError(errorMessage);
      setStatus('error');
      setProgress('');
    }
  };
  
  const handleClose = () => {
    router.push('/dashboard/parent');
  };
  
  const handleRetry = () => {
    hasStartedRef.current = false;
    generateNewExam();
  };
  
  // Dashboard loading
  if (dashboardLoading || !userId) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <Loader2 className="icon32" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }
  
  return (
    <ParentShell
      userEmail={profile?.email}
      userName={profile?.firstName || 'User'}
      preschoolName={profile?.preschoolName}
      unreadCount={unreadCount}
      hasOrganization={hasOrganization}
    >
      <div style={{ padding: 'var(--space-4)' }}>
        {/* Loading State */}
        {status === 'loading' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: '1.5rem'
          }}>
            <div style={{
              position: 'relative',
              width: '80px',
              height: '80px'
            }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                animation: 'spin 2s linear infinite'
              }}>
                <Loader2 
                  className="icon32" 
                  style={{ color: 'var(--primary)' }} 
                />
              </div>
              <Sparkles 
                className="icon32" 
                style={{ 
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: 'var(--primary)',
                  animation: 'pulse 2s ease-in-out infinite'
                }} 
              />
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ 
                fontSize: '24px', 
                fontWeight: 700, 
                marginBottom: 'var(--space-2)',
                color: 'var(--text)'
              }}>
                Generating Your Exam
              </h1>
              <p style={{ 
                fontSize: '15px',
                color: 'var(--muted)', 
                marginBottom: 'var(--space-4)',
                maxWidth: '500px'
              }}>
                Dash AI is creating a {grade?.replace('grade_', 'Grade ').replace('_', ' ')} {subject} exam for you.
                <br />
                This may take a minute or two.
              </p>
            </div>
            
            <div style={{
              padding: '1rem 2rem',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--primary)',
                animation: 'pulseOpacity 1.5s ease-in-out infinite'
              }} />
              <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
                {progress}
              </span>
            </div>
            
            <button 
              onClick={handleClose}
              className="btn"
              style={{ marginTop: 'var(--space-4)' }}
            >
              <ArrowLeft className="icon16" />
              Cancel
            </button>
          </div>
        )}
        
        {/* Error State */}
        {status === 'error' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '2rem',
            minHeight: '60vh',
            justifyContent: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(var(--danger-rgb), 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertCircle className="icon32" style={{ color: 'var(--danger)' }} />
            </div>
            
            <div style={{ textAlign: 'center', maxWidth: '500px' }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: 600, 
                marginBottom: 'var(--space-2)' 
              }}>
                Generation Failed
              </h2>
              <p style={{ 
                color: 'var(--muted)', 
                fontSize: '15px',
                marginBottom: 'var(--space-4)'
              }}>
                {error}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={handleClose} className="btn">
                <ArrowLeft className="icon16" />
                Go Back
              </button>
              <button 
                onClick={handleRetry}
                className="btn btnPrimary"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
        
        {/* Success State - Show Exam */}
        {status === 'success' && exam && (
          <ExamInteractiveView
            exam={exam}
            generationId={examId}
            onClose={handleClose}
            onSubmitted={() => {
              if (activeKey) {
                try {
                  localStorage.removeItem(activeKey);
                } catch (e) {
                  console.warn('[GenerateExam] Could not clear localStorage:', e);
                }
              }
            }}
          />
        )}
      </div>
    </ParentShell>
  );
}

export default function GenerateExamPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <Loader2 className="icon32" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <GenerateExamContent />
    </Suspense>
  );
}
