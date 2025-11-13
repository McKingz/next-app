/**
 * Grade REST API Client
 * 
 * Comprehensive client-side API functions for grade management with RBAC security,
 * proper validation, error handling, and educational workflow support.
 * 
 * This follows the same pattern as assignments.ts and submissions.ts.
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  CreateGradeRequest,
  UpdateGradeRequest,
  GradeListParams,
  Grade,
  GradeWithSubmission,
  GradeWithDetails,
  GradeListResponse,
  GradeStats,
  StudentGradeReport,
  BulkGradeRequest,
  BulkGradeResult,
  CreateGradeSchema,
  UpdateGradeSchema,
  GradeListParamsSchema,
  BulkGradeSchema
} from '../models/Grade';
import { GradeService } from '../services/GradeService';
import { withClientGuard } from '../security/clientGuards';
import { UserRole } from '../security/rbac';

// ====================================================================
// API CLIENT FUNCTIONS
// ====================================================================

/**
 * List grades with pagination and filtering
 * 
 * @param params - Query parameters for filtering and pagination
 * @returns Promise<GradeListResponse>
 */
export async function listGrades(params: GradeListParams = {}): Promise<GradeListResponse> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        // Validate parameters
        const validatedParams = GradeListParamsSchema.parse(params);
        
        // Create service and fetch grades
        const gradeService = new GradeService(supabase);
        const result = await gradeService.listGrades(
          validatedParams,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch grades');
        }

        return result.data!;

      } catch (error) {
        console.error('List grades API error:', error);
        throw error instanceof Error ? error : new Error('Failed to fetch grades');
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_list'
    }
  );
}

/**
 * Get grade by ID
 * 
 * @param gradeId - Grade ID to fetch
 * @param includeDetails - Whether to include detailed information
 * @returns Promise<Grade | GradeWithDetails | null>
 */
export async function getGrade(
  gradeId: string,
  includeDetails: boolean = false
): Promise<Grade | GradeWithDetails | null> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        const gradeService = new GradeService(supabase);
        const result = await gradeService.getGradeById(
          gradeId,
          user.id,
          profile.role as UserRole,
          profile.organization_id,
          includeDetails
        );

        if (!result.success) {
          if (result.code === 'GRADE_NOT_FOUND') {
            return null;
          }
          throw new Error(result.error || 'Failed to fetch grade');
        }

        return result.data!;

      } catch (error) {
        console.error('Get grade API error:', error);
        throw error instanceof Error ? error : new Error('Failed to fetch grade');
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_get'
    }
  );
}

/**
 * Create a new grade
 * 
 * @param gradeData - Grade creation data
 * @returns Promise<Grade>
 */
export async function createGrade(gradeData: CreateGradeRequest): Promise<Grade> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        // Validate grade data
        const validatedData = CreateGradeSchema.parse(gradeData);

        const gradeService = new GradeService(supabase);
        const result = await gradeService.createGrade(
          validatedData,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to create grade');
        }

        return result.data!;

      } catch (error) {
        console.error('Create grade API error:', error);
        throw error instanceof Error ? error : new Error('Failed to create grade');
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_create'
    }
  );
}

/**
 * Update an existing grade
 * 
 * @param gradeId - Grade ID to update
 * @param updateData - Grade update data
 * @returns Promise<Grade>
 */
export async function updateGrade(
  gradeId: string,
  updateData: UpdateGradeRequest
): Promise<Grade> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        // Validate update data
        const validatedData = UpdateGradeSchema.parse(updateData);

        const gradeService = new GradeService(supabase);
        const result = await gradeService.updateGrade(
          gradeId,
          validatedData,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to update grade');
        }

        return result.data!;

      } catch (error) {
        console.error('Update grade API error:', error);
        throw error instanceof Error ? error : new Error('Failed to update grade');
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_update'
    }
  );
}

/**
 * Delete a grade (soft delete)
 * 
 * @param gradeId - Grade ID to delete
 * @returns Promise<boolean>
 */
export async function deleteGrade(gradeId: string): Promise<boolean> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        const gradeService = new GradeService(supabase);
        const result = await gradeService.deleteGrade(
          gradeId,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to delete grade');
        }

        return true;

      } catch (error) {
        console.error('Delete grade API error:', error);
        throw error instanceof Error ? error : new Error('Failed to delete grade');
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_delete'
    }
  );
}

/**
 * Create multiple grades in bulk
 * 
 * @param bulkData - Bulk grade creation data
 * @returns Promise<BulkGradeResult>
 */
export async function createBulkGrades(bulkData: BulkGradeRequest): Promise<BulkGradeResult> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        // Validate bulk data
        const validatedData = BulkGradeSchema.parse(bulkData);

        const gradeService = new GradeService(supabase);
        const result = await gradeService.createBulkGrades(
          validatedData,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to create bulk grades');
        }

        return result.data!;

      } catch (error) {
        console.error('Create bulk grades API error:', error);
        throw error instanceof Error ? error : new Error('Failed to create bulk grades');
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_bulk_create'
    }
  );
}

/**
 * Publish or unpublish grades in bulk
 * 
 * @param gradeIds - Array of grade IDs
 * @param publish - Whether to publish (true) or unpublish (false)
 * @returns Promise<BulkGradeResult>
 */
export async function bulkPublishGrades(
  gradeIds: string[],
  publish: boolean
): Promise<BulkGradeResult> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        if (!Array.isArray(gradeIds) || gradeIds.length === 0) {
          throw new Error('Grade IDs array is required');
        }

        if (gradeIds.length > 100) {
          throw new Error('Cannot process more than 100 grades at once');
        }

        const gradeService = new GradeService(supabase);
        const result = await gradeService.bulkPublishGrades(
          gradeIds,
          publish,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to bulk publish grades');
        }

        return result.data!;

      } catch (error) {
        console.error('Bulk publish grades API error:', error);
        throw error instanceof Error ? error : new Error('Failed to bulk publish grades');
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_bulk_publish'
    }
  );
}

/**
 * Get grades for a specific assignment
 * 
 * @param assignmentId - Assignment ID
 * @param params - Optional query parameters
 * @returns Promise<GradeListResponse & { stats: GradeStats }>
 */
export async function getAssignmentGrades(
  assignmentId: string,
  params: Omit<GradeListParams, 'assignment_id'> = {}
): Promise<GradeListResponse & { stats: GradeStats }> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        const gradeParams = { ...params, assignment_id: assignmentId };
        const validatedParams = GradeListParamsSchema.parse(gradeParams);

        const gradeService = new GradeService(supabase);
        
        // Get grades and stats in parallel
        const [gradesResult, statsResult] = await Promise.all([
          gradeService.listGrades(
            validatedParams,
            user.id,
            profile.role as UserRole,
            profile.organization_id
          ),
          gradeService.getAssignmentStats(
            assignmentId,
            user.id,
            profile.role as UserRole,
            profile.organization_id
          )
        ]);

        if (!gradesResult.success) {
          throw new Error(gradesResult.error || 'Failed to fetch assignment grades');
        }

        if (!statsResult.success) {
          throw new Error(statsResult.error || 'Failed to fetch assignment stats');
        }

        return {
          ...gradesResult.data!,
          stats: statsResult.data!
        };

      } catch (error) {
        console.error('Get assignment grades API error:', error);
        throw error instanceof Error ? error : new Error('Failed to fetch assignment grades');
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_assignment'
    }
  );
}

/**
 * Get grades for a specific student
 * 
 * @param studentId - Student ID
 * @param params - Optional query parameters
 * @returns Promise<StudentGradeReport>
 */
export async function getStudentGrades(
  studentId: string,
  params: Omit<GradeListParams, 'student_id'> = {}
): Promise<StudentGradeReport> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        const gradeService = new GradeService(supabase);
        const result = await gradeService.getStudentGradeReport(
          studentId,
          user.id,
          profile.role as UserRole,
          profile.organization_id,
          params
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch student grades');
        }

        return result.data!;

      } catch (error) {
        console.error('Get student grades API error:', error);
        throw error instanceof Error ? error : new Error('Failed to fetch student grades');
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_student'
    }
  );
}

/**
 * Get course grade statistics
 * 
 * @param courseId - Course ID
 * @returns Promise<GradeStats>
 */
export async function getCourseGradeStats(courseId: string): Promise<GradeStats> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        const gradeService = new GradeService(supabase);
        const result = await gradeService.getCourseStats(
          courseId,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch course stats');
        }

        return result.data!;

      } catch (error) {
        console.error('Get course grade stats API error:', error);
        throw error instanceof Error ? error : new Error('Failed to fetch course grade stats');
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_course_stats'
    }
  );
}

/**
 * Get student progress in a course
 * 
 * @param courseId - Course ID
 * @param studentId - Student ID (optional, defaults to current user if student)
 * @returns Promise<StudentGradeReport>
 */
export async function getStudentCourseProgress(
  courseId: string,
  studentId?: string
): Promise<StudentGradeReport> {
  return withClientGuard(
    async ({ user, profile, supabase }) => {
      try {
        // If no studentId provided and user is a student, use current user
        const targetStudentId = studentId || 
          (profile.role === UserRole.STUDENT ? user.id : null);

        if (!targetStudentId) {
          throw new Error('Student ID is required');
        }

        const gradeService = new GradeService(supabase);
        const result = await gradeService.getStudentCourseProgress(
          courseId,
          targetStudentId,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch student course progress');
        }

        return result.data!;

      } catch (error) {
        console.error('Get student course progress API error:', error);
        throw error instanceof Error ? error : new Error('Failed to fetch student course progress');
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'grades_student_progress'
    }
  );
}

// ====================================================================
// EXPORT ALL FUNCTIONS
// ====================================================================

export const gradeAPI = {
  listGrades,
  getGrade,
  createGrade,
  updateGrade,
  deleteGrade,
  createBulkGrades,
  bulkPublishGrades,
  getAssignmentGrades,
  getStudentGrades,
  getCourseGradeStats,
  getStudentCourseProgress
};