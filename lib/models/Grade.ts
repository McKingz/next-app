/**
 * Grade Models and Types
 * 
 * Comprehensive TypeScript interfaces, types, and validation schemas
 * for grade management in the educational system.
 */

import { z } from 'zod';

// ====================================================================
// CORE GRADE TYPES
// ====================================================================

export interface Grade {
  id: string;
  submission_id: string;
  graded_by: string;
  points_earned: number;
  points_possible: number;
  percentage: number;
  letter_grade?: string;
  feedback?: string;
  rubric_scores: Record<string, any>;
  ai_assistance_used: boolean;
  ai_suggestions: Record<string, any>;
  is_final: boolean;
  is_published: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface GradeWithSubmission extends Grade {
  submission: {
    id: string;
    student_id: string;
    assignment_id: string;
    content?: string;
    submission_type: string;
    attempt_number: number;
    submitted_at: string;
    is_late: boolean;
    is_draft: boolean;
    student: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
    assignment: {
      id: string;
      title: string;
      assignment_type: string;
      max_points: number;
      due_at?: string;
      course: {
        id: string;
        title: string;
        instructor_id: string;
      };
    };
  };
}

export interface GradeWithDetails extends Grade {
  grader: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
  submission: {
    student: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
    assignment: {
      title: string;
      max_points: number;
    };
  };
}

// ====================================================================
// GRADE ENUMS AND TYPES
// ====================================================================

export type LetterGrade = 
  | 'A+' | 'A' | 'A-'
  | 'B+' | 'B' | 'B-' 
  | 'C+' | 'C' | 'C-'
  | 'D+' | 'D' | 'D-'
  | 'F'
  | 'Pass' | 'Fail' 
  | 'Incomplete' | 'Withdraw';

export type GradeStatus = 
  | 'draft'      // Grade is being worked on
  | 'final'      // Grade is complete but not published
  | 'published'  // Grade is visible to student
  | 'revised';   // Grade has been updated after initial grading

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  points: number;
  weight?: number;
  levels: RubricLevel[];
}

export interface RubricLevel {
  id: string;
  name: string;
  description: string;
  points: number;
}

export interface RubricScore {
  criterion_id: string;
  level_id: string;
  points: number;
  comments?: string;
}

// ====================================================================
// REQUEST/RESPONSE TYPES
// ====================================================================

export interface CreateGradeRequest {
  submission_id: string;
  points_earned: number;
  points_possible: number;
  letter_grade?: LetterGrade;
  feedback?: string;
  rubric_scores?: Record<string, RubricScore>;
  ai_assistance_used?: boolean;
  ai_suggestions?: Record<string, any>;
  is_final?: boolean;
  is_published?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateGradeRequest {
  points_earned?: number;
  points_possible?: number;
  letter_grade?: LetterGrade;
  feedback?: string;
  rubric_scores?: Record<string, RubricScore>;
  ai_assistance_used?: boolean;
  ai_suggestions?: Record<string, any>;
  is_final?: boolean;
  is_published?: boolean;
  metadata?: Record<string, any>;
}

export interface GradeListParams {
  submission_id?: string;
  student_id?: string;
  assignment_id?: string;
  course_id?: string;
  graded_by?: string;
  letter_grade?: LetterGrade;
  min_percentage?: number;
  max_percentage?: number;
  is_published?: boolean;
  is_final?: boolean;
  graded_after?: string;
  graded_before?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: 'created_at' | 'points_earned' | 'percentage' | 'student_name' | 'assignment_title';
  order?: 'asc' | 'desc';
}

export interface GradeListResponse {
  grades: GradeWithSubmission[] | GradeWithDetails[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

export interface BulkGradeRequest {
  grades: Array<{
    submission_id: string;
    points_earned: number;
    letter_grade?: LetterGrade;
    feedback?: string;
    rubric_scores?: Record<string, RubricScore>;
  }>;
  is_published?: boolean;
  ai_assistance_used?: boolean;
}

// ====================================================================
// GRADE STATISTICS
// ====================================================================

export interface GradeStats {
  total_grades: number;
  published_grades: number;
  draft_grades: number;
  average_percentage: number;
  median_percentage: number;
  grade_distribution: Record<LetterGrade, number>;
  percentage_distribution: {
    'A (90-100)': number;
    'B (80-89)': number;
    'C (70-79)': number;
    'D (60-69)': number;
    'F (0-59)': number;
  };
  grades_by_assignment: Array<{
    assignment_id: string;
    assignment_title: string;
    graded_count: number;
    average_score: number;
  }>;
  ai_assistance_usage: number;
}

export interface StudentGradeReport {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  course: {
    id: string;
    title: string;
    course_code?: string;
  };
  grades: Array<{
    assignment: {
      id: string;
      title: string;
      assignment_type: string;
      max_points: number;
      due_at?: string;
    };
    grade: {
      points_earned: number;
      points_possible: number;
      percentage: number;
      letter_grade?: LetterGrade;
      feedback?: string;
      created_at: string;
    };
  }>;
  summary: {
    total_assignments: number;
    graded_assignments: number;
    overall_percentage: number;
    overall_letter_grade: LetterGrade;
    trend: 'improving' | 'declining' | 'stable';
  };
}

// ====================================================================
// VALIDATION SCHEMAS
// ====================================================================

// Letter grade validation
export const LetterGradeSchema = z.enum([
  'A+', 'A', 'A-', 
  'B+', 'B', 'B-', 
  'C+', 'C', 'C-',
  'D+', 'D', 'D-', 
  'F',
  'Pass', 'Fail', 
  'Incomplete', 'Withdraw'
]);

// Rubric score validation
export const RubricScoreSchema = z.object({
  criterion_id: z.string().uuid(),
  level_id: z.string().uuid(),
  points: z.number().min(0),
  comments: z.string().max(1000).optional(),
});

// Create grade validation
export const CreateGradeSchema = z.object({
  submission_id: z.string().uuid('Invalid submission ID'),
  
  points_earned: z.number()
    .min(0, 'Points earned must be non-negative'),
  
  points_possible: z.number()
    .min(0.1, 'Points possible must be greater than 0')
    .max(10000, 'Points possible cannot exceed 10000'),
  
  letter_grade: LetterGradeSchema.optional(),
  
  feedback: z.string()
    .max(10000, 'Feedback must be less than 10000 characters')
    .optional(),
  
  rubric_scores: z.record(z.string(), RubricScoreSchema).default({}),
  
  ai_assistance_used: z.boolean().default(false),
  
  ai_suggestions: z.record(z.string(), z.any()).default({}),
  
  is_final: z.boolean().default(true),
  
  is_published: z.boolean().default(false),
  
  metadata: z.record(z.string(), z.any()).default({}),
}).refine((data) => {
  // Points earned cannot exceed points possible
  return data.points_earned <= data.points_possible;
}, {
  message: 'Points earned cannot exceed points possible',
  path: ['points_earned']
});

// Update grade validation
export const UpdateGradeSchema = z.object({
  points_earned: z.number()
    .min(0, 'Points earned must be non-negative')
    .optional(),
  
  points_possible: z.number()
    .min(0.1, 'Points possible must be greater than 0')
    .max(10000, 'Points possible cannot exceed 10000')
    .optional(),
  
  letter_grade: LetterGradeSchema.optional(),
  
  feedback: z.string()
    .max(10000, 'Feedback must be less than 10000 characters')
    .optional(),
  
  rubric_scores: z.record(z.string(), RubricScoreSchema).optional(),
  
  ai_assistance_used: z.boolean().optional(),
  
  ai_suggestions: z.record(z.string(), z.any()).optional(),
  
  is_final: z.boolean().optional(),
  
  is_published: z.boolean().optional(),
  
  metadata: z.record(z.string(), z.any()).optional(),
}).refine((data) => {
  // If both points are provided, earned cannot exceed possible
  if (data.points_earned !== undefined && data.points_possible !== undefined) {
    return data.points_earned <= data.points_possible;
  }
  return true;
}, {
  message: 'Points earned cannot exceed points possible',
  path: ['points_earned']
});

// Grade list params validation
export const GradeListParamsSchema = z.object({
  submission_id: z.string().uuid().optional(),
  student_id: z.string().uuid().optional(),
  assignment_id: z.string().uuid().optional(),
  course_id: z.string().uuid().optional(),
  graded_by: z.string().uuid().optional(),
  letter_grade: LetterGradeSchema.optional(),
  min_percentage: z.number().min(0).max(100).optional(),
  max_percentage: z.number().min(0).max(100).optional(),
  is_published: z.boolean().optional(),
  is_final: z.boolean().optional(),
  graded_after: z.string().datetime().optional(),
  graded_before: z.string().datetime().optional(),
  search: z.string().max(255).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort: z.enum(['created_at', 'points_earned', 'percentage', 'student_name', 'assignment_title']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Bulk grade validation
export const BulkGradeSchema = z.object({
  grades: z.array(z.object({
    submission_id: z.string().uuid(),
    points_earned: z.number().min(0),
    letter_grade: LetterGradeSchema.optional(),
    feedback: z.string().max(10000).optional(),
    rubric_scores: z.record(z.string(), RubricScoreSchema).default({}),
  })).min(1, 'At least one grade is required').max(100, 'Cannot grade more than 100 submissions at once'),
  
  is_published: z.boolean().default(false),
  ai_assistance_used: z.boolean().default(false),
});

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Calculate percentage from points
 */
export function calculatePercentage(pointsEarned: number, pointsPossible: number): number {
  if (pointsPossible <= 0) return 0;
  return Math.round((pointsEarned / pointsPossible) * 100 * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert percentage to letter grade using standard scale
 */
export function percentageToLetterGrade(percentage: number, useStandardScale: boolean = true): LetterGrade {
  if (useStandardScale) {
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
  }
  
  // Simple A-F scale
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

/**
 * Get letter grade numerical value for sorting/calculations
 */
export function letterGradeToPoints(letterGrade: LetterGrade): number {
  const gradePoints: Record<LetterGrade, number> = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0,
    'Pass': 4.0, 'Fail': 0.0,
    'Incomplete': 0.0, 'Withdraw': 0.0
  };
  
  return gradePoints[letterGrade] || 0.0;
}

/**
 * Calculate weighted grade from rubric scores
 */
export function calculateRubricGrade(
  rubricScores: Record<string, RubricScore>,
  criteria: RubricCriterion[]
): { points: number; maxPoints: number } {
  let totalPoints = 0;
  let totalMaxPoints = 0;
  
  criteria.forEach(criterion => {
    const score = rubricScores[criterion.id];
    if (score) {
      const weight = criterion.weight || 1;
      totalPoints += score.points * weight;
      totalMaxPoints += criterion.points * weight;
    } else {
      const weight = criterion.weight || 1;
      totalMaxPoints += criterion.points * weight;
    }
  });
  
  return { points: totalPoints, maxPoints: totalMaxPoints };
}

/**
 * Apply late penalty to grade
 */
export function applyLatePenalty(
  originalPoints: number,
  penaltyPercent: number,
  isLate: boolean
): number {
  if (!isLate || penaltyPercent <= 0) {
    return originalPoints;
  }
  
  const penalty = (originalPoints * penaltyPercent) / 100;
  return Math.max(0, originalPoints - penalty);
}

/**
 * Generate grade summary text
 */
export function getGradeSummary(grade: Grade): string {
  const parts = [];
  
  parts.push(`${grade.points_earned}/${grade.points_possible} (${grade.percentage}%)`);
  
  if (grade.letter_grade) {
    parts.push(`Grade: ${grade.letter_grade}`);
  }
  
  if (grade.ai_assistance_used) {
    parts.push('AI Assisted');
  }
  
  if (!grade.is_published) {
    parts.push('Unpublished');
  } else if (!grade.is_final) {
    parts.push('Draft');
  }
  
  return parts.join(' • ');
}

/**
 * Validate grade business rules
 */
export function validateGradeRules(
  grade: CreateGradeRequest | UpdateGradeRequest,
  assignment: { max_points: number; allow_extra_credit?: boolean }
): string[] {
  const errors: string[] = [];
  
  if (grade.points_earned !== undefined && grade.points_possible !== undefined) {
    // Check if points exceed assignment maximum (unless extra credit allowed)
    if (!assignment.allow_extra_credit && grade.points_possible > assignment.max_points) {
      errors.push(`Points possible (${grade.points_possible}) cannot exceed assignment maximum (${assignment.max_points})`);
    }
    
    // Check reasonable limits
    if (grade.points_earned > grade.points_possible * 1.5) {
      errors.push('Points earned seems unreasonably high');
    }
  }
  
  return errors;
}

/**
 * Grade status display names and colors
 */
export const GRADE_STATUS_CONFIG: Record<GradeStatus, {
  label: string;
  color: string;
  icon: string;
}> = {
  draft: { label: 'Draft', color: 'gray', icon: '📝' },
  final: { label: 'Final', color: 'blue', icon: '✅' },
  published: { label: 'Published', color: 'green', icon: '📢' },
  revised: { label: 'Revised', color: 'orange', icon: '🔄' },
};

/**
 * Letter grade display colors
 */
export const LETTER_GRADE_COLORS: Record<string, string> = {
  'A+': '#22c55e', 'A': '#22c55e', 'A-': '#22c55e',
  'B+': '#3b82f6', 'B': '#3b82f6', 'B-': '#3b82f6',
  'C+': '#f59e0b', 'C': '#f59e0b', 'C-': '#f59e0b',
  'D+': '#f97316', 'D': '#f97316', 'D-': '#f97316',
  'F': '#ef4444',
  'Pass': '#22c55e',
  'Fail': '#ef4444',
  'Incomplete': '#6b7280',
  'Withdraw': '#6b7280',
};