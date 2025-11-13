/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Assignment Service Layer
 * 
 * Comprehensive service class for managing assignments with business logic,
 * data access, authorization checks, and educational workflow support.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  Assignment,
  AssignmentWithCourse,
  AssignmentWithSubmissions,
  CreateAssignmentRequest,
  UpdateAssignmentRequest,
  AssignmentListParams,
  AssignmentListResponse,
  AssignmentStats,
  AssignmentType,
  AssignmentStatus,
  getAssignmentStatus,
  canSubmitToAssignment,
  validateAttachments
} from '../models/Assignment';
import { UserRole } from '../security/rbac';

// ====================================================================
// SERVICE RESPONSE TYPES
// ====================================================================

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ====================================================================
// ASSIGNMENT SERVICE CLASS
// ====================================================================

export class AssignmentService {
  constructor(private supabase: SupabaseClient) {}

  // ================================================================
  // CREATE ASSIGNMENT
  // ================================================================

  async createAssignment(
    data: CreateAssignmentRequest,
    userId: string,
    userRole: UserRole,
    organizationId: string
  ): Promise<ServiceResponse<Assignment>> {
    try {
      // Authorization check - only instructors and admins can create assignments
      if (![UserRole.INSTRUCTOR, UserRole.ADMIN].includes(userRole)) {
        return {
          success: false,
          error: 'Insufficient permissions to create assignments',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Verify course exists and user has access
      const courseCheck = await this.supabase
        .from('courses')
        .select('id, instructor_id, organization_id, is_active')
        .eq('id', data.course_id)
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .single();

      if (courseCheck.error || !courseCheck.data) {
        return {
          success: false,
          error: 'Course not found or inaccessible',
          code: 'COURSE_NOT_FOUND'
        };
      }

      // Check course ownership for instructors
      if (userRole === UserRole.INSTRUCTOR && courseCheck.data.instructor_id !== userId) {
        return {
          success: false,
          error: 'Can only create assignments for your own courses',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Check if course is active
      if (!courseCheck.data.is_active) {
        return {
          success: false,
          error: 'Cannot create assignments for inactive courses',
          code: 'COURSE_INACTIVE'
        };
      }

      // Validate attachments if present
      if (data.attachments && data.attachments.length > 0) {
        const attachmentErrors = validateAttachments(data.attachments as any);
        if (attachmentErrors.length > 0) {
          return {
            success: false,
            error: attachmentErrors.join(', '),
            code: 'INVALID_ATTACHMENTS'
          };
        }
      }

      // Create assignment
      const { data: assignment, error } = await this.supabase
        .from('assignments')
        .insert([{
          title: data.title,
          description: data.description,
          instructions: data.instructions,
          course_id: data.course_id,
          assignment_type: data.assignment_type,
          max_points: data.max_points || 100,
          assigned_at: new Date().toISOString(),
          due_at: data.due_at,
          available_from: data.available_from || new Date().toISOString(),
          available_until: data.available_until,
          allow_late_submissions: data.allow_late_submissions ?? true,
          late_penalty_percent: data.late_penalty_percent || 0,
          max_attempts: data.max_attempts || 1,
          attachments: data.attachments || [],
          metadata: data.metadata || {},
        }])
        .select('*')
        .single();

      if (error) {
        console.error('Assignment creation error:', error);
        return {
          success: false,
          error: 'Failed to create assignment',
          code: 'CREATION_FAILED'
        };
      }

      return {
        success: true,
        data: assignment
      };

    } catch (error) {
      console.error('Assignment service error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // GET ASSIGNMENT BY ID
  // ================================================================

  async getAssignmentById(
    assignmentId: string,
    userId: string,
    userRole: UserRole,
    organizationId?: string,
    includeSubmissions: boolean = false
  ): Promise<ServiceResponse<AssignmentWithCourse | AssignmentWithSubmissions>> {
    try {
      let query = this.supabase
        .from('assignments')
        .select(`
          *,
          course:courses!assignments_course_id_fkey (
            id,
            title,
            course_code,
            instructor_id,
            organization_id,
            is_active
          )
        `)
        .eq('id', assignmentId)
        .is('deleted_at', null);

      const { data: assignment, error } = await query.single();

      if (error || !assignment) {
        return {
          success: false,
          error: 'Assignment not found',
          code: 'ASSIGNMENT_NOT_FOUND'
        };
      }

      // Authorization checks
      const canAccess = await this.canUserAccessAssignment(
        assignment,
        userId,
        userRole,
        organizationId
      );

      if (!canAccess) {
        return {
          success: false,
          error: 'Insufficient permissions to view assignment',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Include submission statistics if requested and user has permission
      if (includeSubmissions && [UserRole.INSTRUCTOR, UserRole.ADMIN].includes(userRole)) {
        const submissionsData = await this.getAssignmentSubmissionStats(assignmentId);
        
        return {
          success: true,
          data: {
            ...assignment,
            ...submissionsData
          } as AssignmentWithSubmissions
        };
      }

      return {
        success: true,
        data: assignment as AssignmentWithCourse
      };

    } catch (error) {
      console.error('Get assignment error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // LIST ASSIGNMENTS
  // ================================================================

  async listAssignments(
    params: AssignmentListParams,
    userId: string,
    userRole: UserRole,
    organizationId: string
  ): Promise<ServiceResponse<AssignmentListResponse>> {
    try {
      let query = this.supabase
        .from('assignments')
        .select(`
          *,
          course:courses!assignments_course_id_fkey (
            id,
            title,
            course_code,
            instructor_id,
            organization_id,
            is_active
          )
        `, { count: 'exact' })
        .is('deleted_at', null);

      // Apply organization filter
      query = query.eq('course.organization_id', organizationId);

      // Apply role-based access control
      if (userRole === UserRole.STUDENT) {
        // Students only see assignments from courses they're enrolled in
        const enrolledCourses = await this.getUserEnrolledCourses(userId);
        if (enrolledCourses.length === 0) {
          return {
            success: true,
            data: {
              assignments: [],
              pagination: {
                page: params.page || 1,
                limit: params.limit || 20,
                total: 0,
                total_pages: 0,
                has_next: false,
                has_previous: false
              }
            }
          };
        }
        query = query.in('course_id', enrolledCourses);
      } else if (userRole === UserRole.INSTRUCTOR) {
        // Instructors see assignments from their courses
        query = query.eq('course.instructor_id', userId);
      }
      // Admins see all assignments in the organization

      // Apply filters
      if (params.course_id) {
        query = query.eq('course_id', params.course_id);
      }

      if (params.assignment_type) {
        query = query.eq('assignment_type', params.assignment_type);
      }

      if (params.search) {
        query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`);
      }

      if (params.due_after) {
        query = query.gte('due_at', params.due_after);
      }

      if (params.due_before) {
        query = query.lte('due_at', params.due_before);
      }

      // Apply sorting
      const sortField = params.sort || 'due_at';
      const sortOrder = params.order || 'asc';
      query = query.order(sortField, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      query = query.range(offset, offset + limit - 1);

      const { data: assignments, error, count } = await query;

      if (error) {
        console.error('List assignments error:', error);
        return {
          success: false,
          error: 'Failed to fetch assignments',
          code: 'FETCH_FAILED'
        };
      }

      // Filter by status if requested (client-side filtering for computed status)
      let filteredAssignments = assignments || [];
      if (params.status) {
        filteredAssignments = filteredAssignments.filter(assignment => 
          getAssignmentStatus(assignment) === params.status
        );
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data: {
          assignments: filteredAssignments as AssignmentWithCourse[],
          pagination: {
            page,
            limit,
            total: totalCount,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_previous: page > 1
          }
        }
      };

    } catch (error) {
      console.error('List assignments error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // UPDATE ASSIGNMENT
  // ================================================================

  async updateAssignment(
    assignmentId: string,
    updates: UpdateAssignmentRequest,
    userId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<Assignment>> {
    try {
      // Get assignment with course info for authorization
      const assignmentResult = await this.getAssignmentById(assignmentId, userId, userRole);
      if (!assignmentResult.success || !assignmentResult.data) {
        return {
          success: false,
          error: 'Assignment not found',
          code: 'ASSIGNMENT_NOT_FOUND'
        };
      }

      const assignment = assignmentResult.data as AssignmentWithCourse;

      // Authorization check
      if (userRole === UserRole.INSTRUCTOR && assignment.course.instructor_id !== userId) {
        return {
          success: false,
          error: 'Can only update your own assignments',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      if (userRole === UserRole.STUDENT) {
        return {
          success: false,
          error: 'Students cannot update assignments',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Validate attachments if being updated
      if (updates.attachments && updates.attachments.length > 0) {
        const attachmentErrors = validateAttachments(updates.attachments);
        if (attachmentErrors.length > 0) {
          return {
            success: false,
            error: attachmentErrors.join(', '),
            code: 'INVALID_ATTACHMENTS'
          };
        }
      }

      // Check if assignment has submissions (restrict certain updates)
      const hasSubmissions = await this.assignmentHasSubmissions(assignmentId);
      if (hasSubmissions) {
        // Prevent changes to critical fields after submissions exist
        const restrictedFields = ['assignment_type', 'max_points', 'max_attempts'];
        const hasRestrictedChanges = restrictedFields.some(field => 
          updates[field as keyof UpdateAssignmentRequest] !== undefined
        );
        
        if (hasRestrictedChanges) {
          return {
            success: false,
            error: 'Cannot modify assignment type, points, or attempts after submissions exist',
            code: 'ASSIGNMENT_HAS_SUBMISSIONS'
          };
        }
      }

      // Update assignment
      const { data: updatedAssignment, error } = await this.supabase
        .from('assignments')
        .update(updates)
        .eq('id', assignmentId)
        .select('*')
        .single();

      if (error) {
        console.error('Assignment update error:', error);
        return {
          success: false,
          error: 'Failed to update assignment',
          code: 'UPDATE_FAILED'
        };
      }

      return {
        success: true,
        data: updatedAssignment
      };

    } catch (error) {
      console.error('Update assignment error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // DELETE ASSIGNMENT
  // ================================================================

  async deleteAssignment(
    assignmentId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ServiceResponse> {
    try {
      // Get assignment for authorization
      const assignmentResult = await this.getAssignmentById(assignmentId, userId, userRole);
      if (!assignmentResult.success || !assignmentResult.data) {
        return {
          success: false,
          error: 'Assignment not found',
          code: 'ASSIGNMENT_NOT_FOUND'
        };
      }

      const assignment = assignmentResult.data as AssignmentWithCourse;

      // Authorization check
      if (userRole === UserRole.INSTRUCTOR && assignment.course.instructor_id !== userId) {
        return {
          success: false,
          error: 'Can only delete your own assignments',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      if (userRole === UserRole.STUDENT) {
        return {
          success: false,
          error: 'Students cannot delete assignments',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Check if assignment has submissions
      const hasSubmissions = await this.assignmentHasSubmissions(assignmentId);
      if (hasSubmissions) {
        // Soft delete instead of hard delete
        const { error } = await this.supabase
          .from('assignments')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', assignmentId);

        if (error) {
          return {
            success: false,
            error: 'Failed to archive assignment',
            code: 'DELETE_FAILED'
          };
        }
      } else {
        // Hard delete if no submissions
        const { error } = await this.supabase
          .from('assignments')
          .delete()
          .eq('id', assignmentId);

        if (error) {
          return {
            success: false,
            error: 'Failed to delete assignment',
            code: 'DELETE_FAILED'
          };
        }
      }

      return { success: true };

    } catch (error) {
      console.error('Delete assignment error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // GET ASSIGNMENT STATISTICS
  // ================================================================

  async getAssignmentStats(
    userId: string,
    userRole: UserRole,
    organizationId: string,
    courseId?: string
  ): Promise<ServiceResponse<AssignmentStats>> {
    try {
      let query = this.supabase
        .from('assignments')
        .select(`
          *,
          course:courses!assignments_course_id_fkey (
            id,
            title,
            instructor_id,
            organization_id
          )
        `)
        .eq('course.organization_id', organizationId)
        .is('deleted_at', null);

      // Apply role-based filtering
      if (userRole === UserRole.INSTRUCTOR) {
        query = query.eq('course.instructor_id', userId);
      }

      if (courseId) {
        query = query.eq('course_id', courseId);
      }

      const { data: assignments, error } = await query;

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch assignment statistics',
          code: 'FETCH_FAILED'
        };
      }

      // Calculate statistics
      const totalAssignments = assignments?.length || 0;
      const now = new Date();

      const statusCounts = {
        active: 0,
        upcoming: 0,
        overdue: 0,
      };

      const typeCounts: Record<AssignmentType, number> = {
        homework: 0,
        quiz: 0,
        exam: 0,
        project: 0,
        lab: 0,
        discussion: 0,
      };

      const courseCounts: { [key: string]: { course_id: string; course_title: string; assignment_count: number; } } = {};

      assignments?.forEach(assignment => {
        const status = getAssignmentStatus(assignment);
        if (status in statusCounts) {
          statusCounts[status as keyof typeof statusCounts]++;
        }

        typeCounts[assignment.assignment_type]++;

        const courseId = assignment.course.id;
        if (!courseCounts[courseId]) {
          courseCounts[courseId] = {
            course_id: courseId,
            course_title: assignment.course.title,
            assignment_count: 0,
          };
        }
        courseCounts[courseId].assignment_count++;
      });

      // Get submission statistics
      const submissionStats = await this.getOrganizationSubmissionStats(organizationId, userRole, userId);

      return {
        success: true,
        data: {
          total_assignments: totalAssignments,
          active_assignments: statusCounts.active,
          upcoming_assignments: statusCounts.upcoming,
          overdue_assignments: statusCounts.overdue,
          assignments_by_type: typeCounts,
          assignments_by_course: Object.values(courseCounts),
          average_completion_rate: submissionStats.completionRate || 0,
          average_score: submissionStats.averageScore || 0,
        }
      };

    } catch (error) {
      console.error('Assignment stats error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // HELPER METHODS
  // ================================================================

  private async canUserAccessAssignment(
    assignment: AssignmentWithCourse,
    userId: string,
    userRole: UserRole,
    organizationId?: string
  ): Promise<boolean> {
    // Admins can access all assignments in their organization
    if (userRole === UserRole.ADMIN && assignment.course.organization_id === organizationId) {
      return true;
    }

    // Instructors can access assignments in their courses
    if (userRole === UserRole.INSTRUCTOR && assignment.course.instructor_id === userId) {
      return true;
    }

    // Students can access assignments from courses they're enrolled in
    if (userRole === UserRole.STUDENT) {
      const enrolledCourses = await this.getUserEnrolledCourses(userId);
      return enrolledCourses.includes(assignment.course_id);
    }

    return false;
  }

  private async getUserEnrolledCourses(userId: string): Promise<string[]> {
    const { data: enrollments } = await this.supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', userId)
      .eq('is_active', true);

    return enrollments?.map(e => e.course_id) || [];
  }

  private async assignmentHasSubmissions(assignmentId: string): Promise<boolean> {
    const { count } = await this.supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId);

    return (count || 0) > 0;
  }

  private async getAssignmentSubmissionStats(assignmentId: string) {
    const { data: submissions } = await this.supabase
      .from('submissions')
      .select(`
        *,
        student:profiles!submissions_student_id_fkey (
          id,
          first_name,
          last_name,
          email
        ),
        grade:grades (
          points_earned,
          points_possible,
          percentage
        )
      `)
      .eq('assignment_id', assignmentId)
      .eq('is_draft', false);

    const submissionsCount = submissions?.length || 0;
    const gradedCount = submissions?.filter(s => s.grade?.length > 0).length || 0;
    
    const scores = submissions?.map(s => s.grade?.[0]?.percentage).filter(Boolean) || [];
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : undefined;

    return {
      submissions_count: submissionsCount,
      graded_count: gradedCount,
      average_score: averageScore,
      submissions: submissions?.map(s => ({
        id: s.id,
        student: s.student,
        submitted_at: s.submitted_at,
        is_late: s.is_late,
        is_graded: s.grade?.length > 0,
        grade: s.grade?.[0]?.points_earned,
        percentage: s.grade?.[0]?.percentage,
      })),
    };
  }

  private async getOrganizationSubmissionStats(
    organizationId: string,
    userRole: UserRole,
    userId: string
  ): Promise<{ completionRate: number; averageScore: number }> {
    try {
      let query = this.supabase
        .from('submissions')
        .select(`
          *,
          assignment:assignments!submissions_assignment_id_fkey (
            course:courses!assignments_course_id_fkey (
              organization_id,
              instructor_id
            )
          ),
          grade:grades (
            percentage
          )
        `)
        .eq('assignment.course.organization_id', organizationId)
        .eq('is_draft', false);

      if (userRole === UserRole.INSTRUCTOR) {
        query = query.eq('assignment.course.instructor_id', userId);
      }

      const { data: submissions } = await query;

      if (!submissions || submissions.length === 0) {
        return { completionRate: 0, averageScore: 0 };
      }

      const gradedSubmissions = submissions.filter(s => s.grade?.length > 0);
      const completionRate = (gradedSubmissions.length / submissions.length) * 100;

      const scores = gradedSubmissions.map(s => s.grade[0]?.percentage).filter(Boolean);
      const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      return { completionRate, averageScore };

    } catch (error) {
      console.error('Submission stats error:', error);
      return { completionRate: 0, averageScore: 0 };
    }
  }
}