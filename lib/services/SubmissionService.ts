/**
 * Submission Service Layer
 * 
 * Comprehensive service class for managing submissions with business logic,
 * data access, authorization checks, and educational workflow support.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  Submission,
  SubmissionWithAssignment,
  SubmissionWithGrade,
  SubmissionWithStudent,
  CreateSubmissionRequest,
  UpdateSubmissionRequest,
  SubmissionListParams,
  SubmissionListResponse,
  SubmissionStats,
  SubmissionType,
  SubmissionStatus,
  getSubmissionStatus,
  isSubmissionLate,
  calculateSubmissionTiming,
  validateSubmissionConstraints,
  validateSubmissionAttachments
} from '../models/Submission';
import { UserRole } from '../security/rbac';
import { canSubmitToAssignment } from '../models/Assignment';
import type { Assignment } from '../models/Assignment';

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
// SUBMISSION SERVICE CLASS
// ====================================================================

export class SubmissionService {
  constructor(private supabase: SupabaseClient) {}

  // ================================================================
  // CREATE SUBMISSION
  // ================================================================

  async createSubmission(
    data: CreateSubmissionRequest,
    userId: string,
    userRole: UserRole,
    organizationId: string
  ): Promise<ServiceResponse<Submission>> {
    try {
      // Only students can create submissions (unless admin is helping)
      if (![UserRole.STUDENT, UserRole.ADMIN].includes(userRole)) {
        return {
          success: false,
          error: 'Only students can submit assignments',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Get assignment with course info for validation
      const assignmentResult = await this.supabase
        .from('assignments')
        .select(`
          *,
          course:courses!assignments_course_id_fkey (
            id,
            title,
            instructor_id,
            organization_id,
            is_active
          )
        `)
        .eq('id', data.assignment_id)
        .eq('course.organization_id', organizationId)
        .is('deleted_at', null)
        .single();

      if (assignmentResult.error || !assignmentResult.data) {
        return {
          success: false,
          error: 'Assignment not found or inaccessible',
          code: 'ASSIGNMENT_NOT_FOUND'
        };
      }

      const assignment = assignmentResult.data;

      // Check if course is active
      if (!assignment.course.is_active) {
        return {
          success: false,
          error: 'Cannot submit to assignments in inactive courses',
          code: 'COURSE_INACTIVE'
        };
      }

      // Check if student is enrolled in the course
      if (userRole === UserRole.STUDENT) {
        const enrollmentCheck = await this.supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', userId)
          .eq('course_id', assignment.course_id)
          .eq('is_active', true)
          .single();

        if (enrollmentCheck.error || !enrollmentCheck.data) {
          return {
            success: false,
            error: 'You must be enrolled in this course to submit',
            code: 'NOT_ENROLLED'
          };
        }
      }

      // Check if assignment accepts submissions
      if (!canSubmitToAssignment(assignment)) {
        return {
          success: false,
          error: 'Assignment is not currently accepting submissions',
          code: 'ASSIGNMENT_CLOSED'
        };
      }

      // Get current attempt number
      const currentAttempt = await this.getNextAttemptNumber(data.assignment_id, userId);

      // Validate submission constraints
      const constraintErrors = validateSubmissionConstraints(
        data,
        assignment,
        currentAttempt
      );

      if (constraintErrors.length > 0) {
        return {
          success: false,
          error: constraintErrors.join(', '),
          code: 'CONSTRAINT_VIOLATION'
        };
      }

      // Validate attachments
      if (data.attachments && data.attachments.length > 0) {
        const attachmentErrors = validateSubmissionAttachments(data.attachments as any);
        if (attachmentErrors.length > 0) {
          return {
            success: false,
            error: attachmentErrors.join(', '),
            code: 'INVALID_ATTACHMENTS'
          };
        }
      }

      // Calculate if submission is late
      const now = new Date();
      const isLate = isSubmissionLate(now, assignment.due_at);

      // Create submission
      const { data: submission, error } = await this.supabase
        .from('submissions')
        .insert([{
          assignment_id: data.assignment_id,
          student_id: userId,
          content: data.content,
          attachments: data.attachments || [],
          submission_type: data.submission_type,
          attempt_number: currentAttempt,
          submitted_at: now.toISOString(),
          is_late: !data.is_draft && isLate,
          is_draft: data.is_draft || false,
          ai_assistance_used: data.ai_assistance_used || false,
          ai_assistance_details: data.ai_assistance_details || {},
          metadata: data.metadata || {},
        }])
        .select('*')
        .single();

      if (error) {
        console.error('Submission creation error:', error);
        return {
          success: false,
          error: 'Failed to create submission',
          code: 'CREATION_FAILED'
        };
      }

      return {
        success: true,
        data: submission
      };

    } catch (error) {
      console.error('Submission service error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // GET SUBMISSION BY ID
  // ================================================================

  async getSubmissionById(
    submissionId: string,
    userId: string,
    userRole: UserRole,
    organizationId?: string,
    includeGrade: boolean = false
  ): Promise<ServiceResponse<SubmissionWithAssignment | SubmissionWithGrade>> {
    try {
      let query = this.supabase
        .from('submissions')
        .select(`
          *,
          assignment:assignments!submissions_assignment_id_fkey (
            id,
            title,
            assignment_type,
            max_points,
            due_at,
            max_attempts,
            allow_late_submissions,
            late_penalty_percent,
            course:courses!assignments_course_id_fkey (
              id,
              title,
              course_code,
              instructor_id,
              organization_id,
              is_active
            )
          )
        `)
        .eq('id', submissionId);

      const { data: submission, error } = await query.single();

      if (error || !submission) {
        return {
          success: false,
          error: 'Submission not found',
          code: 'SUBMISSION_NOT_FOUND'
        };
      }

      // Authorization checks
      const canAccess = await this.canUserAccessSubmission(
        submission,
        userId,
        userRole,
        organizationId
      );

      if (!canAccess) {
        return {
          success: false,
          error: 'Insufficient permissions to view submission',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Include grade if requested and user has permission
      if (includeGrade && [UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.STUDENT].includes(userRole)) {
        const gradeResult = await this.supabase
          .from('grades')
          .select(`
            id,
            points_earned,
            points_possible,
            percentage,
            letter_grade,
            feedback,
            is_published,
            graded_by,
            created_at
          `)
          .eq('submission_id', submissionId)
          .single();

        if (gradeResult.data) {
          // Students can only see published grades
          if (userRole === UserRole.STUDENT && !gradeResult.data.is_published) {
            return {
              success: true,
              data: submission as SubmissionWithAssignment
            };
          }

          return {
            success: true,
            data: {
              ...submission,
              grade: gradeResult.data
            } as SubmissionWithGrade
          };
        }
      }

      return {
        success: true,
        data: submission as SubmissionWithAssignment
      };

    } catch (error) {
      console.error('Get submission error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // LIST SUBMISSIONS
  // ================================================================

  async listSubmissions(
    params: SubmissionListParams,
    userId: string,
    userRole: UserRole,
    organizationId: string
  ): Promise<ServiceResponse<SubmissionListResponse>> {
    try {
      let query = this.supabase
        .from('submissions')
        .select(`
          *,
          assignment:assignments!submissions_assignment_id_fkey (
            id,
            title,
            assignment_type,
            max_points,
            due_at,
            max_attempts,
            allow_late_submissions,
            late_penalty_percent,
            course:courses!assignments_course_id_fkey (
              id,
              title,
              course_code,
              instructor_id,
              organization_id,
              is_active
            )
          ),
          student:profiles!submissions_student_id_fkey (
            id,
            first_name,
            last_name,
            email
          ),
          grade:grades (
            points_earned,
            points_possible,
            percentage,
            letter_grade,
            is_published
          )
        `, { count: 'exact' });

      // Apply organization filter
      query = query.eq('assignment.course.organization_id', organizationId);

      // Apply role-based access control
      if (userRole === UserRole.STUDENT) {
        // Students only see their own submissions
        query = query.eq('student_id', userId);
      } else if (userRole === UserRole.INSTRUCTOR) {
        // Instructors see submissions from their courses
        query = query.eq('assignment.course.instructor_id', userId);
      }
      // Admins see all submissions in the organization

      // Apply filters
      if (params.assignment_id) {
        query = query.eq('assignment_id', params.assignment_id);
      }

      if (params.student_id) {
        query = query.eq('student_id', params.student_id);
      }

      if (params.course_id) {
        query = query.eq('assignment.course_id', params.course_id);
      }

      if (params.submission_type) {
        query = query.eq('submission_type', params.submission_type);
      }

      if (params.is_late !== undefined) {
        query = query.eq('is_late', params.is_late);
      }

      if (params.is_draft !== undefined) {
        query = query.eq('is_draft', params.is_draft);
      }

      if (params.search) {
        query = query.or(`content.ilike.%${params.search}%,assignment.title.ilike.%${params.search}%`);
      }

      if (params.submitted_after) {
        query = query.gte('submitted_at', params.submitted_after);
      }

      if (params.submitted_before) {
        query = query.lte('submitted_at', params.submitted_before);
      }

      // Apply sorting
      const sortField = params.sort || 'submitted_at';
      const sortOrder = params.order || 'desc';
      
      if (sortField === 'student_name') {
        query = query.order('student.last_name', { ascending: sortOrder === 'asc' });
      } else if (sortField === 'assignment_title') {
        query = query.order('assignment.title', { ascending: sortOrder === 'asc' });
      } else {
        query = query.order(sortField, { ascending: sortOrder === 'asc' });
      }

      // Apply pagination
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      query = query.range(offset, offset + limit - 1);

      const { data: submissions, error, count } = await query;

      if (error) {
        console.error('List submissions error:', error);
        return {
          success: false,
          error: 'Failed to fetch submissions',
          code: 'FETCH_FAILED'
        };
      }

      // Filter by status if requested (client-side filtering for computed status)
      let filteredSubmissions = submissions || [];
      if (params.status) {
        filteredSubmissions = filteredSubmissions.filter(submission => {
          const hasGrade = submission.grade && submission.grade.length > 0;
          const status = getSubmissionStatus(
            submission, 
            submission.assignment, 
            hasGrade
          );
          return status === params.status;
        });
      }

      // Filter by grade existence
      if (params.has_grade !== undefined) {
        filteredSubmissions = filteredSubmissions.filter(submission => {
          const hasGrade = submission.grade && submission.grade.length > 0;
          return hasGrade === params.has_grade;
        });
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data: {
          submissions: filteredSubmissions as SubmissionWithAssignment[] | SubmissionWithStudent[],
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
      console.error('List submissions error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // UPDATE SUBMISSION
  // ================================================================

  async updateSubmission(
    submissionId: string,
    updates: UpdateSubmissionRequest,
    userId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<Submission>> {
    try {
      // Get submission with assignment info for authorization
      const submissionResult = await this.getSubmissionById(submissionId, userId, userRole);
      if (!submissionResult.success || !submissionResult.data) {
        return {
          success: false,
          error: 'Submission not found',
          code: 'SUBMISSION_NOT_FOUND'
        };
      }

      const submission = submissionResult.data as SubmissionWithAssignment;

      // Authorization check - only students can update their own submissions (unless admin)
      if (userRole === UserRole.STUDENT && submission.student_id !== userId) {
        return {
          success: false,
          error: 'Can only update your own submissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      if (userRole === UserRole.INSTRUCTOR && submission.assignment.course.instructor_id !== userId) {
        return {
          success: false,
          error: 'Can only update submissions from your courses',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Check if submission is already graded
      const gradeCheck = await this.supabase
        .from('grades')
        .select('id')
        .eq('submission_id', submissionId)
        .single();

      if (gradeCheck.data && !submission.is_draft) {
        return {
          success: false,
          error: 'Cannot update graded submissions',
          code: 'SUBMISSION_GRADED'
        };
      }

      // Check assignment constraints
      const assignment = submission.assignment;
      if (!canSubmitToAssignment(assignment as unknown as Assignment)) {
        return {
          success: false,
          error: 'Assignment is no longer accepting submissions',
          code: 'ASSIGNMENT_CLOSED'
        };
      }

      // Validate attachments if being updated
      if (updates.attachments && updates.attachments.length > 0) {
        const attachmentErrors = validateSubmissionAttachments(updates.attachments);
        if (attachmentErrors.length > 0) {
          return {
            success: false,
            error: attachmentErrors.join(', '),
            code: 'INVALID_ATTACHMENTS'
          };
        }
      }

      // Calculate if submission becomes late (if changing from draft to final)
      const now = new Date();
      const finalizeUpdate: any = { ...updates };

      if (updates.is_draft === false && submission.is_draft) {
        finalizeUpdate.is_late = isSubmissionLate(now, assignment.due_at);
        finalizeUpdate.submitted_at = now.toISOString();
      }

      // Update submission
      const { data: updatedSubmission, error } = await this.supabase
        .from('submissions')
        .update(finalizeUpdate)
        .eq('id', submissionId)
        .select('*')
        .single();

      if (error) {
        console.error('Submission update error:', error);
        return {
          success: false,
          error: 'Failed to update submission',
          code: 'UPDATE_FAILED'
        };
      }

      return {
        success: true,
        data: updatedSubmission
      };

    } catch (error) {
      console.error('Update submission error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // DELETE SUBMISSION
  // ================================================================

  async deleteSubmission(
    submissionId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ServiceResponse> {
    try {
      // Get submission for authorization
      const submissionResult = await this.getSubmissionById(submissionId, userId, userRole);
      if (!submissionResult.success || !submissionResult.data) {
        return {
          success: false,
          error: 'Submission not found',
          code: 'SUBMISSION_NOT_FOUND'
        };
      }

      const submission = submissionResult.data as SubmissionWithAssignment;

      // Authorization check
      if (userRole === UserRole.STUDENT && submission.student_id !== userId) {
        return {
          success: false,
          error: 'Can only delete your own submissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      if (userRole === UserRole.INSTRUCTOR && submission.assignment.course.instructor_id !== userId) {
        return {
          success: false,
          error: 'Can only delete submissions from your courses',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Check if submission is graded - cannot delete graded submissions
      const gradeCheck = await this.supabase
        .from('grades')
        .select('id')
        .eq('submission_id', submissionId)
        .single();

      if (gradeCheck.data) {
        return {
          success: false,
          error: 'Cannot delete graded submissions',
          code: 'SUBMISSION_GRADED'
        };
      }

      // Delete submission (this will cascade to grades if any)
      const { error } = await this.supabase
        .from('submissions')
        .delete()
        .eq('id', submissionId);

      if (error) {
        console.error('Submission deletion error:', error);
        return {
          success: false,
          error: 'Failed to delete submission',
          code: 'DELETE_FAILED'
        };
      }

      return { success: true };

    } catch (error) {
      console.error('Delete submission error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // GET SUBMISSION STATISTICS
  // ================================================================

  async getSubmissionStats(
    userId: string,
    userRole: UserRole,
    organizationId: string,
    courseId?: string,
    assignmentId?: string
  ): Promise<ServiceResponse<SubmissionStats>> {
    try {
      let query = this.supabase
        .from('submissions')
        .select(`
          *,
          assignment:assignments!submissions_assignment_id_fkey (
            id,
            title,
            due_at,
            course:courses!assignments_course_id_fkey (
              id,
              title,
              instructor_id,
              organization_id
            )
          ),
          grade:grades (
            id
          )
        `)
        .eq('assignment.course.organization_id', organizationId);

      // Apply role-based filtering
      if (userRole === UserRole.INSTRUCTOR) {
        query = query.eq('assignment.course.instructor_id', userId);
      } else if (userRole === UserRole.STUDENT) {
        query = query.eq('student_id', userId);
      }

      if (courseId) {
        query = query.eq('assignment.course_id', courseId);
      }

      if (assignmentId) {
        query = query.eq('assignment_id', assignmentId);
      }

      const { data: submissions, error } = await query;

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch submission statistics',
          code: 'FETCH_FAILED'
        };
      }

      // Calculate statistics
      const totalSubmissions = submissions?.length || 0;
      const draftSubmissions = submissions?.filter(s => s.is_draft).length || 0;
      const finalSubmissions = totalSubmissions - draftSubmissions;
      const lateSubmissions = submissions?.filter(s => s.is_late).length || 0;
      const gradedSubmissions = submissions?.filter(s => s.grade && s.grade.length > 0).length || 0;

      const typeCounts: Record<SubmissionType, number> = {
        text: 0,
        file: 0,
        url: 0,
        multiple: 0,
      };

      const assignmentCounts: { [key: string]: { assignment_id: string; assignment_title: string; submission_count: number; completion_rate: number; } } = {};

      submissions?.forEach(submission => {
        typeCounts[submission.submission_type]++;

        const assignmentId = submission.assignment.id;
        if (!assignmentCounts[assignmentId]) {
          assignmentCounts[assignmentId] = {
            assignment_id: assignmentId,
            assignment_title: submission.assignment.title,
            submission_count: 0,
            completion_rate: 0,
          };
        }
        assignmentCounts[assignmentId].submission_count++;
      });

      // Calculate submission timing statistics
      let totalSubmissionTime = 0;
      let timedSubmissions = 0;

      submissions?.forEach(submission => {
        if (submission.assignment.due_at && !submission.is_draft) {
          const timing = calculateSubmissionTiming(
            new Date(submission.submitted_at),
            submission.assignment.due_at
          );
          totalSubmissionTime += timing;
          timedSubmissions++;
        }
      });

      const averageSubmissionTime = timedSubmissions > 0 
        ? Math.round(totalSubmissionTime / timedSubmissions) 
        : 0;

      // Calculate AI assistance usage
      const aiAssistedCount = submissions?.filter(s => s.ai_assistance_used).length || 0;
      const aiAssistanceUsage = totalSubmissions > 0 
        ? Math.round((aiAssistedCount / totalSubmissions) * 100) 
        : 0;

      return {
        success: true,
        data: {
          total_submissions: totalSubmissions,
          draft_submissions: draftSubmissions,
          final_submissions: finalSubmissions,
          late_submissions: lateSubmissions,
          graded_submissions: gradedSubmissions,
          submissions_by_type: typeCounts,
          submissions_by_assignment: Object.values(assignmentCounts),
          average_submission_time: averageSubmissionTime,
          ai_assistance_usage: aiAssistanceUsage,
        }
      };

    } catch (error) {
      console.error('Submission stats error:', error);
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

  private async canUserAccessSubmission(
    submission: SubmissionWithAssignment,
    userId: string,
    userRole: UserRole,
    organizationId?: string
  ): Promise<boolean> {
    // Admins can access all submissions in their organization
    if (userRole === UserRole.ADMIN && (submission.assignment.course as any).organization_id === organizationId) {
      return true;
    }

    // Instructors can access submissions from their courses
    if (userRole === UserRole.INSTRUCTOR && submission.assignment.course.instructor_id === userId) {
      return true;
    }

    // Students can access their own submissions
    if (userRole === UserRole.STUDENT && submission.student_id === userId) {
      return true;
    }

    return false;
  }

  private async getNextAttemptNumber(assignmentId: string, studentId: string): Promise<number> {
    const { count } = await this.supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId);

    return (count || 0) + 1;
  }

  async getStudentSubmission(
    assignmentId: string,
    studentId: string
  ): Promise<Submission | null> {
    const { data } = await this.supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .order('attempt_number', { ascending: false })
      .limit(1)
      .single();

    return data || null;
  }

  async getSubmissionsByAssignment(
    assignmentId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<SubmissionWithStudent[]>> {
    try {
      // Verify assignment access first
      const assignmentCheck = await this.supabase
        .from('assignments')
        .select(`
          course:courses!assignments_course_id_fkey (
            instructor_id
          )
        `)
        .eq('id', assignmentId)
        .single();

      if (assignmentCheck.error || !assignmentCheck.data) {
        return {
          success: false,
          error: 'Assignment not found',
          code: 'ASSIGNMENT_NOT_FOUND'
        };
      }

      // Check instructor permission
      if (userRole === UserRole.INSTRUCTOR) {
        const courseData: any = (assignmentCheck.data as any).course;
        const instructorId = Array.isArray(courseData) ? courseData[0]?.instructor_id : courseData?.instructor_id;
        if (instructorId !== userId) {
          return {
            success: false,
            error: 'Can only view submissions from your courses',
            code: 'INSUFFICIENT_PERMISSIONS'
          };
        }
      }

      const { data: submissions, error } = await this.supabase
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
            percentage,
            letter_grade,
            is_published
          )
        `)
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch submissions',
          code: 'FETCH_FAILED'
        };
      }

      return {
        success: true,
        data: submissions as SubmissionWithStudent[]
      };

    } catch (error) {
      console.error('Get submissions by assignment error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }
}