'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { FileText, Download, Calendar, CheckCircle, XCircle, Trash2, AlertCircle } from 'lucide-react';

interface ProgressReport {
  id: string;
  student_id: string;
  teacher_id: string;
  report_period: string;
  report_type: string;
  overall_comments: string;
  teacher_comments: string;
  strengths: string;
  areas_for_improvement: string;
  subjects_performance: any;
  overall_grade: string;
  approval_status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  reviewed_at?: string;
  principal_notes?: string;
  students?: {
    first_name: string;
    last_name: string;
  };
  teacher?: {
    first_name: string;
    last_name: string;
  };
}

export default function ReportsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [pendingReports, setPendingReports] = useState<ProgressReport[]>([]);
  const [reviewedReports, setReviewedReports] = useState<ProgressReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'draft' | 'pending_review' | 'approved' | 'rejected'>('all');

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolName = profile?.preschoolName;
  const preschoolId = profile?.preschoolId;

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
      setLoading(false);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!preschoolId) return;

    const loadAllReports = async () => {
      setLoadingReports(true);
      try {
        // Load pending reports
        const { data: pending, error: pendingError } = await supabase
          .from('progress_reports')
          .select(`
            *,
            students (first_name, last_name),
            teacher:users!progress_reports_teacher_id_fkey (first_name, last_name)
          `)
          .eq('preschool_id', preschoolId)
          .eq('approval_status', 'pending_review')
          .order('created_at', { ascending: false });

        if (pendingError) {
          console.error('Error loading pending reports:', pendingError);
        } else {
          setPendingReports(pending || []);
        }

        // Debug: Check what reports exist with student names
        const { data: allReports, error: allError } = await supabase
          .from('progress_reports')
          .select(`
            id, 
            approval_status, 
            report_period, 
            student_id,
            students (first_name, last_name)
          `)
          .eq('preschool_id', preschoolId);
        
        console.log('[DEBUG] All reports in DB:', JSON.stringify(allReports, null, 2));
        console.log('[DEBUG] Preschool ID:', preschoolId);
        
        if (allReports && allReports.length > 0) {
          allReports.forEach((r: any) => {
            const studentName = r.students ? `${r.students.first_name} ${r.students.last_name}` : 'Unknown';
            console.log(`[DEBUG] Report ${r.id}: status='${r.approval_status}', student='${studentName}'`);
          });
        }

        // Load ALL reports (including draft, pending, approved, rejected)
        const { data: reviewed, error: reviewedError } = await supabase
          .from('progress_reports')
          .select(`
            *,
            students (first_name, last_name),
            teacher:users!progress_reports_teacher_id_fkey (first_name, last_name)
          `)
          .eq('preschool_id', preschoolId)
          .order('created_at', { ascending: false });

        if (reviewedError) {
          console.error('[ERROR] Loading reports:', reviewedError);
        } else {
          console.log('[SUCCESS] Loaded all reports:', reviewed);
          setReviewedReports(reviewed || []);
        }
      } catch (err) {
        console.error('Error loading reports:', err);
      } finally {
        setLoadingReports(false);
      }
    };

    loadAllReports();
  }, [preschoolId, supabase]);

  const handleProgressReportAction = async (reportId: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const { error } = await supabase
        .from('progress_reports')
        .update({ 
          approval_status: newStatus,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          principal_notes: notes || null,
        })
        .eq('id', reportId);

      if (error) {
        console.error('Error updating progress report:', error);
        return;
      }

      // Move from pending to reviewed
      const report = pendingReports.find(r => r.id === reportId);
      if (report) {
        setPendingReports(prev => prev.filter(r => r.id !== reportId));
        setReviewedReports(prev => [{ ...report, approval_status: newStatus as any, reviewed_at: new Date().toISOString(), principal_notes: notes }, ...prev]);
      }
    } catch (err) {
      console.error('Error handling progress report action:', err);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('progress_reports')
        .delete()
        .eq('id', reportId);

      if (error) {
        console.error('Error deleting report:', error);
        return;
      }

      setReviewedReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err) {
      console.error('Error deleting report:', err);
    }
  };

  const filteredReviewedReports = selectedTab === 'all' 
    ? reviewedReports 
    : reviewedReports.filter(r => r.approval_status === selectedTab);

  const reportTypes = [
    { id: 'attendance', name: 'Attendance Report', description: 'Student and staff attendance tracking', icon: Calendar },
    { id: 'financial', name: 'Financial Summary', description: 'Revenue, expenses, and payments', icon: FileText },
    { id: 'enrollment', name: 'Enrollment Report', description: 'Student enrollment trends', icon: FileText },
    { id: 'academic', name: 'Academic Performance', description: 'Student progress and assessments', icon: FileText },
  ];

  if (loading) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={profile?.preschoolId}>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading reports...</p>
        </div>
      </PrincipalShell>
    );
  }

  const renderReportCard = (report: ProgressReport, showActions: boolean = true) => {
    const studentName = report.students 
      ? `${report.students.first_name} ${report.students.last_name}` 
      : 'Unknown Student';
    const teacherName = report.teacher 
      ? `${report.teacher.first_name} ${report.teacher.last_name}` 
      : 'Unknown Teacher';

    const statusColor = report.approval_status === 'approved' ? '#10b981' : report.approval_status === 'rejected' ? '#ef4444' : '#667eea';

    return (
      <div key={report.id} className="card" style={{ borderLeft: `4px solid ${statusColor}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FileText size={18} color={statusColor} />
              <span style={{ 
                fontSize: 12, 
                fontWeight: 600, 
                color: statusColor,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {report.report_type} Report
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>•</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {report.report_period}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>•</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
                {report.approval_status.replace('_', ' ')}
              </span>
            </div>
            
            <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 700 }}>
              {studentName}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 12 }}>
              Submitted by <strong>{teacherName}</strong>
            </p>
            
            {report.overall_grade && (
              <div style={{ 
                display: 'inline-block',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                color: 'white',
                padding: '4px 12px', 
                borderRadius: 8, 
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 12
              }}>
                Overall Grade: {report.overall_grade}
              </div>
            )}
            
            {report.teacher_comments && (
              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 14 }}>Teacher Comments:</strong>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  {report.teacher_comments.substring(0, 150)}
                  {report.teacher_comments.length > 150 && '...'}
                </p>
              </div>
            )}

            {report.principal_notes && (
              <div style={{ 
                marginTop: 12,
                padding: 12,
                background: 'var(--card-hover)',
                borderRadius: 8,
                fontSize: 13
              }}>
                <strong>Principal Notes:</strong>
                <p style={{ marginTop: 4, color: 'var(--muted)' }}>
                  {report.principal_notes}
                </p>
              </div>
            )}
            
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
              {report.approval_status === 'approved' || report.approval_status === 'rejected' ? 'Reviewed' : 'Submitted'} on {new Date(report.reviewed_at || report.created_at).toLocaleDateString()}
            </div>
          
          {/* Action buttons at bottom */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
            <button 
              className="btn btnSecondary"
              onClick={() => window.open(`/dashboard/principal/reports/${report.id}`, '_blank')}
              style={{ flex: '1 1 auto' }}
            >
              <FileText size={16} style={{ marginRight: 6 }} />
              View Full Report
            </button>
            
            {showActions && (report.approval_status === 'draft' || report.approval_status === 'pending_review') && (
              <>
                <button 
                  className="btn btnPrimary"
                  onClick={() => handleProgressReportAction(report.id, 'approve')}
                  style={{ flex: '1 1 auto', background: '#10b981' }}
                >
                  <CheckCircle size={16} style={{ marginRight: 6 }} />
                  Approve & Send
                </button>
                <button 
                  className="btn"
                  onClick={() => {
                    const reason = prompt('Reason for rejection (optional):');
                    handleProgressReportAction(report.id, 'reject', reason || undefined);
                  }}
                  style={{ flex: '1 1 auto', background: '#ef4444', color: 'white', border: 'none' }}
                >
                  <XCircle size={16} style={{ marginRight: 6 }} />
                  Reject
                </button>
              </>
            )}
          </div>
          
          {showActions && (report.approval_status === 'approved' || report.approval_status === 'rejected') && (
            <div style={{ display: 'flex', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button 
                className="btn btnSecondary"
                onClick={() => handleDeleteReport(report.id)}
                style={{ width: '100%', color: '#ef4444' }}
              >
                <Trash2 size={16} style={{ marginRight: 6 }} />
                Delete Report
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={profile?.preschoolId}>
      <div className="section">
        <h1 className="h1">Reports</h1>

        {/* Pending Reports Section - Only show if there are pending reports */}
        {pendingReports.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div className="sectionTitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={20} color="#f59e0b" />
              Pending Review
              <span style={{ 
                background: '#f59e0b', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: 12, 
                fontSize: 12, 
                fontWeight: 600 
              }}>
                {pendingReports.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingReports.map(report => renderReportCard(report, true))}
            </div>
          </div>
        )}

        {/* Reviewed Reports Section - Always visible */}
        <div style={{ marginBottom: 32 }}>
          <div className="sectionTitle">Reviewed Reports</div>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              className={selectedTab === 'all' ? 'btn btnPrimary' : 'btn btnSecondary'}
              onClick={() => setSelectedTab('all')}
            >
              <FileText size={16} style={{ marginRight: 6 }} />
              All ({reviewedReports.length})
            </button>
            <button
              className={selectedTab === 'draft' ? 'btn btnPrimary' : 'btn btnSecondary'}
              onClick={() => setSelectedTab('draft')}
            >
              Draft ({reviewedReports.filter(r => r.approval_status === 'draft').length})
            </button>
            <button
              className={selectedTab === 'pending_review' ? 'btn btnPrimary' : 'btn btnSecondary'}
              onClick={() => setSelectedTab('pending_review')}
            >
              <AlertCircle size={16} style={{ marginRight: 6 }} />
              Pending ({reviewedReports.filter(r => r.approval_status === 'pending_review').length})
            </button>
            <button
              className={selectedTab === 'approved' ? 'btn btnPrimary' : 'btn btnSecondary'}
              onClick={() => setSelectedTab('approved')}
            >
              <CheckCircle size={16} style={{ marginRight: 6 }} />
              Approved ({reviewedReports.filter(r => r.approval_status === 'approved').length})
            </button>
            <button
              className={selectedTab === 'rejected' ? 'btn btnPrimary' : 'btn btnSecondary'}
              onClick={() => setSelectedTab('rejected')}
              style={{ background: selectedTab === 'rejected' ? '#ef4444' : undefined }}
            >
              <XCircle size={16} style={{ marginRight: 6 }} />
              Rejected ({reviewedReports.filter(r => r.approval_status === 'rejected').length})
            </button>
          </div>

          {filteredReviewedReports.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <FileText size={48} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ marginBottom: 8, color: 'var(--muted)' }}>
                No {selectedTab === 'all' ? '' : selectedTab.replace('_', ' ')} Reports
              </h3>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                {selectedTab === 'all' && 'No reports found in the system.'}
                {selectedTab === 'draft' && 'No draft reports. Teachers can save reports as drafts before submitting.'}
                {selectedTab === 'pending_review' && 'No reports pending review. New submissions will appear here.'}
                {selectedTab === 'approved' && 'No approved reports yet. Reports you approve will appear here.'}
                {selectedTab === 'rejected' && 'No rejected reports. Reports you reject will appear here for reference.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredReviewedReports.map(report => renderReportCard(report, true))}
            </div>
          )}
        </div>

        {/* Administrative Reports Section */}
        <div className="sectionTitle">Generate Administrative Reports</div>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {reportTypes.map((report) => {
            const Icon = report.icon;
            return (
              <div key={report.id} className="card" style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon size={24} color="white" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: 8 }}>{report.name}</h3>
                    <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>{report.description}</p>
                    <button className="btn btnSecondary" style={{ width: '100%' }}>
                      <Download size={16} style={{ marginRight: 8 }} />
                      Generate Report
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PrincipalShell>
  );
}
