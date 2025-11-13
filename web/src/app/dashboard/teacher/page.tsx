'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { useTeacherDashboard } from '@/lib/hooks/teacher/useTeacherDashboard';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { MetricCard } from '@/components/dashboard/parent/MetricCard';
import { QuickActionCard } from '@/components/dashboard/parent/QuickActionCard';
import { ClassCard } from '@/components/dashboard/teacher/ClassCard';
import { AskAIWidget } from '@/components/dashboard/AskAIWidget';
import { TierBadge } from '@/components/ui/TierBadge';
import {
  Users,
  School,
  ClipboardCheck,
  BookOpen,
  MessageCircle,
  Calendar,
  FileText,
  PlusCircle,
  Search,
} from 'lucide-react';

export default function TeacherDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  // Fetch user profile with preschool data
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);

  const userEmail = profile?.email;
  const userName = profile?.firstName || userEmail?.split('@')[0] || 'Teacher';
  const preschoolName = profile?.preschoolName;
  const preschoolId = profile?.preschoolId;
  const userRole = profile?.role;
  const roleDisplay = userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Teacher';

  // Initialize auth
  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/sign-in');
        return;
      }

      setUserId(session.user.id);

      // Set greeting based on time of day
      const hour = new Date().getHours();
      if (hour < 12) setGreeting('Good Morning');
      else if (hour < 18) setGreeting('Good Afternoon');
      else setGreeting('Good Evening');

      setAuthLoading(false);
    };

    initAuth();
  }, [router, supabase]);

  // Load dashboard data
  const { metrics, classes, loading: dashboardLoading, refetch } = useTeacherDashboard(userId);

  const loading = authLoading || profileLoading || dashboardLoading;

  if (loading) {
    return (
      <TeacherShell
        tenantSlug={tenantSlug}
        userEmail={userEmail}
        userName={userName}
        preschoolName={preschoolName}
        preschoolId={preschoolId}
        userId={userId}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading...</p>
        </div>
      </TeacherShell>
    );
  }

  return (
    <>
      <style jsx global>{`
        body, html {
          overflow-x: hidden;
          max-width: 100vw;
        }
        .section, .card, .grid2 {
          max-width: 100%;
          overflow-x: hidden;
        }
      `}</style>
      <TeacherShell
        tenantSlug={tenantSlug}
        userEmail={userEmail}
        userName={userName}
        preschoolName={preschoolName}
        preschoolId={preschoolId}
        userId={userId}
      >
      {/* Search Bar */}
      <div style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>
        <div style={{ position: 'relative' }}>
          <input
            className="searchInput"
            placeholder="Search students, classes..."
            style={{ width: '100%', paddingRight: '2.5rem' }}
            onKeyDown={(e) => {
              const t = e.target as HTMLInputElement;
              if (e.key === 'Enter' && t.value.trim()) router.push(`/dashboard/teacher/search?q=${encodeURIComponent(t.value.trim())}`);
            }}
          />
          <Search className="searchIcon icon16" style={{ right: '0.75rem', left: 'auto' }} />
        </div>
      </div>

      {/* Page Header with Preschool Name */}
      <div className="section" style={{ marginBottom: 0 }}>
        {preschoolName && (
          <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', marginBottom: 16, cursor: 'pointer' }} onClick={() => router.push('/dashboard/teacher/classes')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 24 }}>🎓</span>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{preschoolName}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 32 }}>
                <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>{roleDisplay}</p>
                <span style={{ opacity: 0.7 }}>•</span>
                <TierBadge userId={userId} size="sm" showUpgrade />
              </div>
            </div>
          </div>
        )}
      </div>

      <h1 className="h1">{greeting}, {userName}</h1>

      {/* Overview Metrics */}
      <div className="section">
        <div className="sectionTitle">Overview</div>
        <div className="grid2">
          <div className="card tile">
            <div className="metricValue">{metrics.totalStudents}</div>
            <div className="metricLabel">Total Students</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{metrics.totalClasses}</div>
            <div className="metricLabel">Active Classes</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{metrics.pendingGrading}</div>
            <div className="metricLabel">Pending Grading</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{metrics.upcomingLessons}</div>
            <div className="metricLabel">Upcoming Lessons</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="section">
        <div className="sectionTitle">Quick actions</div>
        <div className="grid2">
          <button className="qa" onClick={() => router.push('/dashboard/teacher/lessons')}>
            <BookOpen className="icon20" />
            <span>Create Lesson Plan</span>
          </button>
          <button className="qa" onClick={() => router.push('/dashboard/teacher/assignments')}>
            <ClipboardCheck className="icon20" />
            <span>Grade Assignments</span>
          </button>
          <button className="qa" onClick={() => router.push('/dashboard/teacher/classes')}>
            <Users className="icon20" />
            <span>View Classes</span>
          </button>
          <button className="qa" onClick={() => router.push('/dashboard/teacher/messages')}>
            <MessageCircle className="icon20" />
            <span>Message Parents</span>
          </button>
        </div>
      </div>

      {/* My Classes */}
      {classes.length > 0 ? (
        <div className="section">
          <div className="sectionTitle">My Classes</div>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {classes.map((cls) => (
              <div key={cls.id} className="card" style={{ padding: 16 }}>
                <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 600 }}>{cls.name}</h3>
                <p style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 14 }}>Grade {cls.grade}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{cls.studentCount}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Students</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{cls.pendingAssignments}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Pending</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{cls.upcomingLessons}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Lessons</div>
                  </div>
                </div>
                <button 
                  className="btn btnPrimary" 
                  style={{ width: '100%', marginTop: 12 }}
                  onClick={() => router.push(`/dashboard/teacher/classes/${cls.id}`)}
                >
                  View Class
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="section">
          <div className="card" style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: 8 }}>No classes assigned yet</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
              Contact your administrator to assign classes to your account.
            </p>
          </div>
        </div>
      )}
      </TeacherShell>
    </>
  );
}
