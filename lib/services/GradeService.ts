/**
 * Grade Service Layer
 * 
 * Comprehensive service class for managing grades with business logic,
 * data access, authorization checks, and educational workflow support.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  Grade,
  GradeWithSubmission,
  GradeWithDetails,
  CreateGradeRequest,
  UpdateGradeRequest,
  GradeListParams,
  GradeListResponse,
  GradeStats,
  StudentGradeReport,
  BulkGradeRequest,
  LetterGrade,
  calculatePercentage,
  percentageToLetterGrade,
  applyLatePenalty,
  validateGradeRules
} from '../models/Grade';
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
// GRADE SERVICE CLASS
// ====================================================================

export class GradeService {
  constructor(private supabase: SupabaseClient) {}

  // ================================================================
  // CREATE GRADE
  // ================================================================

  async createGrade(
    data: CreateGradeRequest,
    userId: string,
    userRole: UserRole,
    organizationId: string
  ): Promise<ServiceResponse<Grade>> {
    try {
      // Only instructors and admins can create grades
      if (![UserRole.INSTRUCTOR, UserRole.ADMIN].includes(userRole)) {
        return {
          success: false,
          error: 'Only instructors and admins can create grades',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Get submission with assignment and course info for validation
      const submissionResult = await this.supabase
        .from('submissions')
        .select(`
          *,
          assignment:assignments!submissions_assignment_id_fkey (
            id,
            title,
            max_points,
            late_penalty_percent,
            course:courses!assignments_course_id_fkey (
              id,
              title,
              instructor_id,
              organization_id
            )
          )
        `)
        .eq('id', data.submission_id)
        .single();

      if (submissionResult.error || !submissionResult.data) {
        return {
          success: false,
          error: 'Submission not found or inaccessible',
          code: 'SUBMISSION_NOT_FOUND'
        };
      }

      const submission = submissionResult.data;

      // Check organization match
      if (submission.assignment.course.organization_id !== organizationId) {
        return {
          success: false,
          error: 'Submission not in your organization',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Check instructor permission
      if (userRole === UserRole.INSTRUCTOR && submission.assignment.course.instructor_id !== userId) {
        return {
          success: false,
          error: 'Can only grade submissions from your courses',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Check if submission is a draft
      if (submission.is_draft) {
        return {
          success: false,
          error: 'Cannot grade draft submissions',
          code: 'SUBMISSION_DRAFT'
        };
      }

      // Check if grade already exists
      const existingGradeCheck = await this.supabase
        .from('grades')
        .select('id')
        .eq('submission_id', data.submission_id)
        .single();

      if (existingGradeCheck.data) {
        return {
          success: false,
          error: 'Grade already exists for this submission',
          code: 'GRADE_EXISTS'
        };
      }

      // Validate grade business rules
      const ruleErrors = validateGradeRules(data, submission.assignment);
      if (ruleErrors.length > 0) {
        return {
          success: false,
          error: ruleErrors.join(', '),
          code: 'VALIDATION_ERROR'
        };
      }

      // Apply late penalty if applicable
      let finalPointsEarned = data.points_earned;
      if (submission.is_late && submission.assignment.late_penalty_percent > 0) {
        finalPointsEarned = applyLatePenalty(
          data.points_earned,
          submission.assignment.late_penalty_percent,
          true
        );
      }

      // Calculate percentage
      const percentage = calculatePercentage(finalPointsEarned, data.points_possible);

      // Auto-generate letter grade if not provided
      let letterGrade = data.letter_grade;
      if (!letterGrade) {
        letterGrade = percentageToLetterGrade(percentage);
      }

      // Create grade
      const { data: grade, error } = await this.supabase
        .from('grades')
        .insert([{
          submission_id: data.submission_id,
          graded_by: userId,
          points_earned: finalPointsEarned,
          points_possible: data.points_possible,
          // percentage is computed by the database
          letter_grade: letterGrade,
          feedback: data.feedback,
          rubric_scores: data.rubric_scores || {},
          ai_assistance_used: data.ai_assistance_used || false,
          ai_suggestions: data.ai_suggestions || {},
          is_final: data.is_final ?? true,
          is_published: data.is_published ?? false,
          metadata: data.metadata || {},
        }])
        .select('*')
        .single();

      if (error) {
        console.error('Grade creation error:', error);
        return {
          success: false,
          error: 'Failed to create grade',
          code: 'CREATION_FAILED'
        };
      }

      return {
        success: true,
        data: grade
      };

    } catch (error) {
      console.error('Grade service error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // GET GRADE BY ID
  // ================================================================

  async getGradeById(
    gradeId: string,
    userId: string,
    userRole: UserRole,
    organizationId?: string,
    includeDetails: boolean = false
  ): Promise<ServiceResponse<GradeWithSubmission | GradeWithDetails>> {
    try {
      let query: any = this.supabase
        .from('grades')
        .select(`
          *,
          submission:submissions!grades_submission_id_fkey (
            id,
            student_id,
            assignment_id,
            content,
            submission_type,
            attempt_number,
            submitted_at,
            is_late,
            is_draft,
            student:profiles!submissions_student_id_fkey (
              id,
              first_name,
              last_name,
              email
            ),
            assignment:assignments!submissions_assignment_id_fkey (
              id,
              title,
              assignment_type,
              max_points,
              due_at,
              course:courses!assignments_course_id_fkey (
                id,
                title,
                instructor_id,
                organization_id
              )
            )
          )
        `)
        .eq('id', gradeId);

      if (includeDetails) {
        query = query.select(`
          *,
          grader:profiles!grades_graded_by_fkey (
            id,
            first_name,
            last_name,
            email,
            role
          ),
          submission:submissions!grades_submission_id_fkey (
            student:profiles!submissions_student_id_fkey (
              id,
              first_name,
              last_name,
              email
            ),
            assignment:assignments!submissions_assignment_id_fkey (
              title,
              max_points
            )
          )
        `);
      }

      const { data: grade, error } = await query.single();

      if (error || !grade) {
        return {
          success: false,
          error: 'Grade not found',
          code: 'GRADE_NOT_FOUND'
        };
      }

      // Authorization checks
      const canAccess = await this.canUserAccessGrade(
        grade,
        userId,
        userRole,
        organizationId
      );

      if (!canAccess) {
        return {
          success: false,
          error: 'Insufficient permissions to view grade',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Students can only see published grades
      if (userRole === UserRole.STUDENT && !grade.is_published) {
        return {
          success: false,
          error: 'Grade not yet published',
          code: 'GRADE_NOT_PUBLISHED'
        };
      }

      return {
        success: true,
        data: grade as GradeWithSubmission | GradeWithDetails
      };

    } catch (error) {
      console.error('Get grade error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // LIST GRADES
  // ================================================================

  async listGrades(
    params: GradeListParams,
    userId: string,
    userRole: UserRole,
    organizationId: string
  ): Promise<ServiceResponse<GradeListResponse>> {
    try {
      let query = this.supabase
        .from('grades')
        .select(`
          *,
          grader:profiles!grades_graded_by_fkey (
            id,
            first_name,
            last_name,
            email,
            role
          ),
          submission:submissions!grades_submission_id_fkey (
            id,
            student_id,
            assignment_id,
            content,
            submission_type,
            attempt_number,
            submitted_at,
            is_late,
            is_draft,
            student:profiles!submissions_student_id_fkey (
              id,
              first_name,
              last_name,
              email
            ),
            assignment:assignments!submissions_assignment_id_fkey (
              id,
              title,
              assignment_type,
              max_points,
              due_at,
              course:courses!assignments_course_id_fkey (
                id,
                title,
                instructor_id,
                organization_id
              )
            )
          )
        `, { count: 'exact' });

      // Apply organization filter
      query = query.eq('submission.assignment.course.organization_id', organizationId);

      // Apply role-based access control
      if (userRole === UserRole.STUDENT) {
        // Students only see their own published grades
        query = query.eq('submission.student_id', userId).eq('is_published', true);
      } else if (userRole === UserRole.INSTRUCTOR) {
        // Instructors see grades from their courses
        query = query.eq('submission.assignment.course.instructor_id', userId);
      }
      // Admins see all grades in the organization

      // Apply filters
      if (params.submission_id) {
        query = query.eq('submission_id', params.submission_id);
      }

      if (params.student_id) {
        query = query.eq('submission.student_id', params.student_id);
      }

      if (params.assignment_id) {
        query = query.eq('submission.assignment_id', params.assignment_id);
      }

      if (params.course_id) {
        query = query.eq('submission.assignment.course_id', params.course_id);
      }

      if (params.graded_by) {
        query = query.eq('graded_by', params.graded_by);
      }

      if (params.letter_grade) {
        query = query.eq('letter_grade', params.letter_grade);
      }

      if (params.min_percentage !== undefined) {
        query = query.gte('percentage', params.min_percentage);
      }

      if (params.max_percentage !== undefined) {
        query = query.lte('percentage', params.max_percentage);
      }

      if (params.is_published !== undefined) {
        query = query.eq('is_published', params.is_published);
      }

      if (params.is_final !== undefined) {
        query = query.eq('is_final', params.is_final);
      }

      if (params.search) {
        query = query.or(`feedback.ilike.%${params.search}%,submission.assignment.title.ilike.%${params.search}%`);
      }

      if (params.graded_after) {
        query = query.gte('created_at', params.graded_after);
      }

      if (params.graded_before) {
        query = query.lte('created_at', params.graded_before);
      }

      // Apply sorting
      const sortField = params.sort || 'created_at';
      const sortOrder = params.order || 'desc';
      
      if (sortField === 'student_name') {
        query = query.order('submission.student.last_name', { ascending: sortOrder === 'asc' });
      } else if (sortField === 'assignment_title') {
        query = query.order('submission.assignment.title', { ascending: sortOrder === 'asc' });
      } else {
        query = query.order(sortField, { ascending: sortOrder === 'asc' });
      }

      // Apply pagination
      const page = params.page || 1;
      const limit = params.limit || 20;
      const offset = (page - 1) * limit;

      query = query.range(offset, offset + limit - 1);

      const { data: grades, error, count } = await query;

      if (error) {
        console.error('List grades error:', error);
        return {
          success: false,
          error: 'Failed to fetch grades',
          code: 'FETCH_FAILED'
        };
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data: {
          grades: grades as GradeWithSubmission[],
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
      console.error('List grades error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // UPDATE GRADE
  // ================================================================

  async updateGrade(
    gradeId: string,
    updates: UpdateGradeRequest,
    userId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<Grade>> {
    try {
      // Get grade with submission info for authorization
      const gradeResult = await this.getGradeById(gradeId, userId, userRole);
      if (!gradeResult.success || !gradeResult.data) {
        return {
          success: false,
          error: 'Grade not found',
          code: 'GRADE_NOT_FOUND'
        };
      }

      const grade = gradeResult.data as GradeWithSubmission;

      // Authorization check
      if (userRole === UserRole.INSTRUCTOR && grade.submission.assignment.course.instructor_id !== userId) {
        return {
          success: false,
          error: 'Can only update grades from your courses',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      if (userRole === UserRole.STUDENT) {
        return {
          success: false,
          error: 'Students cannot update grades',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Only grader or admin can update the grade
      if (userRole === UserRole.INSTRUCTOR && grade.graded_by !== userId) {
        return {
          success: false,
          error: 'Can only update grades you created',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Validate grade business rules if points are being updated
      if (updates.points_earned !== undefined || updates.points_possible !== undefined) {
        const ruleErrors = validateGradeRules(updates, grade.submission.assignment);
        if (ruleErrors.length > 0) {
          return {
            success: false,
            error: ruleErrors.join(', '),
            code: 'VALIDATION_ERROR'
          };
        }
      }

      // Prepare update data
      const updateData: any = { ...updates };

      // Recalculate percentage if points change
      if (updates.points_earned !== undefined || updates.points_possible !== undefined) {
        const pointsEarned = updates.points_earned ?? grade.points_earned;
        const pointsPossible = updates.points_possible ?? grade.points_possible;
        
        // Apply late penalty if needed
        let finalPointsEarned = pointsEarned;
        if (grade.submission.is_late && grade.submission.assignment.course) {
          // Get late penalty from assignment (would need to fetch this)
          // For now, preserve original late penalty logic
        }
        
        updateData.points_earned = finalPointsEarned;
        
        // Auto-update letter grade if not explicitly provided
        if (!updates.letter_grade) {
          const newPercentage = calculatePercentage(finalPointsEarned, pointsPossible);
          updateData.letter_grade = percentageToLetterGrade(newPercentage);
        }
      }

      // Update grade
      const { data: updatedGrade, error } = await this.supabase
        .from('grades')
        .update(updateData)
        .eq('id', gradeId)
        .select('*')
        .single();

      if (error) {
        console.error('Grade update error:', error);
        return {
          success: false,
          error: 'Failed to update grade',
          code: 'UPDATE_FAILED'
        };
      }

      return {
        success: true,
        data: updatedGrade
      };

    } catch (error) {
      console.error('Update grade error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // DELETE GRADE
  // ================================================================

  async deleteGrade(
    gradeId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ServiceResponse> {
    try {
      // Get grade for authorization
      const gradeResult = await this.getGradeById(gradeId, userId, userRole);
      if (!gradeResult.success || !gradeResult.data) {
        return {
          success: false,
          error: 'Grade not found',
          code: 'GRADE_NOT_FOUND'
        };
      }

      const grade = gradeResult.data as GradeWithSubmission;

      // Authorization check
      if (userRole === UserRole.INSTRUCTOR && grade.submission.assignment.course.instructor_id !== userId) {
        return {
          success: false,
          error: 'Can only delete grades from your courses',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      if (userRole === UserRole.STUDENT) {
        return {
          success: false,
          error: 'Students cannot delete grades',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Only grader or admin can delete the grade
      if (userRole === UserRole.INSTRUCTOR && grade.graded_by !== userId) {
        return {
          success: false,
          error: 'Can only delete grades you created',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Check if grade is published - warn but allow
      if (grade.is_published) {
        // In a real system, you might want to prevent this or require additional confirmation
        console.warn('Deleting published grade:', gradeId);
      }

      // Delete grade
      const { error } = await this.supabase
        .from('grades')
        .delete()
        .eq('id', gradeId);

      if (error) {
        console.error('Grade deletion error:', error);
        return {
          success: false,
          error: 'Failed to delete grade',
          code: 'DELETE_FAILED'
        };
      }

      return { success: true };

    } catch (error) {
      console.error('Delete grade error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // BULK GRADE OPERATIONS
  // ================================================================

  async bulkCreateGrades(
    bulkData: BulkGradeRequest,
    userId: string,
    userRole: UserRole,
    organizationId: string
  ): Promise<ServiceResponse<{ created: number; errors: string[] }>> {
    try {
      if (![UserRole.INSTRUCTOR, UserRole.ADMIN].includes(userRole)) {
        return {
          success: false,
          error: 'Insufficient permissions for bulk grading',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      const results = {
        created: 0,
        errors: [] as string[]
      };

      // Process grades in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < bulkData.grades.length; i += batchSize) {
        const batch = bulkData.grades.slice(i, i + batchSize);
        
        for (const gradeData of batch) {
          const createRequest: CreateGradeRequest = {
            submission_id: gradeData.submission_id,
            points_earned: gradeData.points_earned,
            points_possible: gradeData.points_earned, // This should be from assignment
            letter_grade: gradeData.letter_grade,
            feedback: gradeData.feedback,
            rubric_scores: gradeData.rubric_scores,
            ai_assistance_used: bulkData.ai_assistance_used,
            is_published: bulkData.is_published,
          };

          const result = await this.createGrade(
            createRequest,
            userId,
            userRole,
            organizationId
          );

          if (result.success) {
            results.created++;
          } else {
            results.errors.push(`Submission ${gradeData.submission_id}: ${result.error}`);
          }
        }
      }

      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error('Bulk grade creation error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // PUBLISH/UNPUBLISH GRADES
  // ================================================================

  async publishGrades(
    gradeIds: string[],
    userId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<{ published: number; errors: string[] }>> {
    try {
      if (![UserRole.INSTRUCTOR, UserRole.ADMIN].includes(userRole)) {
        return {
          success: false,
          error: 'Insufficient permissions to publish grades',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      const results = {
        published: 0,
        errors: [] as string[]
      };

      for (const gradeId of gradeIds) {
        const result = await this.updateGrade(
          gradeId,
          { is_published: true },
          userId,
          userRole
        );

        if (result.success) {
          results.published++;
        } else {
          results.errors.push(`Grade ${gradeId}: ${result.error}`);
        }
      }

      return {
        success: true,
        data: results
      };

    } catch (error) {
      console.error('Publish grades error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // GRADE STATISTICS
  // ================================================================

  async getGradeStats(
    userId: string,
    userRole: UserRole,
    organizationId: string,
    courseId?: string,
    assignmentId?: string
  ): Promise<ServiceResponse<GradeStats>> {
    try {
      let query = this.supabase
        .from('grades')
        .select(`
          *,
          submission:submissions!grades_submission_id_fkey (
            assignment:assignments!submissions_assignment_id_fkey (
              id,
              title,
              course:courses!assignments_course_id_fkey (
                id,
                instructor_id,
                organization_id
              )
            )
          )
        `)
        .eq('submission.assignment.course.organization_id', organizationId);

      // Apply role-based filtering
      if (userRole === UserRole.INSTRUCTOR) {
        query = query.eq('submission.assignment.course.instructor_id', userId);
      } else if (userRole === UserRole.STUDENT) {
        // Students see stats for their own grades only
        query = query.eq('submission.student_id', userId).eq('is_published', true);
      }

      if (courseId) {
        query = query.eq('submission.assignment.course_id', courseId);
      }

      if (assignmentId) {
        query = query.eq('submission.assignment_id', assignmentId);
      }

      const { data: grades, error } = await query;

      if (error) {
        return {
          success: false,
          error: 'Failed to fetch grade statistics',
          code: 'FETCH_FAILED'
        };
      }

      // Calculate statistics
      const totalGrades = grades?.length || 0;
      const publishedGrades = grades?.filter(g => g.is_published).length || 0;
      const draftGrades = totalGrades - publishedGrades;

      const percentages = grades?.map(g => g.percentage).filter(p => p !== null) || [];
      const averagePercentage = percentages.length > 0 
        ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100
        : 0;

      // Calculate median
      const sortedPercentages = [...percentages].sort((a, b) => a - b);
      const medianPercentage = sortedPercentages.length > 0
        ? sortedPercentages.length % 2 === 0
          ? (sortedPercentages[sortedPercentages.length / 2 - 1] + sortedPercentages[sortedPercentages.length / 2]) / 2
          : sortedPercentages[Math.floor(sortedPercentages.length / 2)]
        : 0;

      // Grade distribution
      const gradeDistribution: Record<LetterGrade, number> = {
        'A+': 0, 'A': 0, 'A-': 0,
        'B+': 0, 'B': 0, 'B-': 0,
        'C+': 0, 'C': 0, 'C-': 0,
        'D+': 0, 'D': 0, 'D-': 0,
        'F': 0, 'Pass': 0, 'Fail': 0,
        'Incomplete': 0, 'Withdraw': 0
      };

      const percentageDistribution = {
        'A (90-100)': 0,
        'B (80-89)': 0,
        'C (70-79)': 0,
        'D (60-69)': 0,
        'F (0-59)': 0,
      };

      grades?.forEach(grade => {
        if (grade.letter_grade) {
          gradeDistribution[grade.letter_grade as LetterGrade]++;
        }

        if (grade.percentage !== null) {
          if (grade.percentage >= 90) percentageDistribution['A (90-100)']++;
          else if (grade.percentage >= 80) percentageDistribution['B (80-89)']++;
          else if (grade.percentage >= 70) percentageDistribution['C (70-79)']++;
          else if (grade.percentage >= 60) percentageDistribution['D (60-69)']++;
          else percentageDistribution['F (0-59)']++;
        }
      });

      // Grades by assignment
      const assignmentCounts: { [key: string]: { assignment_id: string; assignment_title: string; graded_count: number; average_score: number; } } = {};
      
      grades?.forEach(grade => {
        const assignmentId = grade.submission.assignment.id;
        if (!assignmentCounts[assignmentId]) {
          assignmentCounts[assignmentId] = {
            assignment_id: assignmentId,
            assignment_title: grade.submission.assignment.title,
            graded_count: 0,
            average_score: 0,
          };
        }
        assignmentCounts[assignmentId].graded_count++;
        assignmentCounts[assignmentId].average_score += grade.percentage || 0;
      });

      // Calculate average scores for assignments
      Object.values(assignmentCounts).forEach(assignment => {
        if (assignment.graded_count > 0) {
          assignment.average_score = Math.round((assignment.average_score / assignment.graded_count) * 100) / 100;
        }
      });

      // AI assistance usage
      const aiAssistedCount = grades?.filter(g => g.ai_assistance_used).length || 0;
      const aiAssistanceUsage = totalGrades > 0 
        ? Math.round((aiAssistedCount / totalGrades) * 100)
        : 0;

      return {
        success: true,
        data: {
          total_grades: totalGrades,
          published_grades: publishedGrades,
          draft_grades: draftGrades,
          average_percentage: averagePercentage,
          median_percentage: medianPercentage,
          grade_distribution: gradeDistribution,
          percentage_distribution: percentageDistribution,
          grades_by_assignment: Object.values(assignmentCounts),
          ai_assistance_usage: aiAssistanceUsage,
        }
      };

    } catch (error) {
      console.error('Grade stats error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      };
    }
  }

  // ================================================================
  // STUDENT GRADE REPORT
  // ================================================================

  async getStudentGradeReport(
    studentId: string,
    courseId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<StudentGradeReport>> {
    try {
      // Authorization check
      if (userRole === UserRole.STUDENT && userId !== studentId) {
        return {
          success: false,
          error: 'Can only view your own grade reports',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Get student and course info
      const courseResult = await this.supabase
        .from('courses')
        .select(`
          id,
          title,
          course_code,
          instructor_id
        `)
        .eq('id', courseId)
        .single();

      if (courseResult.error || !courseResult.data) {
        return {
          success: false,
          error: 'Course not found',
          code: 'COURSE_NOT_FOUND'
        };
      }

      const course = courseResult.data;

      // Check instructor permission
      if (userRole === UserRole.INSTRUCTOR && course.instructor_id !== userId) {
        return {
          success: false,
          error: 'Can only view reports from your courses',
          code: 'INSUFFICIENT_PERMISSIONS'
        };
      }

      // Get student info
      const studentResult = await this.supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('id', studentId)
        .single();

      if (studentResult.error || !studentResult.data) {
        return {
          success: false,
          error: 'Student not found',
          code: 'STUDENT_NOT_FOUND'
        };
      }

      const student = studentResult.data;

      // Get grades for the student in this course
      const gradesQuery = this.supabase
        .from('grades')
        .select(`
          *,
          submission:submissions!grades_submission_id_fkey (
            assignment:assignments!submissions_assignment_id_fkey (
              id,
              title,
              assignment_type,
              max_points,
              due_at,
              course_id
            )
          )
        `)
        .eq('submission.student_id', studentId)
        .eq('submission.assignment.course_id', courseId);

      // Students only see published grades
      if (userRole === UserRole.STUDENT) {
        gradesQuery.eq('is_published', true);
      }

      const { data: grades, error: gradesError } = await gradesQuery;

      if (gradesError) {
        return {
          success: false,
          error: 'Failed to fetch grades',
          code: 'FETCH_FAILED'
        };
      }

      // Format grade data
      const gradeData = grades?.map(grade => ({
        assignment: {
          id: grade.submission.assignment.id,
          title: grade.submission.assignment.title,
          assignment_type: grade.submission.assignment.assignment_type,
          max_points: grade.submission.assignment.max_points,
          due_at: grade.submission.assignment.due_at,
        },
        grade: {
          points_earned: grade.points_earned,
          points_possible: grade.points_possible,
          percentage: grade.percentage,
          letter_grade: grade.letter_grade as LetterGrade,
          feedback: grade.feedback,
          created_at: grade.created_at,
        }
      })) || [];

      // Calculate summary statistics
      const totalAssignments = gradeData.length;
      const gradedAssignments = gradeData.length;
      
      const percentages = gradeData.map(g => g.grade.percentage).filter(p => p !== null);
      const overallPercentage = percentages.length > 0
        ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100
        : 0;

      const overallLetterGrade = percentageToLetterGrade(overallPercentage);

      // Determine trend (simple implementation)
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (percentages.length >= 3) {
        const recent = percentages.slice(-3);
        const earlier = percentages.slice(0, -3);
        if (earlier.length > 0) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
          
          if (recentAvg > earlierAvg + 5) trend = 'improving';
          else if (recentAvg < earlierAvg - 5) trend = 'declining';
        }
      }

      return {
        success: true,
        data: {
          student,
          course: {
            id: course.id,
            title: course.title,
            course_code: course.course_code,
          },
          grades: gradeData,
          summary: {
            total_assignments: totalAssignments,
            graded_assignments: gradedAssignments,
            overall_percentage: overallPercentage,
            overall_letter_grade: overallLetterGrade,
            trend
          }
        }
      };

    } catch (error) {
      console.error('Student grade report error:', error);
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

  private async canUserAccessGrade(
    grade: GradeWithSubmission,
    userId: string,
    userRole: UserRole,
    organizationId?: string
  ): Promise<boolean> {
    // Admins can access all grades in their organization
    if (userRole === UserRole.ADMIN && (grade.submission.assignment.course as any).organization_id === organizationId) {
      return true;
    }

    // Instructors can access grades from their courses
    if (userRole === UserRole.INSTRUCTOR && (grade.submission.assignment.course as any).instructor_id === userId) {
      return true;
    }

    // Students can access their own grades
    if (userRole === UserRole.STUDENT && grade.submission.student.id === userId) {
      return true;
    }

    return false;
  }

  async getGradeBySubmissionId(
    submissionId: string,
    userId: string,
    userRole: UserRole
  ): Promise<Grade | null> {
    const { data } = await this.supabase
      .from('grades')
      .select('*')
      .eq('submission_id', submissionId)
      .single();

    return data || null;
  }
}