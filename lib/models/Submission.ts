/**
 * Submission Models and Types
 * 
 * Comprehensive TypeScript interfaces, types, and validation schemas
 * for submission management in the educational system.
 */

import { z } from 'zod';

// ====================================================================
// CORE SUBMISSION TYPES
// ====================================================================

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  content?: string;
  attachments: SubmissionAttachment[];
  submission_type: SubmissionType;
  attempt_number: number;
  submitted_at: string;
  is_late: boolean;
  is_draft: boolean;
  ai_assistance_used: boolean;
  ai_assistance_details: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubmissionWithAssignment extends Submission {
  assignment: {
    id: string;
    title: string;
    assignment_type: string;
    max_points: number;
    due_at?: string;
    max_attempts: number;
    allow_late_submissions: boolean;
    late_penalty_percent: number;
    course: {
      id: string;
      title: string;
      course_code?: string;
      instructor_id: string;
    };
  };
}

export interface SubmissionWithGrade extends SubmissionWithAssignment {
  grade?: {
    id: string;
    points_earned: number;
    points_possible: number;
    percentage: number;
    letter_grade?: string;
    feedback?: string;
    is_published: boolean;
    graded_by: string;
    created_at: string;
  };
}

export interface SubmissionWithStudent extends Submission {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  grade?: {
    points_earned: number;
    points_possible: number;
    percentage: number;
    letter_grade?: string;
    is_published: boolean;
  };
}

// ====================================================================
// SUBMISSION ENUMS AND TYPES
// ====================================================================

export type SubmissionType = 
  | 'text'      // Text-based submission
  | 'file'      // File upload
  | 'url'       // URL/link submission
  | 'multiple'; // Mixed content types

export type SubmissionStatus = 
  | 'not_submitted'  // No submission yet
  | 'draft'          // Saved as draft
  | 'submitted'      // Final submission
  | 'late'           // Submitted after due date
  | 'graded'         // Has been graded
  | 'needs_revision'; // Requires resubmission

export interface SubmissionAttachment {
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

export interface CreateSubmissionRequest {
  assignment_id: string;
  content?: string;
  attachments?: Omit<SubmissionAttachment, 'id' | 'uploaded_at'>[];
  submission_type: SubmissionType;
  is_draft?: boolean;
  ai_assistance_used?: boolean;
  ai_assistance_details?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateSubmissionRequest {
  content?: string;
  attachments?: SubmissionAttachment[];
  submission_type?: SubmissionType;
  is_draft?: boolean;
  ai_assistance_used?: boolean;
  ai_assistance_details?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SubmissionListParams {
  assignment_id?: string;
  student_id?: string;
  course_id?: string;
  submission_type?: SubmissionType;
  status?: SubmissionStatus;
  is_late?: boolean;
  is_draft?: boolean;
  has_grade?: boolean;
  search?: string;
  submitted_after?: string;
  submitted_before?: string;
  page?: number;
  limit?: number;
  sort?: 'submitted_at' | 'created_at' | 'student_name' | 'assignment_title';
  order?: 'asc' | 'desc';
}

export interface SubmissionListResponse {
  submissions: SubmissionWithAssignment[] | SubmissionWithStudent[];
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
// SUBMISSION STATISTICS
// ====================================================================

export interface SubmissionStats {
  total_submissions: number;
  draft_submissions: number;
  final_submissions: number;
  late_submissions: number;
  graded_submissions: number;
  submissions_by_type: Record<SubmissionType, number>;
  submissions_by_assignment: Array<{
    assignment_id: string;
    assignment_title: string;
    submission_count: number;
    completion_rate: number;
  }>;
  average_submission_time: number; // Minutes before due date
  ai_assistance_usage: number; // Percentage of submissions using AI
}

// ====================================================================
// VALIDATION SCHEMAS
// ====================================================================

// Submission type validation
export const SubmissionTypeSchema = z.enum([
  'text', 
  'file', 
  'url', 
  'multiple'
]);

// Submission attachment validation
export const SubmissionAttachmentSchema = z.object({
  id: z.string().uuid().optional(),
  filename: z.string().min(1).max(255),
  url: z.string().url(),
  size: z.number().min(0).max(500 * 1024 * 1024), // 500MB max per file
  mime_type: z.string().min(1).max(127),
  uploaded_at: z.string().datetime().optional(),
});

// Create submission validation
export const CreateSubmissionSchema = z.object({
  assignment_id: z.string().uuid('Invalid assignment ID'),
  
  content: z.string()
    .max(50000, 'Content must be less than 50000 characters')
    .optional(),
  
  attachments: z.array(SubmissionAttachmentSchema).default([]),
  
  submission_type: SubmissionTypeSchema,
  
  is_draft: z.boolean().default(false),
  
  ai_assistance_used: z.boolean().default(false),
  
  ai_assistance_details: z.record(z.string(), z.any()).default({}),
  
  metadata: z.record(z.string(), z.any()).default({}),
}).refine((data) => {
  // Validate content requirements based on submission type
  if (!data.is_draft) {
    if (data.submission_type === 'text' && (!data.content || data.content.trim().length === 0)) {
      return false;
    }
    if (['file', 'url', 'multiple'].includes(data.submission_type) && data.attachments.length === 0) {
      return false;
    }
  }
  return true;
}, {
  message: 'Content or attachments required for non-draft submissions',
  path: ['content']
});

// Update submission validation
export const UpdateSubmissionSchema = z.object({
  content: z.string()
    .max(50000, 'Content must be less than 50000 characters')
    .optional(),
  
  attachments: z.array(SubmissionAttachmentSchema).optional(),
  
  submission_type: SubmissionTypeSchema.optional(),
  
  is_draft: z.boolean().optional(),
  
  ai_assistance_used: z.boolean().optional(),
  
  ai_assistance_details: z.record(z.string(), z.any()).optional(),
  
  metadata: z.record(z.string(), z.any()).optional(),
});

// Submission list params validation
export const SubmissionListParamsSchema = z.object({
  assignment_id: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
  submission_type: SubmissionTypeSchema.optional(),
  status: z.enum([
    'not_submitted', 'draft', 'submitted', 'late', 
    'graded', 'needs_revision'
  ]).optional(),
  is_late: z.boolean().optional(),
  is_draft: z.boolean().optional(),
  has_grade: z.boolean().optional(),
  search: z.string().max(255).optional(),
  submitted_after: z.string().datetime().optional(),
  submitted_before: z.string().datetime().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort: z.enum(['submitted_at', 'created_at', 'student_name', 'assignment_title']).default('submitted_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Calculate submission status based on assignment and submission data
 */
export function getSubmissionStatus(
  submission: Submission | null,
  assignment: { due_at?: string; allow_late_submissions: boolean },
  hasGrade: boolean = false
): SubmissionStatus {
  if (!submission) {
    return 'not_submitted';
  }
  
  if (submission.is_draft) {
    return 'draft';
  }
  
  if (hasGrade) {
    return 'graded';
  }
  
  if (submission.is_late) {
    return 'late';
  }
  
  return 'submitted';
}

/**
 * Check if submission is late
 */
export function isSubmissionLate(
  submissionDate: Date,
  dueDate?: string
): boolean {
  if (!dueDate) return false;
  
  const due = new Date(dueDate);
  return submissionDate > due;
}

/**
 * Calculate submission timing (minutes before/after due date)
 */
export function calculateSubmissionTiming(
  submissionDate: Date,
  dueDate?: string
): number {
  if (!dueDate) return 0;
  
  const due = new Date(dueDate);
  const diffMs = due.getTime() - submissionDate.getTime();
  return Math.round(diffMs / (1000 * 60)); // Convert to minutes
}

/**
 * Validate submission against assignment constraints
 */
export function validateSubmissionConstraints(
  submission: CreateSubmissionRequest | UpdateSubmissionRequest,
  assignment: {
    max_attempts: number;
    due_at?: string;
    allow_late_submissions: boolean;
    available_until?: string;
  },
  currentAttempt: number = 1
): string[] {
  const errors: string[] = [];
  const now = new Date();
  
  // Check attempt limits
  if (currentAttempt > assignment.max_attempts) {
    errors.push(`Maximum ${assignment.max_attempts} attempts allowed`);
  }
  
  // Check availability window
  if (assignment.available_until) {
    const availableUntil = new Date(assignment.available_until);
    if (now > availableUntil) {
      errors.push('Assignment is no longer accepting submissions');
    }
  }
  
  // Check late submission policy
  if (assignment.due_at && !assignment.allow_late_submissions) {
    const dueDate = new Date(assignment.due_at);
    if (now > dueDate) {
      errors.push('Late submissions are not allowed for this assignment');
    }
  }
  
  return errors;
}

/**
 * Validate file attachments
 */
export function validateSubmissionAttachments(attachments: SubmissionAttachment[]): string[] {
  const errors: string[] = [];
  const allowedTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/rtf',
    
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/svg+xml',
    
    // Videos
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/webm',
    
    // Audio
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/m4a',
    
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    
    // Code files
    'text/javascript',
    'text/css',
    'text/html',
    'application/json',
    'application/xml'
  ];
  
  const maxFileSize = 100 * 1024 * 1024; // 100MB per file
  const maxTotalSize = 500 * 1024 * 1024; // 500MB total
  const maxFiles = 20;
  
  if (attachments.length > maxFiles) {
    errors.push(`Maximum ${maxFiles} files allowed`);
  }
  
  let totalSize = 0;
  
  for (const attachment of attachments) {
    // Check file type
    if (!allowedTypes.includes(attachment.mime_type)) {
      errors.push(`Unsupported file type: ${attachment.filename}`);
    }
    
    // Check file size
    if (attachment.size > maxFileSize) {
      errors.push(`File too large: ${attachment.filename} (max 100MB)`);
    }
    
    // Check filename
    if (attachment.filename.length > 255) {
      errors.push(`Filename too long: ${attachment.filename}`);
    }
    
    totalSize += attachment.size;
  }
  
  // Check total size
  if (totalSize > maxTotalSize) {
    errors.push('Total attachment size exceeds 500MB');
  }
  
  return errors;
}

/**
 * Generate submission summary text
 */
export function getSubmissionSummary(submission: SubmissionWithAssignment): string {
  const parts = [];
  
  // Submission type
  parts.push(
    submission.submission_type.charAt(0).toUpperCase() + 
    submission.submission_type.slice(1)
  );
  
  // Status
  if (submission.is_draft) {
    parts.push('Draft');
  } else {
    parts.push(`Attempt ${submission.attempt_number}`);
  }
  
  // Late indicator
  if (submission.is_late) {
    parts.push('Late');
  }
  
  // AI assistance
  if (submission.ai_assistance_used) {
    parts.push('AI Assisted');
  }
  
  // Attachment count
  if (submission.attachments.length > 0) {
    parts.push(`${submission.attachments.length} file(s)`);
  }
  
  return parts.join(' • ');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Submission type display names
 */
export const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = {
  text: 'Text Entry',
  file: 'File Upload',
  url: 'URL/Link',
  multiple: 'Mixed Content',
};

/**
 * Submission status display configuration
 */
export const SUBMISSION_STATUS_CONFIG: Record<SubmissionStatus, {
  label: string;
  color: string;
  icon: string;
}> = {
  not_submitted: { label: 'Not Submitted', color: 'gray', icon: '⭕' },
  draft: { label: 'Draft', color: 'blue', icon: '📝' },
  submitted: { label: 'Submitted', color: 'green', icon: '✅' },
  late: { label: 'Late', color: 'orange', icon: '🟡' },
  graded: { label: 'Graded', color: 'purple', icon: '🎯' },
  needs_revision: { label: 'Needs Revision', color: 'red', icon: '🔄' },
};