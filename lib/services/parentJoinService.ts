import { assertSupabase } from '@/lib/supabase';

export type GuardianRequest = {
  id: string;
  school_id: string | null;
  parent_auth_id: string;
  parent_email?: string | null;
  student_id?: string | null;
  child_full_name?: string | null;
  child_class?: string | null;
  relationship?: 'mother' | 'father' | 'guardian' | 'other' | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
};

export type GuardianRequestWithStudent = GuardianRequest & {
  student?: {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    avatar_url?: string | null;
  } | null;
};

export type SearchedStudent = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  avatar_url?: string | null;
  preschool_id?: string | null;
  age_group?: { name: string } | null;
};

export class ParentJoinService {
  static async requestLink(params: {
    schoolId?: string | null;
    parentAuthId: string;
    parentEmail?: string | null;
    studentId?: string | null;
    childFullName?: string | null;
    childClass?: string | null;
    relationship?: 'mother' | 'father' | 'guardian' | 'other' | null;
  }): Promise<string> {
    // Check for duplicate pending request
    const { data: existing } = await assertSupabase()
      .from('guardian_requests')
      .select('id')
      .eq('parent_auth_id', params.parentAuthId)
      .eq('student_id', params.studentId ?? '')
      .eq('status', 'pending')
      .maybeSingle();
    
    if (existing) {
      throw new Error('You already have a pending request for this child');
    }

    const { data, error } = await assertSupabase()
      .from('guardian_requests')
      .insert({
        school_id: params.schoolId ?? null,
        parent_auth_id: params.parentAuthId,
        parent_email: params.parentEmail ?? null,
        student_id: params.studentId ?? null,
        child_full_name: params.childFullName ?? null,
        child_class: params.childClass ?? null,
        relationship: params.relationship ?? null,
        status: 'pending',
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id as string;
  }

  static async myRequests(parentAuthId: string): Promise<GuardianRequest[]> {
    const { data, error } = await assertSupabase()
      .from('guardian_requests')
      .select('*')
      .eq('parent_auth_id', parentAuthId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as GuardianRequest[];
  }

  static async listPendingForSchool(schoolId: string): Promise<GuardianRequest[]> {
    const { data, error } = await assertSupabase()
      .from('guardian_requests')
      .select('*')
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as GuardianRequest[];
  }

  static async approve(requestId: string, studentId: string, approverId: string): Promise<void> {
    // Link parent to the student (set parent_id if empty, otherwise guardian_id)
    // Fetch request
    const { data: req, error: reqErr } = await assertSupabase()
      .from('guardian_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (reqErr || !req) throw reqErr || new Error('Request not found');

    // Update student linkage conservatively
    try {
      // Try to set parent_id if not set
      const { data: student } = await assertSupabase()
        .from('students')
        .select('id, parent_id, guardian_id, preschool_id')
        .eq('id', studentId)
        .single();
      if (student) {
        if (!student.parent_id) {
          await assertSupabase().from('students').update({ parent_id: req.parent_auth_id }).eq('id', studentId);
          
          // ✅ NEW: Sync parent's preschool_id from student
          if (student.preschool_id) {
            await assertSupabase()
              .from('profiles')
              .update({ 
                preschool_id: student.preschool_id,
                organization_id: student.preschool_id,
                updated_at: new Date().toISOString()
              })
              .eq('id', req.parent_auth_id)
              .eq('role', 'parent');
          }
        } else if (!student.guardian_id && req.parent_auth_id !== student.parent_id) {
          await assertSupabase().from('students').update({ guardian_id: req.parent_auth_id }).eq('id', studentId);
          
          // ✅ NEW: Sync guardian's preschool_id from student
          if (student.preschool_id) {
            await assertSupabase()
              .from('profiles')
              .update({ 
                preschool_id: student.preschool_id,
                organization_id: student.preschool_id,
                updated_at: new Date().toISOString()
              })
              .eq('id', req.parent_auth_id)
              .eq('role', 'parent');
          }
        }
      }
    } catch { /* Intentional: non-fatal */ }

    // Mark request approved
    const { error } = await assertSupabase()
      .from('guardian_requests')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: approverId, student_id: studentId })
      .eq('id', requestId);
    if (error) throw error;
  }

  static async reject(requestId: string, approverId: string, reason?: string): Promise<void> {
    const { error } = await assertSupabase()
      .from('guardian_requests')
      .update({ 
        status: 'rejected', 
        approved_at: new Date().toISOString(), 
        approved_by: approverId,
        rejection_reason: reason || null
      })
      .eq('id', requestId);
    if (error) throw error;
  }

  /**
   * Search for students in a preschool by name or ID
   */
  static async searchChild(
    preschoolId: string, 
    query: string
  ): Promise<SearchedStudent[]> {
    const supabase = assertSupabase();

    // Prefer explicit FK-qualified embed to avoid PostgREST 300 (ambiguous relationship)
    const selectWithAgeGroup = 'id, first_name, last_name, date_of_birth, avatar_url, preschool_id, age_group:age_groups!students_age_group_id_fkey(name)';

    let { data, error, status } = await supabase
      .from('students')
      .select(selectWithAgeGroup)
      .eq('preschool_id', preschoolId)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .order('first_name', { ascending: true })
      .limit(20);

    // If ambiguous relationship persists (HTTP 300 / PGRST302), retry without embed as a safe fallback
    if (error && (status === 300 || (error as any)?.code === 'PGRST302')) {
      const retry = await supabase
        .from('students')
        .select('id, first_name, last_name, date_of_birth, avatar_url, preschool_id')
        .eq('preschool_id', preschoolId)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .order('first_name', { ascending: true })
        .limit(20);
      if (retry.error) throw retry.error;
      return (retry.data || []) as SearchedStudent[];
    }
    if (error) throw error;
    return (data || []) as SearchedStudent[];
  }

  /**
   * Get a single request with full student details
   */
  static async getRequestWithStudent(
    requestId: string
  ): Promise<GuardianRequestWithStudent | null> {
    const { data, error } = await assertSupabase()
      .from('guardian_requests')
      .select(`
        *,
        student:students(first_name, last_name, date_of_birth, avatar_url)
      `)
      .eq('id', requestId)
      .single();
    
    if (error) throw error;
    return data as GuardianRequestWithStudent;
  }

  /**
   * Get all requests for a parent with student details
   */
  static async myRequestsWithStudents(parentAuthId: string): Promise<GuardianRequestWithStudent[]> {
    const { data, error } = await assertSupabase()
      .from('guardian_requests')
      .select(`
        *,
        student:students(first_name, last_name, date_of_birth, avatar_url)
      `)
      .eq('parent_auth_id', parentAuthId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as GuardianRequestWithStudent[];
  }

  /**
   * Cancel a pending request (parent withdraws)
   */
  static async cancel(requestId: string, parentAuthId: string): Promise<void> {
    const { error } = await assertSupabase()
      .from('guardian_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('parent_auth_id', parentAuthId)
      .eq('status', 'pending');
    
    if (error) throw error;
  }

  /**
   * List pending requests for school with parent and student details
   */
  static async listPendingForSchoolWithDetails(schoolId: string): Promise<any[]> {
    // Fetch requests + student details
    const { data, error, status } = await assertSupabase()
      .from('guardian_requests')
      .select(`
        *,
        student:students!guardian_requests_student_id_fkey(first_name, last_name, date_of_birth, avatar_url)
      `)
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    
    let base = data || [];
    if (error) {
      // If embeds fail (e.g., schema drift), fall back to base columns only
      if (status === 300 || (error as any)?.code === 'PGRST302') {
        const retry = await assertSupabase()
          .from('guardian_requests')
          .select('*')
          .eq('school_id', schoolId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true });
        if (retry.error) throw retry.error;
        base = retry.data || [];
      } else {
        throw error;
      }
    }

    // Enrich with parent profile details (name, phone) in a second query
    const parentIds = Array.from(new Set((base || []).map((r: any) => r.parent_auth_id).filter(Boolean)));
    if (parentIds.length === 0) return base;

    const { data: parents } = await assertSupabase()
      .from('profiles')
      .select('id, first_name, last_name, phone, avatar_url')
      .in('id', parentIds);

    const parentMap = new Map<string, any>((parents || []).map((p: any) => [p.id, p]));

    return (base || []).map((r: any) => ({
      ...r,
      parent_profile: parentMap.get(r.parent_auth_id) || null,
    }));
  }
}
