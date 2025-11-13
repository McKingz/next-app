import { assertSupabase } from '@/lib/supabase';

function randomToken(len = 32) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export type TeacherInvite = {
  id: string;
  school_id: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invited_by: string;
  expires_at: string;
  created_at: string;
  accepted_by?: string | null;
  accepted_at?: string | null;
};

export class TeacherInviteService {
  static async createInvite(params: { schoolId: string; email: string; invitedBy: string }): Promise<TeacherInvite> {
    const token = randomToken(48);
    const { data, error } = await assertSupabase()
      .from('teacher_invites')
      .insert({ school_id: params.schoolId, email: params.email, invited_by: params.invitedBy, token })
      .select('*')
      .single();
    if (error) throw error;
    return data as TeacherInvite;
  }

  static async listInvites(schoolId: string): Promise<TeacherInvite[]> {
    const { data, error } = await assertSupabase()
      .from('teacher_invites')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as TeacherInvite[];
  }

  static async revoke(inviteId: string): Promise<void> {
    const { error } = await assertSupabase()
      .from('teacher_invites')
      .update({ status: 'revoked' })
      .eq('id', inviteId);
    if (error) throw error;
  }

  static async accept(params: { token: string; authUserId: string; email: string }): Promise<void> {
    // Verify invite
    const { data: invite, error: invErr } = await assertSupabase()
      .from('teacher_invites')
      .select('*')
      .eq('token', params.token)
      .eq('email', params.email)
      .eq('status', 'pending')
      .maybeSingle();
    if (invErr || !invite) throw new Error('Invalid or expired invite');

    // Mark accepted
    await assertSupabase()
      .from('teacher_invites')
      .update({ status: 'accepted', accepted_by: params.authUserId, accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    // Ensure teacher profile linkage and active seat membership
    try {
      // Attempt users table
      const { data: existing } = await assertSupabase()
        .from('users')
        .select('id, auth_user_id, role, preschool_id')
        .eq('auth_user_id', params.authUserId)
        .maybeSingle();
      if (existing) {
        await assertSupabase().from('users').update({ role: 'teacher', preschool_id: invite.school_id }).eq('id', existing.id);
      } else {
        // fallback to profiles table by id
        await assertSupabase()
          .from('profiles')
          .upsert({ id: params.authUserId, role: 'teacher', preschool_id: invite.school_id, email: params.email });
      }
      // Ensure organization membership with active seat
      try {
        // Upsert into organization_members (some envs may not have it; ignore errors)
        await assertSupabase()
          .from('organization_members')
          .upsert({
            id: crypto?.randomUUID ? crypto.randomUUID() : undefined,
            organization_id: invite.school_id,
            user_id: params.authUserId,
            role: 'teacher',
            seat_status: 'active',
            invited_by: invite.invited_by || null,
          } as any, { onConflict: 'organization_id,user_id' } as any);
      } catch (e) {
        // ignore if table not present
      }
    } catch { /* Intentional: non-fatal */ }
  }
}