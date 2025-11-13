/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Assignment REST API Endpoints
 * 
 * Comprehensive RESTful API for assignment management with RBAC security,
 * proper validation, error handling, and educational workflow support.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import {
  CreateAssignmentRequest,
  UpdateAssignmentRequest,
  AssignmentListParams,
  CreateAssignmentSchema,
  UpdateAssignmentSchema,
  AssignmentListParamsSchema
} from '../models/Assignment';
import { AssignmentService } from '../services/AssignmentService';
import { withRouteGuard } from '../security/routeGuards';
import { UserRole } from '../security/rbac';

// ====================================================================
// API ROUTE HANDLERS
// ====================================================================

/**
 * GET /api/assignments - List assignments with pagination and filtering
 * 
 * Query parameters:
 * - course_id?: string (filter by specific course)
 * - assignment_type?: AssignmentType (filter by type)
 * - status?: AssignmentStatus (filter by status)  
 * - search?: string (search in title/description)
 * - due_after?: string (assignments due after date)
 * - due_before?: string (assignments due before date)
 * - page?: number (default: 1)
 * - limit?: number (default: 20, max: 100)
 * - sort?: 'due_at'|'assigned_at'|'title'|'max_points' (default: 'due_at')
 * - order?: 'asc'|'desc' (default: 'asc')
 */
export async function listAssignments(request: NextRequest) {
  return withRouteGuard(
    async ({ user, profile, supabase, data }) => {
      try {
        // Validate query parameters
        const url = new URL(request.url);
        const rawParams = Object.fromEntries(url.searchParams.entries());
        
        // Convert numeric strings to numbers
        if (rawParams.page) rawParams.page = parseInt(rawParams.page) as any;
        if (rawParams.limit) rawParams.limit = parseInt(rawParams.limit) as any;
        
        const params = AssignmentListParamsSchema.parse(rawParams);
        
        // Create service and fetch assignments
        const assignmentService = new AssignmentService(supabase);
        const result = await assignmentService.listAssignments(
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
        console.error('List assignments API error:', error);
        return NextResponse.json(
          { error: 'Invalid request parameters' },
          { status: 400 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'assignments_list'
    }
  )(request);
}

/**
 * POST /api/assignments - Create a new assignment
 * 
 * Body: CreateAssignmentRequest
 */
export async function createAssignment(request: NextRequest) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const body = await request.json();
        const assignmentData = CreateAssignmentSchema.parse(body);

        const assignmentService = new AssignmentService(supabase);
        const result = await assignmentService.createAssignment(
          assignmentData,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'INSUFFICIENT_PERMISSIONS': 403,
            'COURSE_NOT_FOUND': 404,
            'COURSE_INACTIVE': 400,
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
          assignment: result.data
        }, { status: 201 });

      } catch (error) {
        console.error('Create assignment API error:', error);
        return NextResponse.json(
          { error: 'Invalid request data' },
          { status: 400 }
        );
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'assignments_create'
    }
  )(request);
}

/**
 * GET /api/assignments/[id] - Get assignment by ID with optional submission stats
 * 
 * Query parameters:
 * - include_submissions?: boolean (include submission statistics - instructors/admins only)
 */
export async function getAssignment(
  request: NextRequest, 
  context: { params: { id: string } }
) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const assignmentId = context.params.id;
        const url = new URL(request.url);
        const includeSubmissions = url.searchParams.get('include_submissions') === 'true';

        const assignmentService = new AssignmentService(supabase);
        const result = await assignmentService.getAssignmentById(
          assignmentId,
          user.id,
          profile.role as UserRole,
          profile.organization_id,
          includeSubmissions
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'ASSIGNMENT_NOT_FOUND': 404,
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
          assignment: result.data
        });

      } catch (error) {
        console.error('Get assignment API error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requiredRoles: [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'assignments_get'
    }
  )(request);
}

/**
 * PATCH /api/assignments/[id] - Update assignment
 * 
 * Body: UpdateAssignmentRequest
 */
export async function updateAssignment(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const assignmentId = context.params.id;
        const body = await request.json();
        const updates = UpdateAssignmentSchema.parse(body);

        const assignmentService = new AssignmentService(supabase);
        const result = await assignmentService.updateAssignment(
          assignmentId,
          updates,
          user.id,
          profile.role as UserRole
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'ASSIGNMENT_NOT_FOUND': 404,
            'INSUFFICIENT_PERMISSIONS': 403,
            'INVALID_ATTACHMENTS': 400,
            'ASSIGNMENT_HAS_SUBMISSIONS': 409,
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
          assignment: result.data
        });

      } catch (error) {
        console.error('Update assignment API error:', error);
        return NextResponse.json(
          { error: 'Invalid request data' },
          { status: 400 }
        );
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'assignments_update'
    }
  )(request);
}

/**
 * DELETE /api/assignments/[id] - Delete (archive) assignment
 * 
 * Soft deletes assignments that have submissions, hard deletes otherwise.
 */
export async function deleteAssignment(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const assignmentId = context.params.id;

        const assignmentService = new AssignmentService(supabase);
        const result = await assignmentService.deleteAssignment(
          assignmentId,
          user.id,
          profile.role as UserRole
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'ASSIGNMENT_NOT_FOUND': 404,
            'INSUFFICIENT_PERMISSIONS': 403,
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
          message: 'Assignment deleted successfully'
        });

      } catch (error) {
        console.error('Delete assignment API error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'assignments_delete'
    }
  )(request);
}

/**
 * GET /api/assignments/stats - Get assignment statistics
 * 
 * Query parameters:
 * - course_id?: string (filter by specific course)
 */
export async function getAssignmentStats(request: NextRequest) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const url = new URL(request.url);
        const courseId = url.searchParams.get('course_id') || undefined;

        const assignmentService = new AssignmentService(supabase);
        const result = await assignmentService.getAssignmentStats(
          user.id,
          profile.role as UserRole,
          profile.organization_id,
          courseId
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
        console.error('Assignment stats API error:', error);
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'assignments_stats'
    }
  )(request);
}

/**
 * POST /api/assignments/[id]/duplicate - Duplicate an assignment
 * 
 * Body: { course_id?: string, title_suffix?: string }
 */
export async function duplicateAssignment(
  request: NextRequest,
  context: { params: { id: string } }
) {
  return withRouteGuard(
    async ({ user, profile, supabase }) => {
      try {
        const assignmentId = context.params.id;
        const body = await request.json();
        const { course_id, title_suffix = ' (Copy)' } = body;

        // Get the original assignment
        const assignmentService = new AssignmentService(supabase);
        const originalResult = await assignmentService.getAssignmentById(
          assignmentId,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!originalResult.success || !originalResult.data) {
          return NextResponse.json(
            { error: 'Assignment not found' },
            { status: 404 }
          );
        }

        const original = originalResult.data;

        // Create duplicate assignment data
        const duplicateData: CreateAssignmentRequest = {
          title: original.title + title_suffix,
          description: original.description,
          instructions: original.instructions,
          course_id: course_id || original.course_id,
          assignment_type: original.assignment_type,
          max_points: original.max_points,
          allow_late_submissions: original.allow_late_submissions,
          late_penalty_percent: original.late_penalty_percent,
          max_attempts: original.max_attempts,
          attachments: original.attachments,
          metadata: original.metadata,
        };

        // Create the duplicate
        const result = await assignmentService.createAssignment(
          duplicateData,
          user.id,
          profile.role as UserRole,
          profile.organization_id
        );

        if (!result.success) {
          const statusMap: Record<string, number> = {
            'INSUFFICIENT_PERMISSIONS': 403,
            'COURSE_NOT_FOUND': 404,
            'COURSE_INACTIVE': 400,
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
          assignment: result.data,
          message: 'Assignment duplicated successfully'
        }, { status: 201 });

      } catch (error) {
        console.error('Duplicate assignment API error:', error);
        return NextResponse.json(
          { error: 'Invalid request data' },
          { status: 400 }
        );
      }
    },
    {
      requiredRoles: [UserRole.INSTRUCTOR, UserRole.ADMIN],
      rateLimitKey: 'assignments_duplicate'
    }
  )(request);
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Validate assignment ID parameter
 */
function validateAssignmentId(id: string): boolean {
  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Handle assignment API errors with appropriate status codes
 */
function handleAssignmentError(error: any, operation: string) {
  console.error(`Assignment ${operation} error:`, error);
  
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
  listAssignments as GET,
  createAssignment as POST,
  getAssignment,
  updateAssignment as PATCH,
  deleteAssignment as DELETE,
  getAssignmentStats,
  duplicateAssignment,
};