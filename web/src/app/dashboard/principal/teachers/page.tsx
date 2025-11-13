'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { PrincipalShell } from '@/components/dashboard/principal/PrincipalShell';
import { School, UserPlus, Search, Mail, Phone, Users, AlertCircle } from 'lucide-react';

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  status: string;
  class_count?: number;
  student_count?: number;
}

export default function TeachersPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userId, setUserId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [seatLimits, setSeatLimits] = useState<{ limit: number | null; used: number; available: number | null } | null>(null);

  const { profile } = useUserProfile(userId);
  const { slug: tenantSlug } = useTenantSlug(userId);
  const preschoolId = profile?.preschoolId;
  const preschoolName = profile?.preschoolName;

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/sign-in');
        return;
      }
      setUserId(session.user.id);
    };
    initAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!preschoolId) return;

    const loadTeachers = async () => {
      setLoading(true);
      try {
        // Fetch teachers and subscription info in parallel
        const [teachersResponse, seatRpc] = await Promise.all([
          fetch(`/api/principal/teachers?preschoolId=${preschoolId}`, {
            credentials: 'include', // Include cookies for authentication
            headers: {
              'Content-Type': 'application/json',
            },
          }),
          supabase.rpc('rpc_teacher_seat_limits')
        ]);

        if (!teachersResponse.ok) {
          const text = await teachersResponse.text();
          console.error('Error loading teachers:', text);
          setTeachers([]);
        } else {
          const teachersData = await teachersResponse.json();
          setTeachers(teachersData.teachers || []);
        }

        if (seatRpc.data && seatRpc.data.length > 0) {
          setSeatLimits(seatRpc.data[0]);
        }
      } catch (error) {
        console.error('Error loading teachers:', error);
        setTeachers([]);
      } finally {
        setLoading(false);
      }
    };

    loadTeachers();
  }, [preschoolId]);

  const filteredTeachers = teachers.filter(teacher =>
    teacher.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId}>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-slate-400">Loading teachers...</p>
        </div>
      </PrincipalShell>
    );
  }

  return (
    <PrincipalShell tenantSlug={tenantSlug} preschoolName={preschoolName} preschoolId={preschoolId}>
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 className="h1">Teachers</h1>
          <button 
            className="btn btnPrimary"
            onClick={() => router.push('/dashboard/principal/teachers/invite')}
          >
            <UserPlus size={18} style={{ marginRight: 8 }} />
            Invite Teacher
          </button>
        </div>

        {/* Seat Usage Indicator */}
        {seatLimits && (
          <div 
            className="card" 
            style={{ 
              marginBottom: 24,
              background: seatLimits.limit !== null && seatLimits.used >= seatLimits.limit
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Users size={24} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                    Teacher Seats: {seatLimits.used}{seatLimits.limit !== null ? ` / ${seatLimits.limit}` : ' / Unlimited'}
                  </div>
                  <div style={{ fontSize: 14, opacity: 0.9 }}>
                    {seatLimits.limit === null
                      ? 'Unlimited seats on current plan'
                      : seatLimits.limit - seatLimits.used > 0 
                        ? `${seatLimits.limit - seatLimits.used} seats remaining`
                        : 'All seats used. Upgrade to add more teachers.'}
                  </div>
                </div>
              </div>
              {seatLimits.limit !== null && seatLimits.used >= seatLimits.limit && (
                <button 
                  className="btn"
                  style={{ background: 'white', color: '#dc2626', border: 'none', fontWeight: 600 }}
                  onClick={() => router.push('/dashboard/principal/settings')}
                >
                  Upgrade Plan
                </button>
              )}
            </div>
            {/* Progress bar */}
            {seatLimits.limit !== null && (
              <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.3)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                <div 
                  style={{ 
                    background: 'white', 
                    height: '100%', 
                    width: `${Math.min((seatLimits.used / seatLimits.limit) * 100, 100)}%`,
                    borderRadius: 999,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="grid2" style={{ marginBottom: 24 }}>
          <div className="card tile">
            <div className="metricValue">{teachers.length}</div>
            <div className="metricLabel">Total Teachers</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{teachers.filter(t => t.status === 'active').length}</div>
            <div className="metricLabel">Active Teachers</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{teachers.filter(t => t.class_count && t.class_count > 0).length}</div>
            <div className="metricLabel">Assigned Classes</div>
          </div>
          <div className="card tile">
            <div className="metricValue">{teachers.filter(t => !t.class_count || t.class_count === 0).length}</div>
            <div className="metricLabel">Unassigned</div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Search teachers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 40px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 14,
              }}
            />
          </div>
        </div>

        {filteredTeachers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <School size={48} style={{ margin: '0 auto 16px', color: 'var(--muted)' }} />
            <h3 style={{ marginBottom: 8 }}>No teachers found</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
              {searchTerm ? 'Try adjusting your search' : 'Invite your first teacher to get started'}
            </p>
            {!searchTerm && (
              <button 
                className="btn btnPrimary"
                onClick={() => router.push('/dashboard/principal/teachers/invite')}
              >
                <UserPlus size={18} style={{ marginRight: 8 }} />
                Invite Teacher
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredTeachers.map((teacher) => (
              <div 
                key={teacher.id} 
                className="card"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                }}
              >
                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                  onClick={() => router.push(`/dashboard/principal/teachers/${teacher.id}`)}
                >
                  <div 
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: 18,
                    }}
                  >
                    {teacher.first_name?.[0]}{teacher.last_name?.[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {teacher.first_name} {teacher.last_name}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail size={14} />
                        {teacher.email}
                      </span>
                      {teacher.phone_number && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={14} />
                          {teacher.phone_number}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right', marginRight: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Classes</div>
                    <div style={{ fontWeight: 600 }}>{teacher.class_count || 0}</div>
                  </div>

                  {/* Seat actions */}
                  <button
                    className="btn"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await supabase.rpc('rpc_assign_teacher_seat', { target_user_id: teacher.id });
                        // refresh seat limits
                        const seat = await supabase.rpc('rpc_teacher_seat_limits');
                        if (seat.data && seat.data.length > 0) setSeatLimits(seat.data[0]);
                        alert('Seat assigned');
                      } catch (err: any) {
                        alert(err?.message || 'Failed to assign seat');
                      }
                    }}
                  >Assign Seat</button>
                  <button
                    className="btn"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await supabase.rpc('rpc_revoke_teacher_seat', { target_user_id: teacher.id });
                        const seat = await supabase.rpc('rpc_teacher_seat_limits');
                        if (seat.data && seat.data.length > 0) setSeatLimits(seat.data[0]);
                        alert('Seat revoked');
                      } catch (err: any) {
                        alert(err?.message || 'Failed to revoke seat');
                      }
                    }}
                  >Revoke Seat</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PrincipalShell>
  );
}
