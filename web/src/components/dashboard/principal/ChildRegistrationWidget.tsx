'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, XCircle, Clock, User, Baby } from 'lucide-react';

interface ChildRegistration {
  id: string;
  parent_email: string;
  parent_name: string;
  child_first_name: string;
  child_last_name: string;
  child_birth_date: string;
  child_gender: string | null;
  requested_date: string;
  parent_id: string;
}

interface ChildRegistrationWidgetProps {
  preschoolId?: string;
  userId?: string;
}

export function ChildRegistrationWidget({ preschoolId, userId }: ChildRegistrationWidgetProps) {
  const [requests, setRequests] = useState<ChildRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!preschoolId) return;

    const loadRequests = async () => {
      try {
        setLoading(true);
        console.log('👶 [ChildRegistrationWidget] Loading requests for preschool:', preschoolId);
        
        // Fetch pending child registration requests
        const { data, error } = await supabase
          .from('child_registration_requests')
          .select(`
            id,
            parent_id,
            child_first_name,
            child_last_name,
            child_birth_date,
            child_gender,
            created_at,
            preschool_id
          `)
          .eq('preschool_id', preschoolId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) {
          console.error('❌ [ChildRegistrationWidget] Error fetching requests:', error);
          throw error;
        }

        console.log('✅ [ChildRegistrationWidget] Found requests:', data?.length || 0);

        // Get parent details
        const parentIds = data?.map(r => r.parent_id) || [];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', parentIds);

        const profileMap = new Map<string, { email: string; name: string }>(
          profiles?.map(p => [
            p.id,
            {
              email: p.email || 'No email',
              name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Parent'
            }
          ])
        );

        const mapped: ChildRegistration[] = (data || []).map(r => ({
          id: r.id,
          parent_id: r.parent_id,
          parent_email: profileMap.get(r.parent_id)?.email || 'No email',
          parent_name: profileMap.get(r.parent_id)?.name || 'Parent',
          child_first_name: r.child_first_name,
          child_last_name: r.child_last_name,
          child_birth_date: r.child_birth_date,
          child_gender: r.child_gender,
          requested_date: new Date(r.created_at).toLocaleDateString('en-ZA', {
            day: '2-digit',
            month: 'short',
          }),
        }));

        setRequests(mapped);
      } catch (error) {
        console.error('Error loading child registration requests:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [preschoolId, supabase]);

  const handleApprove = async (requestId: string, childFirstName: string, childLastName: string) => {
    if (!userId || !preschoolId) return;
    setProcessingId(requestId);

    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) throw new Error('Request not found');

      // 1. Create student record
      const { data: newStudent, error: studentError } = await supabase
        .from('students')
        .insert({
          first_name: request.child_first_name,
          last_name: request.child_last_name,
          date_of_birth: request.child_birth_date,
          gender: request.child_gender,
          preschool_id: preschoolId,
          parent_id: request.parent_id, // Link to parent's profile.id
          is_active: true,
          status: 'active',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (studentError) throw studentError;

      console.log('✅ Student created:', newStudent);

      // 2. Update this registration request status to approved
      const { error: updateError } = await supabase
        .from('child_registration_requests')
        .update({
          status: 'approved',
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // 3. Auto-reject any other pending requests for the same child
      await supabase
        .from('child_registration_requests')
        .update({
          status: 'rejected',
        })
        .eq('parent_id', request.parent_id)
        .eq('child_first_name', request.child_first_name)
        .eq('child_last_name', request.child_last_name)
        .eq('status', 'pending')
        .neq('id', requestId);

      // Remove from list (including duplicates)
      setRequests(prev => prev.filter(r => 
        !(r.parent_id === request.parent_id && 
          r.child_first_name === request.child_first_name && 
          r.child_last_name === request.child_last_name)
      ));
      
      alert(`✅ ${childFirstName} ${childLastName} has been enrolled!\n\nThe student is now active and linked to their parent.`);
    } catch (error: any) {
      console.error('❌ Approval error:', error);
      alert(`❌ Error: ${error.message || 'Failed to approve registration'}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string, childName: string) => {
    if (!userId) return;
    const reason = prompt(`Why are you rejecting ${childName}'s registration?`);
    
    setProcessingId(requestId);

    try {
      const { error } = await supabase
        .from('child_registration_requests')
        .update({
          status: 'rejected',
          // Note: Add rejected_by, rejected_at, rejection_reason columns if they exist
        })
        .eq('id', requestId);

      if (error) throw error;

      // Remove from list
      setRequests(prev => prev.filter(r => r.id !== requestId));
      alert(`❌ Registration rejected${reason ? `: ${reason}` : ''}`);
    } catch (error: any) {
      alert(`❌ Error: ${error.message || 'Failed to reject registration'}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
          Loading requests...
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Child Registration Requests</h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {requests.length} pending enrollment
          </p>
        </div>
        <div style={{
          background: '#dc2626',
          color: 'white',
          borderRadius: 12,
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 700,
        }}>
          {requests.length}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {requests.map(request => {
          const age = request.child_birth_date 
            ? Math.floor((Date.now() - new Date(request.child_birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            : null;
          
          return (
            <div
              key={request.id}
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'var(--card)',
                border: '1px solid var(--divider)',
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Baby size={14} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {request.child_first_name} {request.child_last_name}
                  </span>
                  {age && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      (Age {age})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 20, marginBottom: 4 }}>
                  <User size={12} style={{ color: 'var(--muted)' }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Parent: {request.parent_name}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 20 }}>
                  {request.parent_email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, marginLeft: 20 }}>
                  <Clock size={11} style={{ color: 'var(--muted)' }} />
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Requested {request.requested_date}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn"
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    fontSize: 13,
                    border: '1px solid #dc2626',
                    color: '#dc2626',
                    background: 'transparent',
                  }}
                  onClick={() => handleReject(request.id, `${request.child_first_name} ${request.child_last_name}`)}
                  disabled={processingId === request.id}
                >
                  <XCircle size={14} style={{ marginRight: 4 }} />
                  Reject
                </button>
                <button
                  className="btn btnPrimary"
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    fontSize: 13,
                    background: '#059669',
                  }}
                  onClick={() => handleApprove(request.id, request.child_first_name, request.child_last_name)}
                  disabled={processingId === request.id}
                >
                  <CheckCircle size={14} style={{ marginRight: 4 }} />
                  Enroll Student
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        background: '#3b82f615',
        border: '1px solid #3b82f6',
        display: 'flex',
        gap: 8,
        fontSize: 12,
        color: 'var(--text)',
      }}>
        <span>ℹ️</span>
        <span>Approving will create a new student record and link them to their parent automatically.</span>
      </div>
    </div>
  );
}
