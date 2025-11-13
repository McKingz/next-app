'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ExamInteractiveView } from '@/components/dashboard/exam-prep/ExamInteractiveView';
import { parseExamMarkdown } from '@/lib/examParser';
import { FileText, Download, TrendingUp, Trophy, ChevronLeft, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { useParentDashboardData } from '@/lib/hooks/useParentDashboardData';

interface SavedExam {
  id: string;
  display_title: string;
  grade: string;
  subject: string;
  generated_content: string;
  created_at: string;
  exam_type: string;
  progress?: {
    percentage: number;
    score_obtained: number;
    score_total: number;
    completed_at: string;
  }[];
}

export default function MyExamsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [exams, setExams] = useState<SavedExam[]>([]);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalExams: 0,
    averageScore: 0,
    bestScore: 0
  });
  
  // Get parent dashboard data for shell
  const { userName, preschoolName, hasOrganization, tenantSlug } = useParentDashboardData();
  
  useEffect(() => {
    fetchMyExams();
  }, []);
  
  const fetchMyExams = async () => {
    setLoading(true);
    try {
      // Fetch exam generations with progress
      const { data: examsData, error } = await supabase
        .from('exam_generations')
        .select(`
          *,
          progress:exam_user_progress(
            percentage,
            score_obtained,
            score_total,
            completed_at
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[MyExams] Error:', error);
      } else {
        setExams(examsData || []);
        
        // Calculate stats
        const completedExams = (examsData || []).filter(e => e.progress && e.progress.length > 0);
        const scores = completedExams.map(e => e.progress[0].percentage);
        
        setStats({
          totalExams: completedExams.length,
          averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
          bestScore: scores.length > 0 ? Math.max(...scores) : 0
        });
      }
    } catch (err) {
      console.error('[MyExams] Exception:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenExam = (exam: SavedExam) => {
    try {
      const parsedExam = parseExamMarkdown(exam.generated_content);
      if (parsedExam) {
        setSelectedExam({
          ...parsedExam,
          generationId: exam.id,
          grade: exam.grade,
          subject: exam.subject
        });
      } else {
        alert('Failed to load exam. Invalid format.');
      }
    } catch (err) {
      console.error('[MyExams] Parse error:', err);
      alert('Failed to load exam content.');
    }
  };
  
  if (selectedExam) {
    return (
      <ExamInteractiveView
        exam={selectedExam}
        generationId={selectedExam.generationId}
        onClose={() => {
          setSelectedExam(null);
          fetchMyExams(); // Refresh to show new scores
        }}
      />
    );
  }
  
  return (
    <ParentShell
      tenantSlug={tenantSlug}
      userName={userName}
      preschoolName={preschoolName}
      hasOrganization={hasOrganization}
    >
      <div className="container" style={{ maxWidth: 900 }}>
        {/* Header */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <button
            onClick={() => router.push('/dashboard/parent')}
            className="btn"
            style={{ marginBottom: 'var(--space-3)' }}
          >
            <ChevronLeft className="icon16" />
            Back to Dashboard
          </button>
          
          <h1 className="h1">📚 My Practice Exams</h1>
          <p style={{ fontSize: 15, color: 'var(--muted)' }}>
            View and retake your AI-generated practice tests
          </p>
        </div>
        
        {/* Stats Cards */}
        {stats.totalExams > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)'
          }}>
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 32, marginBottom: 'var(--space-2)' }}>📝</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>
                {stats.totalExams}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Exams Completed
              </div>
            </div>
            
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 32, marginBottom: 'var(--space-2)' }}>📝</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>
                {stats.averageScore.toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Average Score
              </div>
            </div>
            
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
              <div style={{ fontSize: 32, marginBottom: 'var(--space-2)' }}>📝</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4 }}>
                {stats.bestScore.toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Best Score
              </div>
            </div>
          </div>
        )}
        
        {/* Exams List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--muted)' }}>
            Loading your exams...
          </div>
        ) : exams.length === 0 ? (
          <div 
            className="card" 
            style={{ 
              textAlign: 'center', 
              padding: 'var(--space-6)',
              background: 'var(--surface)'
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 'var(--space-3)' }}>📝</div>
            <h3 style={{ fontSize: 18, marginBottom: 'var(--space-2)' }}>
              No Practice Exams Yet
            </h3>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 'var(--space-4)' }}>
              Generate your first practice exam using Dash AI
            </div>
            <button
              onClick={() => router.push('/dashboard/parent')}
              className="btn btnPrimary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              🏠 Go to Dashboard
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {exams.map(exam => {
              const hasProgress = exam.progress && exam.progress.length > 0;
              const latestProgress = hasProgress ? exam.progress[0] : null;
              
              return (
                <div key={exam.id} className="card">
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 'var(--space-2)'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                          {exam.display_title}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                          {exam.grade.replace('grade_', 'Grade ')} • {exam.subject}
                        </div>
                      </div>
                      
                      <div style={{ 
                        fontSize: 11,
                        padding: '4px 8px',
                        background: 'rgba(var(--primary-rgb), 0.1)',
                        color: 'var(--primary)',
                        borderRadius: 'var(--radius-1)',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        🕐 {formatDistanceToNow(new Date(exam.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  
                  {/* Show score if completed */}
                  {latestProgress && (
                    <div style={{
                      padding: 'var(--space-3)',
                      background: latestProgress.percentage >= 70 
                        ? 'rgba(52, 199, 89, 0.1)' 
                        : latestProgress.percentage >= 50
                        ? 'rgba(255, 149, 0, 0.1)'
                        : 'rgba(255, 59, 48, 0.1)',
                      borderRadius: 'var(--radius-2)',
                      marginBottom: 'var(--space-3)',
                      border: '1px solid',
                      borderColor: latestProgress.percentage >= 70 
                        ? 'var(--success)' 
                        : latestProgress.percentage >= 50
                        ? 'var(--warning)'
                        : 'var(--danger)'
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>
                        {latestProgress.percentage.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                        📊 Score: {latestProgress.score_obtained}/{latestProgress.score_total} marks
                        {' • '}
                        🕐 {formatDistanceToNow(new Date(latestProgress.completed_at), { addSuffix: true })}
                      </div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button 
                      className="btn btnPrimary"
                      onClick={() => handleOpenExam(exam)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      {hasProgress ? '📊 Review Exam' : '📝 Take Exam'}
                    </button>
                    
                    {hasProgress && (
                      <button 
                        className="btn"
                        onClick={() => handleOpenExam(exam)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        🔄 Retake
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ParentShell>
  );
}
