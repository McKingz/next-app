/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Submission REST API Endpoints
 * 
 * Comprehensive RESTful API for submission management with RBAC security,
 * proper validation, error handling, and educational workflow support.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import {
  CreateSubmissionRequest,
  UpdateSubmissionRequest,
  SubmissionListParams,
  CreateSubmissionSchema,
  UpdateSubmissionSchema,
  SubmissionListParamsSchema
} from '../models/Submission';
import { SubmissionService } from '../services/SubmissionService';
import { withRouteGuard } from '../security/routeGuards';
import { UserRole } from '../security/rbac';

// ====================================================================
// API ROUTE HANDLERS
// ====================================================================

/**
 * GET /api/submissions - List submissions with pagination and filtering
 * 
 * Query parameters:
 * - assignment_id?: string (filter by assignment)
 * - student_id?: string (filter by student - instructors/admins only)
 * - course_id?: string (filter by course)
 * - submission_type?: SubmissionType (filter by type)
 * - status?: SubmissionStatus (filter by status)
 * - is_late?: boolean (filter late submissions)
 * - is_draft?: boolean (filter draft submissions)
 * - has_grade?: boolean (filter graded submissions)
 * - search?: string (search in content/assignment title)
 * - submitted_after?: string (submissions after date)
 * - submitted_before?: string (submissions before date)
 * - page?: number (default: 1)
 * - limit?: number (default: 20, max: 100)
 * - sort?: 'submitted_at'|'created_at'|'student_name'|'assignment_title' (default: 'submitted_at')
 * - order?: 'asc'|'desc' (default: 'desc')
 */
export async function listSubmissions(request: NextRequest) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        // Validate query parameters
        const url = new URL(request.url);
        const rawParams = Object.fromEntries(url.searchParams.entries());
        
        // Convert boolean and numeric strings
        if (rawParams.is_late) rawParams.is_late = rawParams.is_late === 'true' as any;
        if (rawParams.is_draft) rawParams.is_draft = rawParams.is_draft === 'true' as any;
        if (rawParams.has_grade) rawParams.has_grade = rawParams.has_grade === 'true' as any;
        if (rawParams.page) rawParams.page = parseInt(rawParams.page) as any;
        if (rawParams.limit) rawParams.limit = parseInt(rawParams.limit) as any;
        
        const params = SubmissionListParamsSchema.parse(rawParams);
        
        // Create service and fetch submissions
        const submissionService = new SubmissionService(supabase);
        const result = await submissionService.listSubmissions(
          params,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'INSUFFICIENT_PERMISSIONS': 403,
            'FETCH_FAILED': 500,
            'INTERNAL_ERROR': 500,
          };

          return NextResponse.json(
            { error: result.error },
            { status: statusMap[result.code || ''] || 400 }
          );
        }

        return NextResponse.json({
          success: true,
          ...result.data
        });

      } catch (error) {
        console.error('List submissions API error:', error);
        return NextResponse.json(
          { error: 'Invalid request parameters' },
          { status: 400 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'submissions_list'
    }
  )(request);
}

/**
 * POST /api/submissions - Create a new submission
 * 
 * Body: CreateSubmissionRequest
 */
export async function createSubmission(request: NextRequest) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const body = await request.json();
        const submissionData = CreateSubmissionSchema.parse(body);

        const submissionService = new SubmissionService(supabase);
        const result = await submissionService.createSubmission(
          submissionData,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'INSUFFICIENT_PERMISSIONS': 403,
            'ASSIGNMENT_NOT_FOUND': 404,
            'COURSE_INACTIVE': 400,
            'NOT_ENROLLED': 403,
            'ASSIGNMENT_CLOSED': 400,
            'CONSTRAINT_VIOLATION': 400,
            'INVALID_ATTACHMENTS': 400,
            'CREATION_FAILED': 500,
            'INTERNAL_ERROR': 500,
          };

          return NextResponse.json(
            { error: result.error },
            { status: statusMap[result.code || ''] || 400 }
          );
        }

        return NextResponse.json({
          success: true,
          submission: result.data
        }, { status: 201 });

      } catch (error) {
        console.error('Create submission API error:', error);
        return NextResponse.json(
          { error: 'Invalid request data' },
          { status: 400 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.ADMIN],
      rateLimitKey: 'submissions_create'
    }
  )(request);
}

/**
 * GET /api/submissions/[id] - Get submission by ID with optional grade info
 * 
 * Query parameters:
 * - include_grade?: boolean (include grade information if available)
 */
export async function getSubmission(
  request: NextRequest, 
  context: { params: { id: string } }
) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const submissionId = context.params.id;
        const url = new URL(request.url);
        const includeGrade = url.searchParams.get('include_grade') === 'true';

        const submissionService = new SubmissionService(supabase);
        const result = await submissionService.getSubmissionById(
          submissionId,
          user.id,
          profile.role as UserRole,
          profile.organization_id,
          includeGrade
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'SUBMISSION_NOT_FOUND': 404,
            'INSUFFICIENT_PERMISSIONS': 403,
            'INTERNAL_ERROR': 500,
          };

          return NextResponse.json(
            { error: result.error },
            { status: statusMap[result.code || ''] || 400 }
          );
        }

        return NextResponse.json({
          success: true,
          submission: result.data
        });

      } catch (error) {
        console.error('Get submission API error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'submissions_get'
    }
  )(request);
}

/**
 * PATCH /api/submissions/[id] - Update submission
 * 
 * Body: UpdateSubmissionRequest
 */
export async function updateSubmission(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const submissionId = context.params.id;
        const body = await request.json();
        const updates = UpdateSubmissionSchema.parse(body);

        const submissionService = new SubmissionService(supabase);
        const result = await submissionService.updateSubmission(
          submissionId,
          updates,
          user.id,
          profile.role as UserRole
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'SUBMISSION_NOT_FOUND': 404,
            'INSUFFICIENT_PERMISSIONS': 403,
            'SUBMISSION_GRADED': 409,
            'ASSIGNMENT_CLOSED': 400,
            'INVALID_ATTACHMENTS': 400,
            'UPDATE_FAILED': 500,
            'INTERNAL_ERROR': 500,
          };

          return NextResponse.json(
            { error: result.error },
            { status: statusMap[result.code || ''] || 400 }
          );
        }

        return NextResponse.json({
          success: true,
          submission: result.data
        });

      } catch (error) {
        console.error('Update submission API error:', error);
        return NextResponse.json(
          { error: 'Invalid request data' },
          { status: 400 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'submissions_update'
    }
  )(request);
}

/**
 * DELETE /api/submissions/[id] - Delete submission
 * 
 * Only allowed for draft submissions or submissions without grades.
 */
export async function deleteSubmission(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const submissionId = context.params.id;

        const submissionService = new SubmissionService(supabase);
        const result = await submissionService.deleteSubmission(
          submissionId,
          user.id,
          profile.role as UserRole
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'SUBMISSION_NOT_FOUND': 404,
            'INSUFFICIENT_PERMISSIONS': 403,
            'SUBMISSION_GRADED': 409,
            'DELETE_FAILED': 500,
            'INTERNAL_ERROR': 500,
          };

          return NextResponse.json(
            { error: result.error },
            { status: statusMap[result.code || ''] || 400 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Submission deleted successfully'
        });

      } catch (error) {
        console.error('Delete submission API error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'submissions_delete'
    }
  )(request);
}

/**
 * GET /api/submissions/stats - Get submission statistics
 * 
 * Query parameters:
 * - course_id?: string (filter by specific course)
 * - assignment_id?: string (filter by specific assignment)
 */
export async function getSubmissionStats(request: NextRequest) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const url = new URL(request.url);
        const courseId = url.searchParams.get('course_id') || undefined;
        const assignmentId = url.searchParams.get('assignment_id') || undefined;

        const submissionService = new SubmissionService(supabase);
        const result = await submissionService.getSubmissionStats(
          user.id,
          profile.role as UserRole,
          profile.organization_id,
          courseId,
          assignmentId
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'INSUFFICIENT_PERMISSIONS': 403,
            'FETCH_FAILED': 500,
            'INTERNAL_ERROR': 500,
          };

          return NextResponse.json(
            { error: result.error },
            { status: statusMap[result.code || ''] || 400 }
          );
        }

        return NextResponse.json({
          success: true,
          stats: result.data
        });

      } catch (error) {
        console.error('Submission stats API error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'submissions_stats'
    }
  )(request);
}

/**
 * GET /api/assignments/[id]/submissions - Get all submissions for an assignment
 * 
 * Instructors and admins can view all submissions for an assignment.
 * Students can only view their own submission.
 */
export async function getSubmissionsByAssignment(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const assignmentId = context.params.id;

        const submissionService = new SubmissionService(supabase);
        const result = await submissionService.getSubmissionsByAssignment(
          assignmentId,
          user.id,
          profile.role as UserRole
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'ASSIGNMENT_NOT_FOUND': 404,
            'INSUFFICIENT_PERMISSIONS': 403,
            'FETCH_FAILED': 500,
            'INTERNAL_ERROR': 500,
          };

          return NextResponse.json(
            { error: result.error },
            { status: statusMap[result.code || ''] || 400 }
          );
        }

        // For students, filter to show only their own submission
        let submissions = result.data;
        if (profile.role === UserRole.STUDENT) {
          submissions = submissions.filter(s => s.student.id === user.id);
        }

        return NextResponse.json({
          success: true,
          submissions,
          assignment_id: assignmentId
        });

      } catch (error) {
        console.error('Get submissions by assignment API error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'submissions_by_assignment'
    }
  )(request);
}

/**
 * POST /api/submissions/[id]/finalize - Convert draft to final submission
 * 
 * Special endpoint to finalize a draft submission.
 */
export async function finalizeSubmission(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const submissionId = context.params.id;

        const submissionService = new SubmissionService(supabase);
        const result = await submissionService.updateSubmission(
          submissionId,
          { is_draft: false },
          user.id,
          profile.role as UserRole
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'SUBMISSION_NOT_FOUND': 404,
            'INSUFFICIENT_PERMISSIONS': 403,
            'SUBMISSION_GRADED': 409,
            'ASSIGNMENT_CLOSED': 400,
            'UPDATE_FAILED': 500,
            'INTERNAL_ERROR': 500,
          };

          return NextResponse.json(
            { error: result.error },
            { status: statusMap[result.code || ''] || 400 }
          );
        }

        return NextResponse.json({
          success: true,
          submission: result.data,
          message: 'Submission finalized successfully'
        });

      } catch (error) {
        console.error('Finalize submission API error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.ADMIN],
      rateLimitKey: 'submissions_finalize'
    }
  )(request);
}

/**
 * GET /api/assignments/[assignmentId]/submissions/[studentId] - Get student's submission for assignment
 * 
 * Convenient endpoint to get a specific student's latest submission for an assignment.
 */
export async function getStudentSubmissionForAssignment(
  request: NextRequest,
  context: { params: { assignmentId: string; studentId: string } }
) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const { assignmentId, studentId } = context.params;

        // Authorization check
        if (profile.role === UserRole.STUDENT && user.id !== studentId) {
          return NextResponse.json(
            { error: 'Can only view your own submissions' },
            { status: 403 }
          );
        }

        const submissionService = new SubmissionService(supabase);
        const submission = await submissionService.getStudentSubmission(
          assignmentId,
          studentId
        );

        if (!submission) {
          return NextResponse.json(
            { error: 'No submission found' },
            { status: 404 }
          );
        }

        // Get full submission details
        const result = await submissionService.getSubmissionById(
          submission.id,
          user.id,
          profile.role as UserRole,
          profile.organization_id,
          true // Include grade
        );

        if (!result.success) {
          return NextResponse.json(
            { error: result.error },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          submission: result.data
        });

      } catch (error) {
        console.error('Get student submission API error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'submissions_student_assignment'
    }
  )(request);
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Validate submission ID parameter
 */
function validateSubmissionId(id: string): boolean {
  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Handle submission API errors with appropriate status codes
 */
function handleSubmissionError(error: any, operation: string) {
  console.error(`Submission ${operation} error:`, error);
  
  if (error.name === 'ZodError') {
    return NextResponse.json(
      { 
        error: 'Validation error',
        details: error.errors 
      },
      { status: 400 }
    );
  }
  
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

// ====================================================================
// EXPORT ROUTE HANDLERS FOR NEXT.JS APP ROUTER
// ====================================================================

export {
  listSubmissions as GET,
  createSubmission as POST,
  getSubmission,
  updateSubmission as PATCH,
  deleteSubmission as DELETE,
  getSubmissionStats,
  getSubmissionsByAssignment,
  finalizeSubmission,
  getStudentSubmissionForAssignment,
};