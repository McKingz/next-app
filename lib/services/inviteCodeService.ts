import { assertSupabase } from '@/lib/supabase';

export type SchoolInvitationCode = {
  id: string;
  code: string;
  invitation_type: string;
  preschool_id: string;
  school_id?: string | null;
  is_active: boolean | null;
  max_uses?: number | null;
  current_uses?: number | null;
  expires_at?: string | null;
  description?: string | null;
  invited_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function generateReadableCode(length = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0, 1 for readability
  let s = '';
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class InviteCodeService {
  static async listParentCodes(preschoolId: string): Promise<SchoolInvitationCode[]> {
    const { data, error } = await assertSupabase()
      .from('school_invitation_codes')
      .select('*')
      .eq('preschool_id', preschoolId)
      .eq('invitation_type', 'parent')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as SchoolInvitationCode[];
  }

  static async listCodes(preschoolId: string, invitationType: string): Promise<SchoolInvitationCode[]> {
    const { data, error } = await assertSupabase()
      .from('school_invitation_codes')
      .select('*')
      .eq('preschool_id', preschoolId)
      .eq('invitation_type', invitationType)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as SchoolInvitationCode[];
  }

  /**
   * Generic invite creation supporting multiple invitation types and organization context.
   * This keeps preschool_id for primary linkage and stores broader org context in metadata.
   */
  static async createInviteCode(params: {
    invitationType: 'parent' | 'student' | 'teacher' | 'member' | string;
    preschoolId: string; // required for current schema
    organizationId?: string | null;
    organizationKind?: 'preschool' | 'k12' | 'skills' | 'org' | string;
    invitedBy?: string | null;
    description?: string | null;
    maxUses?: number | null; // null => unlimited
    expiresAt?: string | null; // ISO string or null
    codeLength?: number; // default 8
  }): Promise<SchoolInvitationCode> {
    const length = params.codeLength ?? 8;

    // Reuse an active code if exists for same type + preschool
    try {
      const { data: existing } = await assertSupabase()
        .from('school_invitation_codes')
        .select('*')
        .eq('preschool_id', params.preschoolId)
        .eq('invitation_type', params.invitationType)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) return existing as unknown as SchoolInvitationCode;
    } catch { /* Intentional: non-fatal */ }

    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateReadableCode(length);
      const metadata: any = {
        organization_id: params.organizationId ?? null,
        organization_kind: params.organizationKind ?? (params.preschoolId ? 'preschool' : null),
        org_ref: {
          preschool_id: params.preschoolId,
          organization_id: params.organizationId ?? null,
          kind: params.organizationKind ?? (params.preschoolId ? 'preschool' : null),
        },
        source: 'principal_dashboard',
        version: 1,
      };

      const payload: Partial<SchoolInvitationCode> = {
        code,
        invitation_type: params.invitationType,
        preschool_id: params.preschoolId,
        invited_by: params.invitedBy ?? null,
        description: params.description ?? `${params.invitationType} invitation code`,
        max_uses: params.maxUses ?? null,
        expires_at: params.expiresAt ?? null,
        is_active: true,
        metadata,
      } as any;

      const { data, error } = await assertSupabase()
        .from('school_invitation_codes')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) {
        return data as unknown as SchoolInvitationCode;
      }

      const codeStr = (error as any)?.code || '';
      const msg = String(error?.message || '').toLowerCase();
      const isFK = codeStr === '23503' || msg.includes('foreign key') || msg.includes('invited_by_fkey');
      const isConflict = codeStr === '23505' || msg.includes('duplicate') || msg.includes('unique') || msg.includes('json object requested');

      if (isFK) {
        // Foreign key failure likely due to invited_by referencing public.users
        console.warn('[InviteCodeService] FK failed on invited_by, retrying with invited_by=null');
        try {
          const retryPayload = {
            ...payload,
            invited_by: null,
            metadata: {
              ...(payload as any).metadata,
              invited_by_auth_user: params.invitedBy ?? null,
              invited_by_fk_bypassed: true,
            },
          } as any;
          const { data: retried, error: retryErr } = await assertSupabase()
            .from('school_invitation_codes')
            .insert(retryPayload)
            .select('*')
            .single();
          if (!retryErr && retried) return retried as unknown as SchoolInvitationCode;
          if (retryErr) {
            console.error('[InviteCodeService] Retry insert after FK failure failed', retryErr);
          }
        } catch (retryCatch) {
          console.error('[InviteCodeService] Retry after FK failure threw exception', retryCatch);
        }
      }

      if (isConflict) {
        console.warn('[InviteCodeService] Conflict creating invite; reusing latest active code', {
          code_attempt: code,
          preschool_id: params.preschoolId,
          invitation_type: params.invitationType,
          error: (error as any)?.message || String(error),
        });
        try {
          const { data: existing } = await assertSupabase()
            .from('school_invitation_codes')
            .select('*')
            .eq('preschool_id', params.preschoolId)
            .eq('invitation_type', params.invitationType)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existing) return existing as unknown as SchoolInvitationCode;
        } catch (selectErr) {
          console.warn('[InviteCodeService] Fallback select after conflict failed', selectErr);
        }
      }

      console.error('[InviteCodeService] Invite creation failed', error);
      throw error;
    }
    throw new Error('Could not generate a unique invite code. Please try again.');
  }

  /**
   * Backward-compatible parent-specific creator. Calls createInviteCode under the hood.
   */
  static async createParentCode(params: {
    preschoolId: string;
    organizationId?: string | null;
    organizationKind?: 'preschool' | 'k12' | 'skills' | 'org' | string;
    invitedBy?: string | null;
    description?: string | null;
    maxUses?: number | null;
    expiresAt?: string | null;
    codeLength?: number;
  }): Promise<SchoolInvitationCode> {
    return this.createInviteCode({
      invitationType: 'parent',
      preschoolId: params.preschoolId,
      organizationId: params.organizationId,
      organizationKind: params.organizationKind,
      invitedBy: params.invitedBy,
      description: params.description ?? 'School-wide parent invite code',
      maxUses: params.maxUses,
      expiresAt: params.expiresAt,
      codeLength: params.codeLength,
    });
  }

  static async setActive(inviteId: string, isActive: boolean): Promise<void> {
    const { error } = await assertSupabase()
      .from('school_invitation_codes')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', inviteId);
    if (error) throw error;
  }
}
