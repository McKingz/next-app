/**
 * Students Service
 * 
 * Handles all student-related database operations with:
 * - Multi-tenant isolation (preschool_id filtering)
 * - Supabase v2 API patterns
 * - Type safety with TypeScript
 */

import { assertSupabase } from '@/lib/supabase';

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name?: string;
  date_of_birth: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  preschool_id: string;
  class_id: string | null;
  parent_id: string | null;
  guardian_id: string | null;
  is_active: boolean;
  status: 'active' | 'inactive' | 'pending';
  medical_conditions?: string | null;
  allergies?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface StudentUpdatePayload {
  first_name?: string;
  last_name?: string;
  preferred_name?: string;
  date_of_birth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  class_id?: string | null;
  status?: 'active' | 'inactive' | 'pending';
  medical_conditions?: string | null;
  allergies?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface StudentFilters {
  search?: string;
  classId?: string;
  status?: ('active' | 'inactive' | 'pending')[];
  ageGroup?: string;
}

/**
 * Get a single student by ID
 * @param preschoolId - Tenant ID for multi-tenant isolation
 * @param studentId - Student ID
 */
export async function getStudent(preschoolId: string, studentId: string): Promise<Student> {
  const { data, error } = await assertSupabase()
    .from('students')
    .select('*')
    .eq('id', studentId)
    .eq('preschool_id', preschoolId)
    .single();

  if (error) throw new Error(`Failed to fetch student: ${error.message}`);
  if (!data) throw new Error('Student not found');

  return data as Student;
}

/**
 * Get all students for a preschool with optional filtering
 * @param preschoolId - Tenant ID for multi-tenant isolation
 * @param filters - Optional filters (search, class, status, etc.)
 */
export async function getStudents(
  preschoolId: string,
  filters?: StudentFilters
): Promise<Student[]> {
  let query = assertSupabase()
    .from('students')
    .select('*')
    .eq('preschool_id', preschoolId)
    .eq('is_active', true)
    .order('first_name', { ascending: true });

  // Apply filters
  if (filters?.classId) {
    query = query.eq('class_id', filters.classId);
  }

  if (filters?.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }

  // Search filter (first_name or last_name contains search term)
  if (filters?.search) {
    query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch students: ${error.message}`);

  return (data as Student[]) || [];
}

/**
 * Update a student's information
 * @param preschoolId - Tenant ID for multi-tenant isolation
 * @param studentId - Student ID
 * @param payload - Fields to update
 */
export async function updateStudent(
  preschoolId: string,
  studentId: string,
  payload: StudentUpdatePayload
): Promise<Student> {
  const { data, error } = await assertSupabase()
    .from('students')
    .update(payload)
    .eq('id', studentId)
    .eq('preschool_id', preschoolId) // CRITICAL: Multi-tenant isolation
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update student: ${error.message}`);
  if (!data) throw new Error('Student not found or you do not have permission to update');

  return data as Student;
}

/**
 * Calculate age from date of birth
 * @param dateOfBirth - ISO date string
 * @returns Object with age in years and months
 */
export function calculateAge(dateOfBirth: string | null): { years: number; months: number } {
  if (!dateOfBirth) return { years: 0, months: 0 };

  const birth = new Date(dateOfBirth);
  const today = new Date();

  const totalMonths =
    (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  return { years: Math.max(0, years), months: Math.max(0, months) };
}

/**
 * Format age for display
 * @param dateOfBirth - ISO date string
 * @returns Formatted string like "5y 9m" or "6 years"
 */
export function formatAge(dateOfBirth: string | null): string {
  const age = calculateAge(dateOfBirth);
  
  if (age.years === 0) {
    return `${age.months}m`;
  }
  
  if (age.months === 0) {
    return `${age.years}y`;
  }
  
  return `${age.years}y ${age.months}m`;
}
