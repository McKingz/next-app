/**
 * Enhanced Educational Validation Schemas
 * 
 * Comprehensive validation schemas with business rules, file constraints,
 * date validations, and role-based field restrictions for all educational entities.
 */

import { z } from 'zod';
import { UserRole } from '../security/rbac';

// ====================================================================
// COMMON VALIDATION UTILITIES
// ====================================================================

// File validation schemas
const FileExtensionSchema = z.enum([
  // Documents
  'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  // Audio/Video
  'mp3', 'wav', 'mp4', 'avi', 'mov', 'wmv',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz',
  // Spreadsheets
  'xls', 'xlsx', 'csv', 'ods',
  // Presentations
  'ppt', 'pptx', 'odp',
  // Code files
  'js', 'ts', 'html', 'css', 'py', 'java', 'cpp', 'c', 'json', 'xml'
]);

const FileSizeSchema = z.number()
  .min(1, 'File cannot be empty')
  .max(100 * 1024 * 1024, 'File size cannot exceed 100MB'); // 100MB max

const AttachmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  size: FileSizeSchema,
  type: z.string().regex(/^[a-zA-Z0-9-_/]+$/, 'Invalid file type'),
  extension: FileExtensionSchema,
  url: z.string().url('Invalid file URL').optional(),
  uploaded_at: z.string().datetime().optional(),
  description: z.string().max(500, 'Description too long').optional(),
});

// Date validation utilities
const FutureDateSchema = z.string().datetime().refine((date) => {
  return new Date(date) > new Date();
}, {
  message: 'Date must be in the future'
});

const PastDateSchema = z.string().datetime().refine((date) => {
  return new Date(date) <= new Date();
}, {
  message: 'Date must be in the past or present'
});

// Academic year validation (e.g., "2024-2025")
const AcademicYearSchema = z.string().regex(
  /^\d{4}-\d{4}$/,
  'Academic year must be in format YYYY-YYYY'
).refine((year) => {
  const [start, end] = year.split('-').map(Number);
  return end === start + 1;
}, {
  message: 'Academic year must be consecutive years (e.g., 2024-2025)'
});

// Grade level validation
const GradeLevelSchema = z.enum([
  'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
  'Undergraduate', 'Graduate', 'Postgraduate'
]);

// ====================================================================
// ENHANCED COURSE VALIDATION
// ====================================================================

export const EnhancedCourseCreationSchema = z.object({
  // Basic information
  title: z.string()
    .min(3, 'Course title must be at least 3 characters')
    .max(200, 'Course title cannot exceed 200 characters')
    .regex(/^[a-zA-Z0-9\s\-:()&.,!?]+$/, 'Course title contains invalid characters'),
    
  code: z.string()
    .min(2, 'Course code must be at least 2 characters')
    .max(20, 'Course code cannot exceed 20 characters')
    .regex(/^[A-Z0-9\-_]+$/, 'Course code must be uppercase letters, numbers, hyphens, or underscores'),
    
  description: z.string()
    .min(10, 'Course description must be at least 10 characters')
    .max(5000, 'Course description cannot exceed 5000 characters'),
    
  // Academic details
  credits: z.number()
    .min(0.5, 'Credits must be at least 0.5')
    .max(12, 'Credits cannot exceed 12')
    .refine((credits) => credits % 0.5 === 0, {
      message: 'Credits must be in 0.5 increments'
    }),
    
  grade_level: GradeLevelSchema.optional(),
  
  academic_year: AcademicYearSchema.optional(),
  
  subject_area: z.enum([
    'Mathematics', 'Science', 'English', 'History', 'Social Studies',
    'Physical Education', 'Art', 'Music', 'Computer Science', 'Foreign Language',
    'Business', 'Health', 'Other'
  ]).optional(),
  
  // Enrollment settings
  max_students: z.number()
    .min(1, 'Must allow at least 1 student')
    .max(500, 'Cannot exceed 500 students')
    .optional(),
    
  enrollment_type: z.enum(['open', 'invite_only', 'approval_required']).default('open'),
  
  // Scheduling
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  
  // Features and settings
  allow_late_submissions: z.boolean().default(true),
  late_penalty_percent: z.number()
    .min(0, 'Late penalty cannot be negative')
    .max(100, 'Late penalty cannot exceed 100%')
    .default(10),
    
  allow_student_discussion: z.boolean().default(true),
  enable_gradebook: z.boolean().default(true),
  enable_attendance: z.boolean().default(false),
  
  // Content and resources
  syllabus_url: z.string().url('Invalid syllabus URL').optional(),
  resources: z.array(AttachmentSchema).max(20, 'Cannot exceed 20 resource files').default([]),
  
  // Privacy and access
  is_public: z.boolean().default(false),
  require_join_code: z.boolean().default(false),
  join_code: z.string()
    .min(6, 'Join code must be at least 6 characters')
    .max(12, 'Join code cannot exceed 12 characters')
    .regex(/^[A-Z0-9]+$/, 'Join code must be uppercase letters and numbers')
    .optional(),
    
  join_code_expires_at: z.string().datetime().optional(),
  
  // Metadata
  tags: z.array(z.string().min(1).max(50)).max(10, 'Cannot exceed 10 tags').default([]),
  metadata: z.record(z.string(), z.any()).default({}),
  
}).refine((data) => {
  // End date must be after start date
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) > new Date(data.start_date);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['end_date']
}).refine((data) => {
  // Join code required if require_join_code is true
  if (data.require_join_code && !data.join_code) {
    return false;
  }
  return true;
}, {
  message: 'Join code is required when join code is enabled',
  path: ['join_code']
}).refine((data) => {
  // Join code expiration validation
  if (data.join_code && data.join_code_expires_at) {
    return new Date(data.join_code_expires_at) > new Date();
  }
  return true;
}, {
  message: 'Join code expiration must be in the future',
  path: ['join_code_expires_at']
});

// ====================================================================
// ENHANCED ASSIGNMENT VALIDATION
// ====================================================================

export const EnhancedAssignmentCreationSchema = z.object({
  // Basic information
  title: z.string()
    .min(3, 'Assignment title must be at least 3 characters')
    .max(200, 'Assignment title cannot exceed 200 characters'),
    
  description: z.string()
    .min(10, 'Assignment description must be at least 10 characters')
    .max(10000, 'Assignment description cannot exceed 10000 characters'),
    
  // Assignment type and settings
  assignment_type: z.enum([
    'homework', 'quiz', 'exam', 'project', 'discussion', 'presentation',
    'lab', 'essay', 'research', 'group_work', 'other'
  ]),
  
  submission_type: z.enum(['text', 'file', 'both', 'none']).default('both'),
  
  // Grading
  max_points: z.number()
    .min(0.5, 'Assignment must be worth at least 0.5 points')
    .max(1000, 'Assignment cannot exceed 1000 points'),
    
  grading_type: z.enum(['points', 'percentage', 'letter_grade', 'pass_fail', 'rubric'])
    .default('points'),
    
  // Timing and availability
  assigned_at: z.string().datetime().optional(),
  due_at: z.string().datetime().optional(),
  available_from: z.string().datetime().optional(),
  available_until: z.string().datetime().optional(),
  
  // Submission settings
  allow_late_submissions: z.boolean().default(true),
  late_penalty_percent: z.number()
    .min(0, 'Late penalty cannot be negative')
    .max(100, 'Late penalty cannot exceed 100%')
    .default(0),
    
  max_attempts: z.number()
    .min(0, 'Max attempts cannot be negative')
    .max(10, 'Cannot allow more than 10 attempts')
    .default(1),
    
  time_limit_minutes: z.number()
    .min(1, 'Time limit must be at least 1 minute')
    .max(480, 'Time limit cannot exceed 8 hours (480 minutes)')
    .optional(),
    
  // File submissions
  allowed_file_types: z.array(FileExtensionSchema)
    .max(20, 'Cannot allow more than 20 file types')
    .default([]),
    
  max_file_size_mb: z.number()
    .min(0.1, 'Minimum file size is 0.1 MB')
    .max(100, 'Maximum file size is 100 MB')
    .default(10),
    
  max_files: z.number()
    .min(1, 'Must allow at least 1 file')
    .max(20, 'Cannot allow more than 20 files')
    .default(5),
    
  // Content and resources
  instructions: z.string().max(20000, 'Instructions cannot exceed 20000 characters').optional(),
  attachments: z.array(AttachmentSchema).max(20, 'Cannot exceed 20 attachments').default([]),
  
  // Rubric and AI
  rubric: z.object({
    criteria: z.array(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100),
      description: z.string().max(500),
      points: z.number().min(0).max(100),
      weight: z.number().min(0).max(5).default(1),
      levels: z.array(z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(50),
        description: z.string().max(200),
        points: z.number().min(0),
      })).min(2).max(6)
    })).min(1).max(10)
  }).optional(),
  
  enable_ai_grading: z.boolean().default(false),
  ai_grading_prompt: z.string().max(2000, 'AI grading prompt too long').optional(),
  
  // Collaboration and feedback
  allow_peer_review: z.boolean().default(false),
  peer_review_count: z.number().min(1).max(5).default(2),
  enable_comments: z.boolean().default(true),
  
  // Privacy and visibility
  is_published: z.boolean().default(false),
  show_solutions_after: z.string().datetime().optional(),
  
  // Metadata
  tags: z.array(z.string().min(1).max(50)).max(10).default([]),
  category: z.string().max(100).optional(),
  weight: z.number().min(0).max(10).default(1),
  
}).refine((data) => {
  // Due date must be after assigned date
  if (data.assigned_at && data.due_at) {
    return new Date(data.due_at) > new Date(data.assigned_at);
  }
  return true;
}, {
  message: 'Due date must be after assigned date',
  path: ['due_at']
}).refine((data) => {
  // Available until must be after available from
  if (data.available_from && data.available_until) {
    return new Date(data.available_until) > new Date(data.available_from);
  }
  return true;
}, {
  message: 'Available until must be after available from',
  path: ['available_until']
}).refine((data) => {
  // File submission validation
  if (data.submission_type === 'file' || data.submission_type === 'both') {
    return data.allowed_file_types.length > 0;
  }
  return true;
}, {
  message: 'Must specify allowed file types for file submissions',
  path: ['allowed_file_types']
}).refine((data) => {
  // Peer review validation
  if (data.allow_peer_review) {
    return data.max_attempts === 1; // Peer review only for single submission
  }
  return true;
}, {
  message: 'Peer review requires single submission (max_attempts = 1)',
  path: ['allow_peer_review']
}).refine((data) => {
  // AI grading prompt required if AI grading enabled
  if (data.enable_ai_grading && !data.ai_grading_prompt) {
    return false;
  }
  return true;
}, {
  message: 'AI grading prompt is required when AI grading is enabled',
  path: ['ai_grading_prompt']
});

// ====================================================================
// ENHANCED SUBMISSION VALIDATION
// ====================================================================

export const EnhancedSubmissionCreationSchema = z.object({
  // Basic information
  assignment_id: z.string().uuid(),
  
  // Content
  content: z.string()
    .max(50000, 'Submission content cannot exceed 50000 characters')
    .optional(),
    
  // File submissions
  attachments: z.array(AttachmentSchema)
    .max(20, 'Cannot exceed 20 file attachments')
    .default([]),
    
  // Submission metadata
  submission_type: z.enum(['text', 'file', 'both']).default('both'),
  
  // Timing and attempts
  attempt_number: z.number().min(1).max(10).default(1),
  time_spent_minutes: z.number()
    .min(0, 'Time spent cannot be negative')
    .max(480, 'Time spent cannot exceed 8 hours')
    .optional(),
    
  // Status and workflow
  is_draft: z.boolean().default(false),
  is_final: z.boolean().default(true),
  
  // Collaboration
  collaborators: z.array(z.string().uuid())
    .max(10, 'Cannot have more than 10 collaborators')
    .default([]),
    
  // External integrations
  external_tool_data: z.record(z.string(), z.any()).default({}),
  
  // Student notes and comments
  student_notes: z.string()
    .max(2000, 'Student notes cannot exceed 2000 characters')
    .optional(),
    
  // Plagiarism and integrity
  plagiarism_score: z.number().min(0).max(100).optional(),
  integrity_verified: z.boolean().default(false),
  
  // Metadata
  metadata: z.record(z.string(), z.any()).default({}),
  
}).refine((data) => {
  // Must have content or attachments (unless draft)
  if (!data.is_draft && !data.content && data.attachments.length === 0) {
    return false;
  }
  return true;
}, {
  message: 'Submission must have content or attachments',
  path: ['content', 'attachments']
}).refine((data) => {
  // Final submissions cannot be drafts
  if (data.is_final && data.is_draft) {
    return false;
  }
  return true;
}, {
  message: 'Final submissions cannot be drafts',
  path: ['is_final']
});

// ====================================================================
// ENHANCED GRADE VALIDATION WITH CONTEXT
// ====================================================================

export const EnhancedGradeCreationSchema = z.object({
  // Basic grading information
  submission_id: z.string().uuid(),
  
  // Points and scoring
  points_earned: z.number()
    .min(0, 'Points earned cannot be negative')
    .max(1000, 'Points earned cannot exceed 1000'),
    
  points_possible: z.number()
    .min(0.5, 'Points possible must be at least 0.5')
    .max(1000, 'Points possible cannot exceed 1000'),
    
  // Letter grade
  letter_grade: z.enum([
    'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-',
    'D+', 'D', 'D-', 'F', 'Pass', 'Fail', 'Incomplete', 'Withdraw'
  ]).optional(),
  
  // Detailed feedback
  feedback: z.string()
    .max(10000, 'Feedback cannot exceed 10000 characters')
    .optional(),
    
  private_notes: z.string()
    .max(5000, 'Private notes cannot exceed 5000 characters')
    .optional(),
    
  // Rubric scoring
  rubric_scores: z.record(z.string(), z.object({
    criterion_id: z.string().uuid(),
    level_id: z.string().uuid(),
    points: z.number().min(0).max(100),
    comments: z.string().max(500).optional(),
  })).default({}),
  
  // AI assistance
  ai_assistance_used: z.boolean().default(false),
  ai_suggestions: z.record(z.string(), z.any()).default({}),
  ai_confidence_score: z.number().min(0).max(1).optional(),
  
  // Grading workflow
  is_final: z.boolean().default(true),
  is_published: z.boolean().default(false),
  
  // Time tracking
  grading_time_minutes: z.number()
    .min(0, 'Grading time cannot be negative')
    .max(240, 'Grading time cannot exceed 4 hours')
    .optional(),
    
  // Quality and moderation
  needs_review: z.boolean().default(false),
  review_reason: z.string().max(500).optional(),
  
  // External integrations
  external_grade_id: z.string().max(100).optional(),
  
  // Metadata
  metadata: z.record(z.string(), z.any()).default({}),
  
}).refine((data) => {
  // Points earned cannot exceed points possible (with small buffer for rounding)
  if (data.points_earned > data.points_possible * 1.01) {
    return false;
  }
  return true;
}, {
  message: 'Points earned cannot significantly exceed points possible',
  path: ['points_earned']
}).refine((data) => {
  // Review reason required if needs review
  if (data.needs_review && !data.review_reason) {
    return false;
  }
  return true;
}, {
  message: 'Review reason is required when grade needs review',
  path: ['review_reason']
}).refine((data) => {
  // Published grades should be final
  if (data.is_published && !data.is_final) {
    return false;
  }
  return true;
}, {
  message: 'Published grades must be final',
  path: ['is_published']
});

// ====================================================================
// ROLE-BASED SCHEMA RESTRICTIONS
// ====================================================================

/**
 * Apply role-based restrictions to schemas
 */
export function applyRoleRestrictions<T extends z.ZodTypeAny>(
  schema: T,
  userRole: UserRole,
  restrictions: Record<UserRole, string[]>
): T {
  // For now, return the original schema
  // In a full implementation, you would dynamically modify the schema
  // based on the user's role and the field restrictions
  return schema;
}

// Role-based field restrictions
export const COURSE_FIELD_RESTRICTIONS: Record<UserRole, string[]> = {
  [UserRole.STUDENT]: [
    'instructor_id', 'organization_id', 'is_active', 'max_students',
    'enrollment_type', 'late_penalty_percent'
  ],
  [UserRole.INSTRUCTOR]: ['organization_id', 'instructor_id'],
  [UserRole.ADMIN]: [],
  [UserRole.SUPER_ADMIN]: []
};

export const ASSIGNMENT_FIELD_RESTRICTIONS: Record<UserRole, string[]> = {
  [UserRole.STUDENT]: [
    'instructor_id', 'course_id', 'max_points', 'grading_type',
    'is_published', 'enable_ai_grading'
  ],
  [UserRole.INSTRUCTOR]: [],
  [UserRole.ADMIN]: [],
  [UserRole.SUPER_ADMIN]: []
};

export const GRADE_FIELD_RESTRICTIONS: Record<UserRole, string[]> = {
  [UserRole.STUDENT]: [
    'graded_by', 'ai_assistance_used', 'ai_suggestions', 'private_notes',
    'needs_review', 'review_reason', 'grading_time_minutes'
  ],
  [UserRole.INSTRUCTOR]: [],
  [UserRole.ADMIN]: [],
  [UserRole.SUPER_ADMIN]: []
};

// ====================================================================
// EXPORT ALL SCHEMAS
// ====================================================================

export {
  AttachmentSchema,
  FutureDateSchema,
  PastDateSchema,
  AcademicYearSchema,
  GradeLevelSchema,
  FileExtensionSchema,
  FileSizeSchema
};