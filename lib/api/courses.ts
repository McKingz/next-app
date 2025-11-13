/**
 * Course CRUD API Endpoints
 * 
 * RESTful API endpoints for Course management with comprehensive security
 * Uses route guards for RBAC authorization and validation
 */

import { RouteGuards, createRouteGuard, UserRole, Permission } from '../security/routeGuards';
import { CourseService } from '../services/CourseService';
import {
  courseCreateSchema,
  courseUpdateSchema,
  courseEnrollSchema,
  courseListQuerySchema,
  courseIdSchema,
  studentIdSchema,
  type CreateCourseRequest,
  type UpdateCourseRequest,
  type CourseListQuery,
} from '../models/Course';

const courseService = new CourseService();

/**
 * GET /api/courses - List courses with pagination and filtering
 * 
 * Authorization:
 * - Students: Only enrolled courses or courses in their organization
 * - Instructors: Their courses + courses in their organization  
 * - Admins: All courses in their organization(s)
 */
export const listCourses = RouteGuards.authenticated({
  validation: {
    query: courseListQuerySchema,
  },
})(
  async (request, { data, user, profile }) => {
    try {
      const query: CourseListQuery = data.query;

      const result = await courseService.listCourses(
        query,
        user.id,
        profile.role as UserRole,
        profile.organization_id
      );

      if (!result.success) {
        return new Response(JSON.stringify({
          error: result.error,
          code: result.code,
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: result.data,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('List courses error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
);

/**
 * POST /api/courses - Create a new course
 * 
 * Authorization: Instructors and Admins only
 */
export const createCourse = createRouteGuard()
  .authentication(true)
  .requirePermissions([Permission.MANAGE_COURSES])
  .validation({ body: courseCreateSchema })
  .rateLimit('api')
  .build()(
    async (request, { data, user, profile }) => {
      try {
        const courseData: CreateCourseRequest = data.body;

        const result = await courseService.createCourse(
          courseData,
          user.id,
          profile.organization_id
        );

        if (!result.success) {
          return new Response(JSON.stringify({
            error: result.error,
            code: result.code,
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          data: result.data,
          message: 'Course created successfully',
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Create course error:', error);
        return new Response(JSON.stringify({
          error: 'Internal server error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  );

/**
 * GET /api/courses/:courseId - Get a specific course
 * 
 * Authorization:
 * - Students: Only enrolled courses
 * - Instructors: Their courses + courses in their organization
 * - Admins: All courses in their organization(s)
 */
export const getCourse = RouteGuards.authenticated({
  validation: {
    params: courseIdSchema,
  },
})(
  async (request, { data, user, profile }) => {
    try {
      const { courseId } = data.params;

      const result = await courseService.getCourseById(
        courseId,
        user.id,
        profile.role as UserRole
      );

      if (!result.success) {
        const statusCode = result.code === 'COURSE_NOT_FOUND' ? 404 : 400;
        return new Response(JSON.stringify({
          error: result.error,
          code: result.code,
        }), {
          status: statusCode,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: result.data,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get course error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
);

/**
 * PATCH /api/courses/:courseId - Update a course
 * 
 * Authorization: Course instructor or Admin
 */
export const updateCourse = createRouteGuard()
  .authentication(true)
  .requirePermissions([Permission.MANAGE_COURSES])
  .validation({
    params: courseIdSchema,
    body: courseUpdateSchema,
  })
  .rateLimit('api')
  .build()(
    async (request, { data, user, profile }) => {
      try {
        const { courseId } = data.params;
        const updates: UpdateCourseRequest = data.body;

        const result = await courseService.updateCourse(
          courseId,
          updates,
          user.id,
          profile.role as UserRole
        );

        if (!result.success) {
          const statusCode = result.code === 'COURSE_NOT_FOUND' ? 404 : 
                            result.code === 'INSUFFICIENT_PERMISSIONS' ? 403 : 400;
          return new Response(JSON.stringify({
            error: result.error,
            code: result.code,
          }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          data: result.data,
          message: 'Course updated successfully',
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Update course error:', error);
        return new Response(JSON.stringify({
          error: 'Internal server error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  );

/**
 * DELETE /api/courses/:courseId - Soft delete a course
 * 
 * Authorization: Course instructor or Admin
 */
export const deleteCourse = createRouteGuard()
  .authentication(true)
  .requirePermissions([Permission.MANAGE_COURSES])
  .validation({
    params: courseIdSchema,
  })
  .rateLimit('api')
  .build()(
    async (request, { data, user, profile }) => {
      try {
        const { courseId } = data.params;

        const result = await courseService.deleteCourse(
          courseId,
          user.id,
          profile.role as UserRole
        );

        if (!result.success) {
          const statusCode = result.code === 'COURSE_NOT_FOUND' ? 404 : 
                            result.code === 'INSUFFICIENT_PERMISSIONS' ? 403 : 400;
          return new Response(JSON.stringify({
            error: result.error,
            code: result.code,
          }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Course deleted successfully',
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Delete course error:', error);
        return new Response(JSON.stringify({
          error: 'Internal server error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  );

/**
 * POST /api/courses/:courseId/enroll - Enroll in a course using join code
 * 
 * Authorization: Students only
 */
export const enrollInCourse = createRouteGuard()
  .authentication(true)
  .requireRoles(UserRole.STUDENT)
  .validation({
    params: courseIdSchema,
    body: courseEnrollSchema,
  })
  .rateLimit('api')
  .build()(
    async (request, { data, user, profile }) => {
      try {
        const { courseId } = data.params;
        const { join_code } = data.body;

        const result = await courseService.enrollStudent(
          courseId,
          user.id,
          join_code
        );

        if (!result.success) {
          const statusCode = result.code === 'COURSE_NOT_FOUND' ? 404 : 
                            result.code === 'INVALID_JOIN_CODE' ? 400 :
                            result.code === 'JOIN_CODE_EXPIRED' ? 410 :
                            result.code === 'ALREADY_ENROLLED' ? 409 :
                            result.code === 'COURSE_FULL' ? 409 : 400;
          
          return new Response(JSON.stringify({
            error: result.error,
            code: result.code,
          }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Successfully enrolled in course',
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Course enrollment error:', error);
        return new Response(JSON.stringify({
          error: 'Internal server error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  );

/**
 * GET /api/courses/:courseId/students - Get course roster
 * 
 * Authorization: Course instructor or Admin
 */
export const getCourseRoster = createRouteGuard()
  .authentication(true)
  .requirePermissions([Permission.VIEW_ENROLLMENTS])
  .validation({
    params: courseIdSchema,
  })
  .build()(
    async (request, { data, user, profile }) => {
      try {
        const { courseId } = data.params;

        const result = await courseService.getCourseRoster(
          courseId,
          user.id,
          profile.role as UserRole
        );

        if (!result.success) {
          const statusCode = result.code === 'COURSE_NOT_FOUND' ? 404 : 
                            result.code === 'INSUFFICIENT_PERMISSIONS' ? 403 : 400;
          return new Response(JSON.stringify({
            error: result.error,
            code: result.code,
          }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          data: result.data,
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Get course roster error:', error);
        return new Response(JSON.stringify({
          error: 'Internal server error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  );

/**
 * DELETE /api/courses/:courseId/students/:studentId - Remove student from course
 * 
 * Authorization: Course instructor or Admin
 */
export const removeStudentFromCourse = createRouteGuard()
  .authentication(true)
  .requirePermissions([Permission.MANAGE_ENROLLMENTS])
  .validation({
    params: courseIdSchema.merge(studentIdSchema),
  })
  .rateLimit('api')
  .build()(
    async (request, { data, user, profile }) => {
      try {
        const { courseId, studentId } = data.params;
        
        // Get optional reason from query params
        const url = new URL(request.url);
        const reason = url.searchParams.get('reason') || undefined;

        const result = await courseService.removeStudentFromCourse(
          courseId,
          studentId,
          user.id,
          profile.role as UserRole,
          reason
        );

        if (!result.success) {
          const statusCode = result.code === 'COURSE_NOT_FOUND' ? 404 : 
                            result.code === 'INSUFFICIENT_PERMISSIONS' ? 403 : 400;
          return new Response(JSON.stringify({
            error: result.error,
            code: result.code,
          }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Student removed from course successfully',
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Remove student error:', error);
        return new Response(JSON.stringify({
          error: 'Internal server error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  );

/**
 * POST /api/courses/:courseId/join-code/regenerate - Regenerate join code
 * 
 * Authorization: Course instructor or Admin
 */
export const regenerateJoinCode = createRouteGuard()
  .authentication(true)
  .requirePermissions([Permission.MANAGE_COURSES])
  .validation({
    params: courseIdSchema,
  })
  .rateLimit('api')
  .build()(
    async (request, { data, user, profile }) => {
      try {
        const { courseId } = data.params;

        const result = await courseService.regenerateJoinCode(
          courseId,
          user.id,
          profile.role as UserRole
        );

        if (!result.success) {
          const statusCode = result.code === 'COURSE_NOT_FOUND' ? 404 : 
                            result.code === 'INSUFFICIENT_PERMISSIONS' ? 403 : 400;
          return new Response(JSON.stringify({
            error: result.error,
            code: result.code,
          }), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          data: result.data,
          message: 'Join code regenerated successfully',
        }), {
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Regenerate join code error:', error);
        return new Response(JSON.stringify({
          error: 'Internal server error',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  );

/**
 * GET /api/courses/stats - Get course statistics
 * 
 * Authorization: Authenticated users (results filtered by role)
 */
export const getCourseStats = RouteGuards.authenticated()(
  async (request, { data, user, profile }) => {
    try {
      const result = await courseService.getCourseStats(
        user.id,
        profile.role as UserRole,
        profile.organization_id
      );

      if (!result.success) {
        return new Response(JSON.stringify({
          error: result.error,
          code: result.code,
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: result.data,
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get course stats error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
);

/**
 * Export all course endpoints for easy integration with API routing
 */
export const CourseEndpoints = {
  // CRUD operations
  'GET /api/courses': listCourses,
  'POST /api/courses': createCourse,
  'GET /api/courses/:courseId': getCourse,
  'PATCH /api/courses/:courseId': updateCourse,
  'DELETE /api/courses/:courseId': deleteCourse,

  // Enrollment operations
  'POST /api/courses/:courseId/enroll': enrollInCourse,
  'GET /api/courses/:courseId/students': getCourseRoster,
  'DELETE /api/courses/:courseId/students/:studentId': removeStudentFromCourse,

  // Course management
  'POST /api/courses/:courseId/join-code/regenerate': regenerateJoinCode,

  // Statistics
  'GET /api/courses/stats': getCourseStats,
};

/**
 * Usage examples:
 * 
 * // In Next.js API routes:
 * export { listCourses as GET, createCourse as POST } from './lib/api/courses';
 * 
 * // In Express.js:
 * app.get('/api/courses', listCourses);
 * app.post('/api/courses', createCourse);
 * 
 * // In Cloudflare Workers:
 * const routes = {
 *   '/api/courses': {
 *     GET: listCourses,
 *     POST: createCourse,
 *   }
 * };
 */