/**
 * Course Models and Types
 * 
 * TypeScript interfaces and types for the Course entity
 * Compatible with the database schema and includes validation schemas
 */

import { z } from 'zod';

/**
 * Base Course interface from database
 */
export interface Course {
  id: string;
  title: string;
  description?: string;
  course_code?: string;
  instructor_id: string;
  organization_id: string;
  is_active: boolean;
  max_students?: number;
  join_code?: string;
  join_code_expires_at?: string;
  start_date?: string;
  end_date?: string;
  metadata: Record<string, any>;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Course with instructor information (for API responses)
 */
export interface CourseWithInstructor extends Course {
  instructor: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
  organization?: {
    id: string;
    name: string;
  };
  enrollment_count?: number;
  is_enrolled?: boolean; // For student users
}

/**
 * Course with enrollment details (for roster views)
 */
export interface CourseWithEnrollments extends CourseWithInstructor {
  enrollments: {
    id: string;
    student: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
    enrolled_at: string;
    enrollment_method: string;
    is_active: boolean;
  }[];
}

/**
 * Course creation request interface
 */
export interface CreateCourseRequest {
  title: string;
  description?: string;
  course_code?: string;
  max_students?: number;
  start_date?: string;
  end_date?: string;
  metadata?: Record<string, any>;
}

/**
 * Course update request interface
 */
export interface UpdateCourseRequest {
  title?: string;
  description?: string;
  course_code?: string;
  is_active?: boolean;
  max_students?: number;
  join_code_expires_at?: string;
  start_date?: string;
  end_date?: string;
  metadata?: Record<string, any>;
}

/**
 * Course enrollment request
 */
export interface EnrollmentRequest {
  join_code: string;
}

/**
 * Course list query parameters
 */
export interface CourseListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  instructor_id?: string;
  organization_id?: string;
  enrolled?: boolean; // For student users - show only enrolled courses
  sort_by?: 'title' | 'created_at' | 'start_date' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

/**
 * Course list response with pagination
 */
export interface CourseListResponse {
  courses: CourseWithInstructor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

/**
 * Course statistics for dashboard
 */
export interface CourseStats {
  total_courses: number;
  active_courses: number;
  total_enrollments: number;
  average_enrollment: number;
  courses_by_status: {
    active: number;
    inactive: number;
    draft: number;
  };
}

/**
 * Zod validation schemas
 */

// Course creation validation schema
export const CreateCourseSchema = z.object({
  title: z
    .string()
    .min(1, 'Course title is required')
    .max(255, 'Course title must be less than 255 characters'),
  description: z
    .string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
  course_code: z
    .string()
    .max(20, 'Course code must be less than 20 characters')
    .regex(/^[A-Z0-9-_]*$/, 'Course code can only contain uppercase letters, numbers, hyphens, and underscores')
    .optional(),
  max_students: z
    .number()
    .int()
    .positive('Maximum students must be a positive number')
    .max(1000, 'Maximum students cannot exceed 1000')
    .optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).refine((data) => {
  // Validate that end_date is after start_date if both are provided
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) > new Date(data.start_date);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['end_date'],
});

// Course update validation schema
export const UpdateCourseSchema = z.object({
  title: z
    .string()
    .min(1, 'Course title is required')
    .max(255, 'Course title must be less than 255 characters')
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional()
    .nullable(),
  course_code: z
    .string()
    .max(20, 'Course code must be less than 20 characters')
    .regex(/^[A-Z0-9-_]*$/, 'Course code can only contain uppercase letters, numbers, hyphens, and underscores')
    .optional()
    .nullable(),
  is_active: z.boolean().optional(),
  max_students: z
    .number()
    .int()
    .positive('Maximum students must be a positive number')
    .max(1000, 'Maximum students cannot exceed 1000')
    .optional()
    .nullable(),
  join_code_expires_at: z
    .string()
    .datetime('Invalid datetime format for join code expiry')
    .optional()
    .nullable(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  metadata: z.record(z.string(), z.any()).optional(),
}).refine((data) => {
  // Validate that end_date is after start_date if both are provided
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) > new Date(data.start_date);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['end_date'],
});

// Course enrollment validation schema
export const EnrollmentRequestSchema = z.object({
  join_code: z
    .string()
    .min(6, 'Join code must be at least 6 characters')
    .max(12, 'Join code must be less than 12 characters')
    .regex(/^[A-Z0-9]+$/, 'Join code can only contain uppercase letters and numbers'),
});

// Course list query validation schema
export const CourseListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 1)
    .refine((val) => val >= 1, { message: 'Page must be at least 1' }),
  limit: z
    .string()
    .optional()
    .transform((val) => val ? parseInt(val, 10) : 20)
    .refine((val) => val >= 1 && val <= 100, { 
      message: 'Limit must be between 1 and 100' 
    }),
  search: z
    .string()
    .max(255, 'Search query must be less than 255 characters')
    .optional(),
  status: z
    .enum(['active', 'inactive', 'all'])
    .optional()
    .default('active'),
  instructor_id: z
    .string()
    .uuid('Invalid instructor ID format')
    .optional(),
  organization_id: z
    .string()
    .uuid('Invalid organization ID format')
    .optional(),
  enrolled: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  sort_by: z
    .enum(['title', 'created_at', 'start_date', 'updated_at'])
    .optional()
    .default('created_at'),
  sort_order: z
    .enum(['asc', 'desc'])
    .optional()
    .default('desc'),
});

// Course ID parameter validation
export const CourseIdSchema = z.object({
  courseId: z.string().uuid('Invalid course ID format'),
});

// Student ID parameter validation (for enrollment endpoints)
export const StudentIdSchema = z.object({
  studentId: z.string().uuid('Invalid student ID format'),
});

/**
 * Type guards for runtime type checking
 */
export function isCourse(obj: any): obj is Course {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.instructor_id === 'string' &&
    typeof obj.organization_id === 'string' &&
    typeof obj.is_active === 'boolean'
  );
}

export function isCourseWithInstructor(obj: any): obj is CourseWithInstructor {
  return (
    obj &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof (obj as any).instructor?.id === 'string' &&
    typeof (obj as any).instructor?.first_name === 'string' &&
    typeof (obj as any).instructor?.last_name === 'string'
  );
}

/**
 * Helper functions
 */

/**
 * Generate a random join code for course enrollment
 */
export function generateJoinCode(): string {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Removed O, 0 for clarity
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Check if a course is currently active based on dates and status
 */
export function isCourseCurrentlyActive(course: Course): boolean {
  if (!course.is_active) return false;
  if (course.deleted_at) return false;
  
  const now = new Date();
  const startDate = course.start_date ? new Date(course.start_date) : null;
  const endDate = course.end_date ? new Date(course.end_date) : null;
  
  // Check if we're within the course date range
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  
  return true;
}

/**
 * Get course enrollment status text
 */
export function getCourseEnrollmentStatus(course: CourseWithInstructor): string {
  if (!course.enrollment_count) return 'No students';
  if (!course.max_students) return `${course.enrollment_count} students`;
  
  const percentage = (course.enrollment_count / course.max_students) * 100;
  if (percentage >= 100) return 'Full';
  if (percentage >= 80) return 'Nearly full';
  
  return `${course.enrollment_count}/${course.max_students} students`;
}

/**
 * Format course display name
 */
export function formatCourseDisplayName(course: Course): string {
  if (course.course_code) {
    return `${course.course_code}: ${course.title}`;
  }
  return course.title;
}

// Export validation schemas for use in API routes
export {
  CreateCourseSchema as courseCreateSchema,
  UpdateCourseSchema as courseUpdateSchema,
  EnrollmentRequestSchema as courseEnrollSchema,
  CourseListQuerySchema as courseListQuerySchema,
  CourseIdSchema as courseIdSchema,
  StudentIdSchema as studentIdSchema,
};