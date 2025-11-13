import { assertSupabase } from '@/lib/supabase';
import { extractOrganizationId } from '@/lib/tenant/compat';

export type CreateSchoolParams = {
  schoolName: string;
  adminName?: string | null;
  phone?: string | null;
  planTier?: 'free' | 'starter' | 'premium' | 'enterprise';
};

/**
 * @deprecated Use CreateOrganizationParams instead
 */
export type CreateOrganizationParams = CreateSchoolParams;

export class TenantService {
  /**
   * Create a new organization (school)
   * @deprecated Method name will change to createOrganization in future
   */
  static async createSchool(params: CreateSchoolParams): Promise<string> {
    const { data, error } = await assertSupabase().rpc('principal_create_school', {
      p_school_name: params.schoolName,
      p_admin_name: params.adminName ?? null,
      p_phone: params.phone ?? null,
      p_plan_tier: params.planTier ?? 'free',
    });
    if (error) throw error;
    return String(data);
  }

  /**
   * Get current user's organization ID
   * Uses organization_id with fallback to preschool_id
   */
  static async getMyOrganizationId(): Promise<string | null> {
    const { data: prof } = await assertSupabase()
      .from('profiles')
      .select('organization_id, preschool_id')
      .maybeSingle();
    
    return extractOrganizationId(prof);
  }

  /**
   * @deprecated Use getMyOrganizationId instead
   */
  static async getMySchoolId(): Promise<string | null> {
    return this.getMyOrganizationId();
  }
}
