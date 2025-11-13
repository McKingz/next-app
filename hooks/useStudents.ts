/**
 * useStudents Hook
 * 
 * Custom hook for fetching and managing students with:
 * - TanStack Query v5 for caching and state management
 * - Multi-tenant isolation
 * - Automatic refetching and cache invalidation
 * - Loading and error states
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getStudents,
  getStudent,
  updateStudent,
  Student,
  StudentFilters,
  StudentUpdatePayload,
} from '@/services/students';

/**
 * Hook to fetch all students for the current preschool
 * @param filters - Optional filters (search, class, status)
 */
export function useStudents(filters?: StudentFilters) {
  const { profile } = useAuth();
  const preschoolId = profile?.organization_id || profile?.preschool_id;

  return useQuery({
    queryKey: ['students', preschoolId, filters],
    queryFn: () => {
      if (!preschoolId) throw new Error('No preschool ID available');
      return getStudents(preschoolId, filters);
    },
    enabled: !!preschoolId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)
  });
}

/**
 * Hook to fetch a single student by ID
 * @param studentId - Student ID
 */
export function useStudent(studentId: string | undefined) {
  const { profile } = useAuth();
  const preschoolId = profile?.organization_id || profile?.preschool_id;

  return useQuery({
    queryKey: ['student', studentId, preschoolId],
    queryFn: () => {
      if (!preschoolId) throw new Error('No preschool ID available');
      if (!studentId) throw new Error('No student ID provided');
      return getStudent(preschoolId, studentId);
    },
    enabled: !!preschoolId && !!studentId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to update a student's information
 * @returns Mutation object with mutate function
 */
export function useUpdateStudent() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const preschoolId = profile?.organization_id || profile?.preschool_id;

  return useMutation({
    mutationFn: ({
      studentId,
      payload,
    }: {
      studentId: string;
      payload: StudentUpdatePayload;
    }) => {
      if (!preschoolId) throw new Error('No preschool ID available');
      return updateStudent(preschoolId, studentId, payload);
    },
    onSuccess: (updatedStudent) => {
      // Update the single student cache
      queryClient.setQueryData(
        ['student', updatedStudent.id, preschoolId],
        updatedStudent
      );

      // Invalidate students list to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ['students', preschoolId],
      });
    },
    onError: (error: Error) => {
      console.error('Failed to update student:', error);
    },
  });
}

/**
 * Get preschool ID from auth context
 * Utility function for components that need the ID directly
 */
export function usePreschoolId(): string | null {
  const { profile } = useAuth();
  return (profile?.organization_id || profile?.preschool_id) as string | null;
}

/**
 * Check if user can edit students
 * @returns boolean indicating edit permission
 */
export function useCanEditStudents(): boolean {
  const { profile } = useAuth();
  const role = profile?.role;
  
  return (
    role === 'principal_admin' ||
    role === 'principal' ||
    role === 'admin' ||
    role === 'superadmin' ||
    role === 'teacher'
  );
}
