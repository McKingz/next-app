/**
 * Organization Service
 * 
 * Handles organization operations using secure server-side RPCs.
 * All creation logic runs server-side with proper validation.
 */

import { assertSupabase } from '@/lib/supabase';

export interface CreateOrganizationParams {
  name: string;
  type?: 'preschool' | 'daycare' | 'primary_school' | 'skills' | 'tertiary' | 'org' | 'other';
  phone?: string | null;
  status?: 'active' | 'inactive' | 'pending';
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  status: string;
  created_by: string;
  created_at: string;
}

/**
 * Create a new organization using server-side RPC
 * 
 * This bypasses client-side RLS complications by executing
 * creation logic server-side with SECURITY DEFINER.
 * 
 * Requirements:
 * - User must be authenticated
 * - User must be a principal or superadmin
 * - Organization name is required
 * 
 * The RPC automatically:
 * - Validates user permissions
 * - Creates the organization
 * - Links the creator's profile to the new organization
 * 
 * @param params Organization creation parameters
 * @returns The created organization record
 * @throws Error if validation fails or user lacks permissions
 */
export async function createOrganization(
  params: CreateOrganizationParams
): Promise<Organization> {
  const supabase = assertSupabase();

  // Validate required fields client-side for better UX
  if (!params.name || params.name.trim().length === 0) {
    throw new Error('Organization name is required');
  }

  // Call the server-side RPC function
  const { data, error } = await supabase.rpc('create_organization', {
    p_name: params.name.trim(),
    p_type: params.type || 'preschool',
    p_phone: params.phone || null,
    p_status: params.status || 'active',
  });

  if (error) {
    // Log full error details for debugging
    console.error('❌ RPC create_organization failed:');
    console.error('   Code:', error.code);
    console.error('   Message:', error.message);
    console.error('   Details:', error.details);
    console.error('   Hint:', error.hint);
    console.error('   Full error:', JSON.stringify(error, null, 2));
    
    // Provide user-friendly error messages
    if (error.code === '42501') {
      throw new Error('Only principals and superadmins can create organizations');
    }
    if (error.code === '22023') {
      throw new Error(error.message || 'Invalid organization data');
    }
    if (error.code === 'PGRST202') {
      throw new Error('No data returned - check if function exists');
    }
    
    throw new Error(error.message || 'Failed to create organization');
  }

  if (!data || data.length === 0) {
    throw new Error('No organization data returned from server');
  }

  // RPC returns array with single row
  return data[0] as Organization;
}

/**
 * Get organization by ID
 */
export async function getOrganization(id: string): Promise<Organization | null> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Failed to fetch organization:', error);
    return null;
  }

  return data as Organization;
}

/**
 * Update organization details
 * 
 * Note: Only principals within their org or superadmins can update
 */
export async function updateOrganization(
  id: string,
  updates: Partial<Omit<Organization, 'id' | 'created_by' | 'created_at'>>
): Promise<Organization> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update organization:', error);
    throw new Error(error.message || 'Failed to update organization');
  }

  return data as Organization;
}
