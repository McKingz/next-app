/**
 * Course Service Layer
 * 
 * Business logic and database operations for Course management
 * Includes CRUD operations, enrollment management, and authorization checks
 */

import { assertSupabase } from '../supabase';
import type {
  Course,
  CourseWithInstructor,
  CourseWithEnrollments,
  CreateCourseRequest,
  UpdateCourseRequest,
  CourseListQuery,
  CourseListResponse,
  CourseStats,
} from '../models/Course';
import { generateJoinCode, isCourseCurrentlyActive } from '../models/Course';
import { UserRole } from '../security/rbac';

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export class CourseService {
  private supabase = assertSupabase();

  /**
   * Create a new course
   */
  async createCourse(
    courseData: CreateCourseRequest,
    instructorId: string,
    organizationId: string
  ): Promise<ServiceResponse<Course>> {
    try {
      // Generate join code for the course
      const joinCode = generateJoinCode();
      const joinCodeExpiresAt = new Date();
      joinCodeExpiresAt.setMonth(joinCodeExpiresAt.getMonth() + 3); // 3 months validity

      const { data, error } = await this.supabase
        .from('courses')
        .insert({
          ...courseData,
          instructor_id: instructorId,
          organization_id: organizationId,
          join_code: joinCode,
          join_code_expires_at: joinCodeExpiresAt.toISOString(),
          metadata: courseData.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating course:', error);
        return {
          success: false,
          error: 'Failed to create course',
          code: 'COURSE_CREATE_ERROR',
        };
      }

      return {
        success: true,
        data: data as Course,
      };
    } catch (error) {
      console.error('Course creation error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Get course by ID with instructor information
   */
  async getCourseById(
    courseId: string,
    requestingUserId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<CourseWithInstructor>> {
    try {
      let query = this.supabase
        .from('courses')
        .select(`
          *,
          instructor:profiles!instructor_id(
            id,
            first_name,
            last_name,
            email,
            role
          ),
          organization:preschools!organization_id(
            id,
            name
          )
        `)
        .eq('id', courseId)
        .is('deleted_at', null);

      // Apply row-level security based on user role
      if (userRole === UserRole.STUDENT) {
        // Students can only see courses they're enrolled in
        query = query.eq('enrollments.student_id', requestingUserId);
      } else if (userRole === UserRole.INSTRUCTOR) {
        // Instructors can see their own courses or courses in their organization
        query = query.or(`instructor_id.eq.${requestingUserId},organization_id.eq.(SELECT organization_id FROM profiles WHERE id = '${requestingUserId}')`);
      }
      // Admins can see all courses (no additional filter)

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: 'Course not found',
            code: 'COURSE_NOT_FOUND',
          };
        }
        console.error('Error fetching course:', error);
        return {
          success: false,
          error: 'Failed to fetch course',
          code: 'COURSE_FETCH_ERROR',
        };
      }

      // Check if user is enrolled (for students)
      let isEnrolled = false;
      if (userRole === UserRole.STUDENT) {
        const { data: enrollment } = await this.supabase
          .from('enrollments')
          .select('id')
          .eq('course_id', courseId)
          .eq('student_id', requestingUserId)
          .eq('is_active', true)
          .single();
        
        isEnrolled = !!enrollment;
      }

      // Get enrollment count
      const { count: enrollmentCount } = await this.supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .eq('is_active', true);

      const courseWithInstructor: CourseWithInstructor = {
        ...data,
        enrollment_count: enrollmentCount || 0,
        is_enrolled: isEnrolled,
      };

      return {
        success: true,
        data: courseWithInstructor,
      };
    } catch (error) {
      console.error('Course fetch error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * List courses with pagination and filtering
   */
  async listCourses(
    query: CourseListQuery,
    requestingUserId: string,
    userRole: UserRole,
    userOrganizationId?: string
  ): Promise<ServiceResponse<CourseListResponse>> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        status = 'active',
        instructor_id,
        organization_id,
        enrolled,
        sort_by = 'created_at',
        sort_order = 'desc',
      } = query;

      const offset = (page - 1) * limit;

      let baseQuery = this.supabase
        .from('courses')
        .select(`
          *,
          instructor:profiles!instructor_id(
            id,
            first_name,
            last_name,
            email,
            role
          ),
          organization:preschools!organization_id(
            id,
            name
          )
        `, { count: 'exact' })
        .is('deleted_at', null);

      // Apply role-based filtering
      if (userRole === UserRole.STUDENT) {
        if (enrolled) {
          // Show only enrolled courses
          baseQuery = baseQuery
            .eq('enrollments.student_id', requestingUserId)
            .eq('enrollments.is_active', true);
        } else {
          // Show all courses in the student's organization
          baseQuery = baseQuery.eq('organization_id', userOrganizationId);
        }
      } else if (userRole === UserRole.INSTRUCTOR) {
        if (instructor_id) {
          baseQuery = baseQuery.eq('instructor_id', instructor_id);
        } else {
          // Show instructor's courses and courses in their organization
          baseQuery = baseQuery.or(`instructor_id.eq.${requestingUserId},organization_id.eq.${userOrganizationId}`);
        }
      } else if (userRole === UserRole.ADMIN) {
        // Admins can filter by organization
        if (organization_id) {
          baseQuery = baseQuery.eq('organization_id', organization_id);
        } else if (userOrganizationId) {
          baseQuery = baseQuery.eq('organization_id', userOrganizationId);
        }
        
        if (instructor_id) {
          baseQuery = baseQuery.eq('instructor_id', instructor_id);
        }
      }

      // Apply status filter
      if (status !== 'all') {
        baseQuery = baseQuery.eq('is_active', status === 'active');
      }

      // Apply search filter
      if (search) {
        baseQuery = baseQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%,course_code.ilike.%${search}%`);
      }

      // Apply sorting
      const ascending = sort_order === 'asc';
      baseQuery = baseQuery.order(sort_by, { ascending });

      // Apply pagination
      baseQuery = baseQuery.range(offset, offset + limit - 1);

      const { data, error, count } = await baseQuery;

      if (error) {
        console.error('Error listing courses:', error);
        return {
          success: false,
          error: 'Failed to fetch courses',
          code: 'COURSES_FETCH_ERROR',
        };
      }

      // Get enrollment counts for each course
      const coursesWithEnrollment: CourseWithInstructor[] = await Promise.all(
        (data || []).map(async (course) => {
          const { count: enrollmentCount } = await this.supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id)
            .eq('is_active', true);

          // Check if student is enrolled (for student users)
          let isEnrolled = false;
          if (userRole === UserRole.STUDENT) {
            const { data: enrollment } = await this.supabase
              .from('enrollments')
              .select('id')
              .eq('course_id', course.id)
              .eq('student_id', requestingUserId)
              .eq('is_active', true)
              .single();
            
            isEnrolled = !!enrollment;
          }

          return {
            ...course,
            enrollment_count: enrollmentCount || 0,
            is_enrolled: isEnrolled,
          };
        })
      );

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          courses: coursesWithEnrollment,
          pagination: {
            page,
            limit,
            total,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_previous: page > 1,
          },
        },
      };
    } catch (error) {
      console.error('Course listing error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Update a course
   */
  async updateCourse(
    courseId: string,
    updates: UpdateCourseRequest,
    requestingUserId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<Course>> {
    try {
      // First verify the user can update this course
      const authCheck = await this.checkCourseAuthority(courseId, requestingUserId, userRole, 'update');
      if (!authCheck.success) {
        return authCheck as unknown as ServiceResponse<Course>;
      }

      const { data, error } = await this.supabase
        .from('courses')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        console.error('Error updating course:', error);
        return {
          success: false,
          error: 'Failed to update course',
          code: 'COURSE_UPDATE_ERROR',
        };
      }

      return {
        success: true,
        data: data as Course,
      };
    } catch (error) {
      console.error('Course update error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Soft delete a course
   */
  async deleteCourse(
    courseId: string,
    requestingUserId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<void>> {
    try {
      // First verify the user can delete this course
      const authCheck = await this.checkCourseAuthority(courseId, requestingUserId, userRole, 'delete');
      if (!authCheck.success) {
        return authCheck;
      }

      const { error } = await this.supabase
        .from('courses')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId)
        .is('deleted_at', null);

      if (error) {
        console.error('Error deleting course:', error);
        return {
          success: false,
          error: 'Failed to delete course',
          code: 'COURSE_DELETE_ERROR',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Course deletion error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Enroll a student in a course using a join code
   */
  async enrollStudent(
    courseId: string,
    studentId: string,
    joinCode: string
  ): Promise<ServiceResponse<void>> {
    try {
      // First verify the join code is valid
      const { data: course, error: courseError } = await this.supabase
        .from('courses')
        .select('join_code, join_code_expires_at, max_students, is_active')
        .eq('id', courseId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single();

      if (courseError || !course) {
        return {
          success: false,
          error: 'Course not found or inactive',
          code: 'COURSE_NOT_FOUND',
        };
      }

      if (course.join_code !== joinCode) {
        return {
          success: false,
          error: 'Invalid join code',
          code: 'INVALID_JOIN_CODE',
        };
      }

      // Check if join code has expired
      if (course.join_code_expires_at && new Date() > new Date(course.join_code_expires_at)) {
        return {
          success: false,
          error: 'Join code has expired',
          code: 'JOIN_CODE_EXPIRED',
        };
      }

      // Check if student is already enrolled
      const { data: existingEnrollment } = await this.supabase
        .from('enrollments')
        .select('id, is_active')
        .eq('course_id', courseId)
        .eq('student_id', studentId)
        .single();

      if (existingEnrollment) {
        if (existingEnrollment.is_active) {
          return {
            success: false,
            error: 'Student is already enrolled in this course',
            code: 'ALREADY_ENROLLED',
          };
        } else {
          // Reactivate enrollment
          const { error: reactivateError } = await this.supabase
            .from('enrollments')
            .update({
              is_active: true,
              enrolled_at: new Date().toISOString(),
              enrollment_method: 'join_code',
              dropped_at: null,
              drop_reason: null,
            })
            .eq('id', existingEnrollment.id);

          if (reactivateError) {
            return {
              success: false,
              error: 'Failed to reactivate enrollment',
              code: 'ENROLLMENT_ERROR',
            };
          }

          return { success: true };
        }
      }

      // Check course capacity
      if (course.max_students) {
        const { count } = await this.supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', courseId)
          .eq('is_active', true);

        if (count && count >= course.max_students) {
          return {
            success: false,
            error: 'Course is at maximum capacity',
            code: 'COURSE_FULL',
          };
        }
      }

      // Create enrollment
      const { error: enrollError } = await this.supabase
        .from('enrollments')
        .insert({
          course_id: courseId,
          student_id: studentId,
          enrollment_method: 'join_code',
        });

      if (enrollError) {
        console.error('Error creating enrollment:', enrollError);
        return {
          success: false,
          error: 'Failed to enroll student',
          code: 'ENROLLMENT_ERROR',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Student enrollment error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Get course roster (enrolled students)
   */
  async getCourseRoster(
    courseId: string,
    requestingUserId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<CourseWithEnrollments>> {
    try {
      // First verify the user can view this course roster
      const authCheck = await this.checkCourseAuthority(courseId, requestingUserId, userRole, 'view_roster');
      if (!authCheck.success) {
        return authCheck as unknown as ServiceResponse<CourseWithEnrollments>;
      }

      const { data, error } = await this.supabase
        .from('courses')
        .select(`
          *,
          instructor:profiles!instructor_id(
            id,
            first_name,
            last_name,
            email,
            role
          ),
          organization:preschools!organization_id(
            id,
            name
          ),
          enrollments!inner(
            id,
            enrolled_at,
            enrollment_method,
            is_active,
            student:profiles!student_id(
              id,
              first_name,
              last_name,
              email
            )
          )
        `)
        .eq('id', courseId)
        .eq('enrollments.is_active', true)
        .is('deleted_at', null)
        .single();

      if (error) {
        console.error('Error fetching course roster:', error);
        return {
          success: false,
          error: 'Failed to fetch course roster',
          code: 'ROSTER_FETCH_ERROR',
        };
      }

      return {
        success: true,
        data: data as CourseWithEnrollments,
      };
    } catch (error) {
      console.error('Course roster error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Remove a student from a course
   */
  async removeStudentFromCourse(
    courseId: string,
    studentId: string,
    requestingUserId: string,
    userRole: UserRole,
    reason?: string
  ): Promise<ServiceResponse<void>> {
    try {
      // First verify the user can modify this course enrollment
      const authCheck = await this.checkCourseAuthority(courseId, requestingUserId, userRole, 'manage_enrollment');
      if (!authCheck.success) {
        return authCheck;
      }

      const { error } = await this.supabase
        .from('enrollments')
        .update({
          is_active: false,
          dropped_at: new Date().toISOString(),
          drop_reason: reason || 'Removed by instructor/admin',
        })
        .eq('course_id', courseId)
        .eq('student_id', studentId)
        .eq('is_active', true);

      if (error) {
        console.error('Error removing student from course:', error);
        return {
          success: false,
          error: 'Failed to remove student from course',
          code: 'ENROLLMENT_REMOVAL_ERROR',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Student removal error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Generate a new join code for a course
   */
  async regenerateJoinCode(
    courseId: string,
    requestingUserId: string,
    userRole: UserRole
  ): Promise<ServiceResponse<{ join_code: string; expires_at: string }>> {
    try {
      // First verify the user can update this course
      const authCheck = await this.checkCourseAuthority(courseId, requestingUserId, userRole, 'update');
      if (!authCheck.success) {
        return authCheck as unknown as ServiceResponse<{ join_code: string; expires_at: string }>;
      }

      const newJoinCode = generateJoinCode();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 3); // 3 months validity

      const { error } = await this.supabase
        .from('courses')
        .update({
          join_code: newJoinCode,
          join_code_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId)
        .is('deleted_at', null);

      if (error) {
        console.error('Error regenerating join code:', error);
        return {
          success: false,
          error: 'Failed to regenerate join code',
          code: 'JOIN_CODE_UPDATE_ERROR',
        };
      }

      return {
        success: true,
        data: {
          join_code: newJoinCode,
          expires_at: expiresAt.toISOString(),
        },
      };
    } catch (error) {
      console.error('Join code regeneration error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Get course statistics (for dashboards)
   */
  async getCourseStats(
    requestingUserId: string,
    userRole: UserRole,
    organizationId?: string
  ): Promise<ServiceResponse<CourseStats>> {
    try {
      let baseQuery = this.supabase
        .from('courses')
        .select('id, is_active, enrollments(id)')
        .is('deleted_at', null);

      // Apply role-based filtering
      if (userRole === UserRole.INSTRUCTOR) {
        baseQuery = baseQuery.eq('instructor_id', requestingUserId);
      } else if (organizationId) {
        baseQuery = baseQuery.eq('organization_id', organizationId);
      }

      const { data, error } = await baseQuery;

      if (error) {
        console.error('Error fetching course stats:', error);
        return {
          success: false,
          error: 'Failed to fetch course statistics',
          code: 'STATS_FETCH_ERROR',
        };
      }

      const courses = data || [];
      const activeCourses = courses.filter(c => c.is_active);
      const totalEnrollments = courses.reduce((sum, course) => 
        sum + (course.enrollments?.length || 0), 0);

      const stats: CourseStats = {
        total_courses: courses.length,
        active_courses: activeCourses.length,
        total_enrollments: totalEnrollments,
        average_enrollment: courses.length > 0 ? totalEnrollments / courses.length : 0,
        courses_by_status: {
          active: activeCourses.length,
          inactive: courses.length - activeCourses.length,
          draft: 0, // Could be enhanced to track draft status
        },
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('Course stats error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Check if user has authority to perform an action on a course
   */
  private async checkCourseAuthority(
    courseId: string,
    userId: string,
    userRole: UserRole,
    action: 'view' | 'update' | 'delete' | 'view_roster' | 'manage_enrollment'
  ): Promise<ServiceResponse<void>> {
    try {
      const { data: course, error } = await this.supabase
        .from('courses')
        .select('instructor_id, organization_id')
        .eq('id', courseId)
        .is('deleted_at', null)
        .single();

      if (error) {
        return {
          success: false,
          error: 'Course not found',
          code: 'COURSE_NOT_FOUND',
        };
      }

      // Admin can do everything
      if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) {
        return { success: true };
      }

      // Instructor can manage their own courses
      if (userRole === UserRole.INSTRUCTOR && course.instructor_id === userId) {
        return { success: true };
      }

      // Students can only view courses they're enrolled in
      if (userRole === UserRole.STUDENT && action === 'view') {
        const { data: enrollment } = await this.supabase
          .from('enrollments')
          .select('id')
          .eq('course_id', courseId)
          .eq('student_id', userId)
          .eq('is_active', true)
          .single();

        if (enrollment) {
          return { success: true };
        }
      }

      return {
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
      };
    } catch (error) {
      console.error('Course authority check error:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      };
    }
  }
}