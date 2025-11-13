/**
 * Lessons Hub Types and Interfaces
 * 
 * Comprehensive type definitions for the EduDash Pro lessons system
 * covering Robotics, AI, STEM, and Coding curricula.
 */

export interface LessonCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  parent_category_id?: string;
  subcategories?: LessonCategory[];
}

export interface LessonSkillLevel {
  id: string;
  name: string;
  description: string;
  order: number;
  color: string;
}

export interface LessonTag {
  id: string;
  name: string;
  color: string;
  category: 'subject' | 'skill' | 'tool' | 'method' | 'age_group';
}

export interface LessonResource {
  id: string;
  type: 'video' | 'document' | 'image' | 'link' | 'download' | 'interactive';
  title: string;
  description?: string;
  url: string;
  file_size?: number;
  duration?: number; // for videos in seconds
  thumbnail_url?: string;
  is_required: boolean;
  order: number;
}

export interface LessonStep {
  id: string;
  title: string;
  description: string;
  content: string; // Rich text/markdown content
  estimated_duration: number; // in minutes
  resources: LessonResource[];
  instructions: string[];
  tips?: string[];
  common_mistakes?: string[];
  assessment_criteria?: string[];
  order: number;
}

export interface LessonAssessment {
  id: string;
  type: 'quiz' | 'project' | 'observation' | 'peer_review' | 'self_reflection';
  title: string;
  description: string;
  instructions: string;
  criteria: AssessmentCriterion[];
  max_score: number;
  passing_score: number;
  is_required: boolean;
  estimated_duration: number; // in minutes
}

export interface AssessmentCriterion {
  id: string;
  name: string;
  description: string;
  max_points: number;
  rubric_levels: RubricLevel[];
}

export interface RubricLevel {
  level: number;
  name: string; // e.g., "Excellent", "Good", "Satisfactory", "Needs Improvement"
  description: string;
  points: number;
}

export interface LearningObjective {
  id: string;
  description: string;
  bloom_taxonomy_level: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  measurable_outcome: string;
  assessment_method: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  short_description: string;
  thumbnail_url?: string;
  banner_url?: string;
  
  // Categorization
  category_id: string;
  category: LessonCategory;
  skill_level_id: string;
  skill_level: LessonSkillLevel;
  tags: LessonTag[];
  
  // Educational Details
  learning_objectives: LearningObjective[];
  prerequisites: string[];
  age_range: {
    min_age: number;
    max_age: number;
  };
  estimated_duration: number; // total in minutes
  difficulty_rating: number; // 1-5 scale
  
  // Content
  steps: LessonStep[];
  resources: LessonResource[];
  assessments: LessonAssessment[];
  
  // Metadata
  author_id: string;
  author_name: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  version: string;
  language: string;
  
  // Engagement
  rating: number; // average rating 1-5
  review_count: number;
  completion_count: number;
  bookmark_count: number;
  
  // Status and Permissions
  status: 'draft' | 'review' | 'published' | 'archived';
  visibility: 'public' | 'private' | 'organization' | 'subscribers';
  is_featured: boolean;
  is_premium: boolean;
  
  // AI and Adaptive Features
  ai_generated_hints?: string[];
  adaptive_difficulty?: boolean;
  personalization_tags?: string[];
}

export interface LessonProgress {
  id: string;
  lesson_id: string;
  user_id: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'paused';
  progress_percentage: number;
  current_step_id?: string;
  completed_steps: string[];
  started_at: string;
  last_accessed_at: string;
  completed_at?: string;
  time_spent: number; // in minutes
  assessment_scores: Record<string, number>;
  notes?: string;
  bookmarked_at?: string;
}

export interface LessonReview {
  id: string;
  lesson_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  rating: number; // 1-5 scale
  review_text: string;
  helpful_count: number;
  created_at: string;
  is_verified_educator: boolean;
}

export interface LessonPlan {
  id: string;
  title: string;
  description: string;
  lesson_ids: string[];
  lessons: Lesson[];
  created_by_user_id: string;
  organization_id: string;
  estimated_total_duration: number;
  target_age_range: {
    min_age: number;
    max_age: number;
  };
  learning_path_type: 'sequential' | 'flexible' | 'choose_your_own';
  created_at: string;
  updated_at: string;
  is_public: boolean;
  tags: LessonTag[];
}

export interface LessonSearchFilters {
  category_ids?: string[];
  skill_level_ids?: string[];
  tag_ids?: string[];
  age_range?: {
    min_age?: number;
    max_age?: number;
  };
  duration_range?: {
    min_duration?: number; // in minutes
    max_duration?: number;
  };
  difficulty_range?: {
    min_difficulty?: number; // 1-5
    max_difficulty?: number;
  };
  rating_threshold?: number; // minimum rating
  is_featured?: boolean;
  is_premium?: boolean;
  language?: string;
  author_id?: string;
  organization_id?: string;
  has_video?: boolean;
  has_assessment?: boolean;
  status?: ('draft' | 'review' | 'published' | 'archived')[];
  visibility?: ('public' | 'private' | 'organization' | 'subscribers')[];
}

export interface LessonSearchResult {
  lessons: Lesson[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  facets: {
    categories: Array<{ id: string; name: string; count: number }>;
    skill_levels: Array<{ id: string; name: string; count: number }>;
    tags: Array<{ id: string; name: string; count: number }>;
    age_ranges: Array<{ range: string; count: number }>;
    durations: Array<{ range: string; count: number }>;
    difficulties: Array<{ level: number; count: number }>;
  };
}

// Default lesson categories for STEM education
export const DEFAULT_LESSON_CATEGORIES: LessonCategory[] = [
  {
    id: 'robotics',
    name: 'Robotics',
    description: 'Build, program, and control robots',
    icon: 'hardware-chip-outline',
    color: '#FF6B6B',
    order: 1,
  },
  {
    id: 'artificial-intelligence',
    name: 'Artificial Intelligence',
    description: 'Machine learning, neural networks, and AI concepts',
    icon: 'brain-outline',
    color: '#4ECDC4',
    order: 2,
  },
  {
    id: 'programming',
    name: 'Programming',
    description: 'Learn to code in various programming languages',
    icon: 'code-slash-outline',
    color: '#45B7D1',
    order: 3,
  },
  {
    id: 'electronics',
    name: 'Electronics',
    description: 'Circuits, sensors, and electronic components',
    icon: 'flash-outline',
    color: '#96CEB4',
    order: 4,
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    description: 'Applied math for STEM and computational thinking',
    icon: 'calculator-outline',
    color: '#FECA57',
    order: 5,
  },
  {
    id: 'science',
    name: 'Science',
    description: 'Physics, chemistry, biology, and earth sciences',
    icon: 'flask-outline',
    color: '#FF9FF3',
    order: 6,
  },
  {
    id: 'design-thinking',
    name: 'Design Thinking',
    description: 'Creative problem-solving and innovation methods',
    icon: 'bulb-outline',
    color: '#54A0FF',
    order: 7,
  },
  {
    id: 'digital-literacy',
    name: 'Digital Literacy',
    description: 'Digital citizenship, online safety, and tech skills',
    icon: 'laptop-outline',
    color: '#5F27CD',
    order: 8,
  },
];

// Default skill levels
export const DEFAULT_SKILL_LEVELS: LessonSkillLevel[] = [
  {
    id: 'beginner',
    name: 'Beginner',
    description: 'No prior knowledge required',
    order: 1,
    color: '#2ECC71',
  },
  {
    id: 'intermediate',
    name: 'Intermediate',
    description: 'Some foundational knowledge helpful',
    order: 2,
    color: '#F39C12',
  },
  {
    id: 'advanced',
    name: 'Advanced',
    description: 'Strong background in the subject area',
    order: 3,
    color: '#E74C3C',
  },
  {
    id: 'expert',
    name: 'Expert',
    description: 'Extensive experience and mastery',
    order: 4,
    color: '#9B59B6',
  },
];

// Common lesson tags
export const COMMON_LESSON_TAGS: LessonTag[] = [
  // Subject tags
  { id: 'python', name: 'Python', color: '#3776AB', category: 'subject' },
  { id: 'javascript', name: 'JavaScript', color: '#F7DF1E', category: 'subject' },
  { id: 'arduino', name: 'Arduino', color: '#00979D', category: 'subject' },
  { id: 'scratch', name: 'Scratch', color: '#FF6B35', category: 'subject' },
  { id: 'machine-learning', name: 'Machine Learning', color: '#FF6B6B', category: 'subject' },
  
  // Skill tags
  { id: 'problem-solving', name: 'Problem Solving', color: '#4ECDC4', category: 'skill' },
  { id: 'critical-thinking', name: 'Critical Thinking', color: '#45B7D1', category: 'skill' },
  { id: 'creativity', name: 'Creativity', color: '#96CEB4', category: 'skill' },
  { id: 'collaboration', name: 'Collaboration', color: '#FECA57', category: 'skill' },
  
  // Method tags
  { id: 'hands-on', name: 'Hands-on', color: '#FF9FF3', category: 'method' },
  { id: 'project-based', name: 'Project-Based', color: '#54A0FF', category: 'method' },
  { id: 'gamified', name: 'Gamified', color: '#5F27CD', category: 'method' },
  
  // Age group tags
  { id: 'early-elementary', name: 'Early Elementary (5-7)', color: '#2ECC71', category: 'age_group' },
  { id: 'elementary', name: 'Elementary (8-11)', color: '#F39C12', category: 'age_group' },
  { id: 'middle-school', name: 'Middle School (12-14)', color: '#E74C3C', category: 'age_group' },
  { id: 'high-school', name: 'High School (15-18)', color: '#9B59B6', category: 'age_group' },
];

export type LessonSortOption = 
  | 'newest' 
  | 'oldest' 
  | 'most_popular' 
  | 'highest_rated' 
  | 'duration_short' 
  | 'duration_long' 
  | 'difficulty_easy' 
  | 'difficulty_hard'
  | 'alphabetical'
  | 'completion_count';

export interface LessonAnalytics {
  lesson_id: string;
  total_views: number;
  total_starts: number;
  total_completions: number;
  completion_rate: number;
  average_rating: number;
  average_duration: number;
  popular_exit_points: Array<{
    step_id: string;
    exit_count: number;
  }>;
  common_difficulties: Array<{
    step_id: string;
    difficulty_reports: number;
  }>;
}