/**
 * Assignment Models and Types
 * 
 * Comprehensive TypeScript interfaces, types, and validation schemas
 * for assignment management in the educational system.
 */

import { z } from 'zod';

// ====================================================================
// CORE ASSIGNMENT TYPES
// ====================================================================

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  course_id: string;
  assignment_type: AssignmentType;
  max_points: number;
  assigned_at: string;
  due_at?: string;
  available_from: string;
  available_until?: string;
  allow_late_submissions: boolean;
  late_penalty_percent: number;
  max_attempts: number;
  attachments: AssignmentAttachment[];
  metadata: Record<string, any>;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AssignmentWithCourse extends Assignment {
  course: {
    id: string;
    title: string;
    course_code?: string;
    instructor_id: string;
    organization_id: string;
  };
}

export interface AssignmentWithSubmissions extends AssignmentWithCourse {
  submissions_count: number;
  graded_count: number;
  average_score?: number;
  submissions?: AssignmentSubmissionSummary[];
}

export interface AssignmentSubmissionSummary {
  id: string;
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  submitted_at?: string;
  is_late: boolean;
  is_graded: boolean;
  grade?: number;
  percentage?: number;
}

// ====================================================================
// ASSIGNMENT ENUMS AND TYPES
// ====================================================================

export type AssignmentType = 
  | 'homework' 
  | 'quiz' 
  | 'exam' 
  | 'project' 
  | 'lab' 
  | 'discussion';

export type AssignmentStatus = 
  | 'draft'      // Not yet assigned
  | 'active'     // Currently available 
  | 'upcoming'   // Will be available soon
  | 'due_soon'   // Due within 24 hours
  | 'overdue'    // Past due date
  | 'closed'     // No longer accepting submissions
  | 'archived';  // Soft deleted

export interface AssignmentAttachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mime_type: string;
  uploaded_at: string;
}

// ====================================================================
// REQUEST/RESPONSE TYPES
// ====================================================================

export interface CreateAssignmentRequest {
  title: string;
  description?: string;
  instructions?: string;
  course_id: string;
  assignment_type: AssignmentType;
  max_points?: number;
  due_at?: string;
  available_from?: string;
  available_until?: string;
  allow_late_submissions?: boolean;
  late_penalty_percent?: number;
  max_attempts?: number;
  attachments?: Omit<AssignmentAttachment, 'id' | 'uploaded_at'>[];
  metadata?: Record<string, any>;
}

export interface UpdateAssignmentRequest {
  title?: string;
  description?: string;
  instructions?: string;
  assignment_type?: AssignmentType;
  max_points?: number;
  due_at?: string;
  available_from?: string;
  available_until?: string;
  allow_late_submissions?: boolean;
  late_penalty_percent?: number;
  max_attempts?: number;
  attachments?: AssignmentAttachment[];
  metadata?: Record<string, any>;
}

export interface AssignmentListParams {
  course_id?: string;
  assignment_type?: AssignmentType;
  status?: AssignmentStatus;
  search?: string;
  due_after?: string;
  due_before?: string;
  page?: number;
  limit?: number;
  sort?: 'due_at' | 'assigned_at' | 'title' | 'max_points';
  order?: 'asc' | 'desc';
}

export interface AssignmentListResponse {
  assignments: AssignmentWithCourse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

// ====================================================================
// ASSIGNMENT STATISTICS
// ====================================================================

export interface AssignmentStats {
  total_assignments: number;
  active_assignments: number;
  upcoming_assignments: number;
  overdue_assignments: number;
  assignments_by_type: Record<AssignmentType, number>;
  assignments_by_course: Array<{
    course_id: string;
    course_title: string;
    assignment_count: number;
  }>;
  average_completion_rate: number;
  average_score: number;
}

// ====================================================================
// VALIDATION SCHEMAS
// ====================================================================

// Assignment type validation
export const AssignmentTypeSchema = z.enum([
  'homework', 
  'quiz', 
  'exam', 
  'project', 
  'lab', 
  'discussion'
]);

// Assignment attachment validation
export const AssignmentAttachmentSchema = z.object({
  id: z.string().uuid().optional(),
  filename: z.string().min(1).max(255),
  url: z.string().url(),
  size: z.number().min(0).max(100 * 1024 * 1024), // 100MB max
  mime_type: z.string().min(1).max(127),
  uploaded_at: z.string().datetime().optional(),
});

// Base assignment object schema
const BaseAssignmentSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title must be less than 255 characters'),
  
  description: z.string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional(),
  
  instructions: z.string()
    .max(10000, 'Instructions must be less than 10000 characters')
    .optional(),
  
  course_id: z.string().uuid('Invalid course ID'),
  
  assignment_type: AssignmentTypeSchema,
  
  max_points: z.number()
    .min(0, 'Max points must be non-negative')
    .max(10000, 'Max points cannot exceed 10000')
    .default(100),
  
  due_at: z.string()
    .datetime('Invalid due date format')
    .optional(),
  
  available_from: z.string()
    .datetime('Invalid available from date format')
    .default(() => new Date().toISOString()),
  
  available_until: z.string()
    .datetime('Invalid available until date format')
    .optional(),
  
  allow_late_submissions: z.boolean().default(true),
  
  late_penalty_percent: z.number()
    .min(0, 'Late penalty cannot be negative')
    .max(100, 'Late penalty cannot exceed 100%')
    .default(0),
  
  max_attempts: z.number()
    .min(1, 'Must allow at least 1 attempt')
    .max(10, 'Cannot allow more than 10 attempts')
    .default(1),
  
  attachments: z.array(AssignmentAttachmentSchema).default([]),
  
  metadata: z.record(z.string(), z.any()).default({}),
});

// Create assignment validation with refinements
export const CreateAssignmentSchema = BaseAssignmentSchema.refine((data) => {
  // Validate date relationships
  if (data.due_at && data.available_from) {
    return new Date(data.due_at) > new Date(data.available_from);
  }
  return true;
}, {
  message: 'Due date must be after available from date',
  path: ['due_at']
}).refine((data) => {
  // Validate available until date
  if (data.available_until && data.available_from) {
    return new Date(data.available_until) > new Date(data.available_from);
  }
  return true;
}, {
  message: 'Available until date must be after available from date',
  path: ['available_until']
});

// Update assignment validation (without course_id)
export const UpdateAssignmentSchema = BaseAssignmentSchema.omit({
  course_id: true, // Cannot change course after creation
}).partial();

// Assignment list params validation
export const AssignmentListParamsSchema = z.object({
  course_id: z.string().uuid().optional(),
  assignment_type: AssignmentTypeSchema.optional(),
  status: z.enum([
    'draft', 'active', 'upcoming', 'due_soon', 
    'overdue', 'closed', 'archived'
  ]).optional(),
  search: z.string().max(255).optional(),
  due_after: z.string().datetime().optional(),
  due_before: z.string().datetime().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort: z.enum(['due_at', 'assigned_at', 'title', 'max_points']).default('due_at'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Calculate assignment status based on dates
 */
export function getAssignmentStatus(assignment: Assignment): AssignmentStatus {
  const now = new Date();
  const availableFrom = new Date(assignment.available_from);
  const availableUntil = assignment.available_until ? new Date(assignment.available_until) : null;
  const dueAt = assignment.due_at ? new Date(assignment.due_at) : null;
  
  // Check if assignment is deleted
  if (assignment.deleted_at) {
    return 'archived';
  }
  
  // Check if not yet available
  if (now < availableFrom) {
    return 'upcoming';
  }
  
  // Check if past available until date
  if (availableUntil && now > availableUntil) {
    return 'closed';
  }
  
  // Check due date status
  if (dueAt) {
    const hoursToDue = (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursToDue < 0) {
      return assignment.allow_late_submissions ? 'overdue' : 'closed';
    }
    
    if (hoursToDue <= 24) {
      return 'due_soon';
    }
  }
  
  return 'active';
}

/**
 * Calculate late penalty for a submission
 */
export function calculateLatePenalty(
  assignment: Assignment, 
  submissionDate: Date
): number {
  if (!assignment.due_at || !assignment.allow_late_submissions) {
    return 0;
  }
  
  const dueDate = new Date(assignment.due_at);
  const hoursLate = Math.max(0, (submissionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60));
  
  if (hoursLate === 0) {
    return 0;
  }
  
  return assignment.late_penalty_percent;
}

/**
 * Check if assignment accepts submissions
 */
export function canSubmitToAssignment(assignment: Assignment): boolean {
  const status = getAssignmentStatus(assignment);
  return ['active', 'due_soon', 'overdue'].includes(status);
}

/**
 * Generate assignment summary text
 */
export function getAssignmentSummary(assignment: Assignment): string {
  const parts = [
    assignment.assignment_type.charAt(0).toUpperCase() + assignment.assignment_type.slice(1),
    `${assignment.max_points} points`
  ];
  
  if (assignment.due_at) {
    const dueDate = new Date(assignment.due_at);
    parts.push(`Due: ${dueDate.toLocaleDateString()}`);
  }
  
  if (assignment.max_attempts > 1) {
    parts.push(`${assignment.max_attempts} attempts allowed`);
  }
  
  return parts.join(' • ');
}

/**
 * Validate file attachments
 */
export function validateAttachments(attachments: AssignmentAttachment[]): string[] {
  const errors: string[] = [];
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];
  
  const maxSize = 10 * 1024 * 1024; // 10MB per file
  const maxTotal = 100 * 1024 * 1024; // 100MB total
  
  let totalSize = 0;
  
  for (const attachment of attachments) {
    // Check file type
    if (!allowedTypes.includes(attachment.mime_type)) {
      errors.push(`Unsupported file type: ${attachment.filename}`);
    }
    
    // Check file size
    if (attachment.size > maxSize) {
      errors.push(`File too large: ${attachment.filename} (max 10MB)`);
    }
    
    totalSize += attachment.size;
  }
  
  // Check total size
  if (totalSize > maxTotal) {
    errors.push('Total attachment size exceeds 100MB');
  }
  
  return errors;
}

/**
 * Assignment type display names
 */
export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  homework: 'Homework',
  quiz: 'Quiz',
  exam: 'Exam',
  project: 'Project',
  lab: 'Lab Assignment',
  discussion: 'Discussion',
};

/**
 * Assignment status display names and colors
 */
export const ASSIGNMENT_STATUS_CONFIG: Record<AssignmentStatus, {
  label: string;
  color: string;
  icon: string;
}> = {
  draft: { label: 'Draft', color: 'gray', icon: '📝' },
  active: { label: 'Active', color: 'green', icon: '✅' },
  upcoming: { label: 'Upcoming', color: 'blue', icon: '⏳' },
  due_soon: { label: 'Due Soon', color: 'yellow', icon: '⚠️' },
  overdue: { label: 'Overdue', color: 'red', icon: '🔴' },
  closed: { label: 'Closed', color: 'gray', icon: '🔒' },
  archived: { label: 'Archived', color: 'gray', icon: '📁' },
};