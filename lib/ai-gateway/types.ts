/**
 * AI Gateway Types and Interfaces
 * 
 * Comprehensive type definitions for the AI service ecosystem including
 * Claude integration, usage tracking, billing, and rate limiting.
 */

// Core AI Service Types
export type AIServiceProvider = 'claude' | 'openai' | 'custom';
export type AIServiceType = 
  | 'homework_help' 
  | 'lesson_generation' 
  | 'grading_assistance' 
  | 'stem_activities'
  | 'content_enhancement';

export type PlanTier = 'free' | 'starter' | 'premium' | 'enterprise';
export type UsageStatus = 'active' | 'rate_limited' | 'quota_exceeded' | 'suspended';

// Request/Response Types
export interface AIRequest {
  id: string;
  userId: string;
  organizationId?: string;
  serviceType: AIServiceType;
  provider: AIServiceProvider;
  prompt: string;
  context?: Record<string, any>;
  metadata?: {
    studentAge?: number;
    subject?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    language?: string;
    childrenCount?: number;
    [key: string]: any; // Allow additional properties
  };
  requestedAt: Date;
}

export interface AIResponse {
  id: string;
  requestId: string;
  content: string;
  tokensUsed: number;
  processingTimeMs: number;
  cost: number; // in cents
  completedAt: Date;
  success: boolean;
  error?: string;
}

// Claude-Specific Types
export interface ClaudeConfig {
  apiKey: string;
  model: string; // e.g., 'claude-3-sonnet-20240229'
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  system?: string;
  messages: ClaudeMessage[];
}

export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Homework Helper Types
export interface HomeworkRequest {
  question: string;
  subject: string;
  gradeLevel: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  context?: string;
  attachments?: string[]; // URLs or base64 data
}

export interface HomeworkResponse {
  explanation: string;
  stepByStep: string[];
  hints: string[];
  relatedConcepts: string[];
  practiceProblems?: string[];
  confidence: number; // 0-1
}

// Lesson Generation Types
export interface LessonRequest {
  topic: string;
  subject: string;
  gradeLevel: number;
  duration: number; // minutes
  learningObjectives: string[];
  standards?: string[]; // curriculum standards
  accommodations?: string[];
}

export interface LessonResponse {
  title: string;
  description: string;
  objectives: string[];
  materials: string[];
  activities: LessonActivity[];
  assessment: {
    formative: string[];
    summative: string[];
  };
  extensions: string[];
  adaptations: string[];
}

export interface LessonActivity {
  name: string;
  duration: number;
  description: string;
  instructions: string[];
  materials: string[];
  type: 'introduction' | 'instruction' | 'practice' | 'assessment' | 'closure';
}

// STEM Activities Types
export interface STEMRequest {
  topic: string;
  gradeLevel: number;
  duration: number;
  materialsAvailable: string[];
  constraints?: string[];
}

export interface STEMActivity {
  title: string;
  description: string;
  materials: string[];
  instructions: string[];
  learningGoals: string[];
  extensions: string[];
  safetyNotes: string[];
  estimatedTime: number;
}

// Usage Tracking Types
export interface UsageRecord {
  id: string;
  userId: string;
  organizationId?: string;
  serviceType: AIServiceType;
  provider: AIServiceProvider;
  tokensUsed: number;
  cost: number;
  requestCount: number;
  timestamp: Date;
  planTier: PlanTier;
  success: boolean;
}

export interface UsageLimits {
  planTier: PlanTier;
  tokensPerDay: number;
  tokensPerMonth: number;
  requestsPerHour: number;
  requestsPerDay: number;
  costLimitPerMonth: number; // in cents
  servicesAllowed: AIServiceType[];
}

export interface UsageStats {
  tokensUsedToday: number;
  tokensUsedThisMonth: number;
  requestsLastHour: number;
  requestsToday: number;
  costThisMonth: number;
  remainingQuota: {
    tokens: number;
    requests: number;
    cost: number;
  };
  status: UsageStatus;
}

// Rate Limiting Types
export interface RateLimit {
  userId: string;
  organizationId?: string;
  serviceType: AIServiceType;
  windowStart: Date;
  windowDuration: number; // seconds
  requestCount: number;
  limit: number;
  resetAt: Date;
}

// Error Types
export interface AIServiceError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  retryAfter?: number; // seconds
}

// Configuration Types
export interface AIServiceConfig {
  providers: {
    claude: ClaudeConfig;
  };
  defaultLimits: Record<PlanTier, UsageLimits>;
  pricing: {
    [provider in AIServiceProvider]: {
      inputTokenPrice: number; // per 1000 tokens
      outputTokenPrice: number; // per 1000 tokens
      baseRequestCost: number; // in cents
    };
  };
  rateLimits: {
    [tier in PlanTier]: {
      [service in AIServiceType]: {
        requestsPerMinute: number;
        requestsPerHour: number;
        requestsPerDay: number;
      };
    };
  };
}

// Database Schema Types (matching our migration)
export interface AIServiceConfigDB {
  id: string;
  service_name: string;
  provider: AIServiceProvider;
  config_data: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AIUsageLogDB {
  id: string;
  user_id: string;
  organization_id?: string;
  service_type: AIServiceType;
  provider: AIServiceProvider;
  tokens_used: number;
  cost_cents: number;
  request_data: Record<string, any>;
  response_data?: Record<string, any>;
  success: boolean;
  error_message?: string;
  processing_time_ms: number;
  created_at: Date;
}

export interface OrganizationAISettingsDB {
  organization_id: string;
  ai_enabled: boolean;
  monthly_budget_cents: number;
  allowed_services: AIServiceType[];
  rate_limit_multiplier: number;
  custom_prompts?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}
