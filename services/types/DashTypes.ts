/**
 * Shared Dash AI Assistant Types
 * 
 * This file contains all type definitions shared across the Dash AI services.
 * Extracted here to prevent circular dependencies between services.
 * 
 * ⚠️ IMPORTANT: This file should ONLY contain type definitions.
 * No runtime imports or implementations should be added here.
 */

// Core message types
export interface DashAttachment {
  type: 'image' | 'pdf' | 'audio' | 'video' | 'file';
  uri: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
}

export interface DashCitation {
  source: string;
  url?: string;
  relevance: number;
}

export interface DashMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'task_result';
  content: string;
  timestamp: number;
  voiceNote?: {
    audioUri: string;
    duration: number;
    transcript?: string;
    storagePath?: string;
    bucket?: string;
    contentType?: string;
    language?: string;
    provider?: string;
  };
  attachments?: DashAttachment[];
  citations?: DashCitation[];
  metadata?: {
    context?: string;
    confidence?: number;
    suggested_actions?: string[];
    references?: Array<{
      type: 'lesson' | 'student' | 'assignment' | 'resource' | 'parent' | 'class' | 'task';
      id: string;
      title: string;
      url?: string;
    }>;
    dashboard_action?: {
      type: 'switch_layout' | 'open_screen' | 'execute_task' | 'create_reminder' | 'send_notification' | 'export_pdf';
      layout?: 'classic' | 'enhanced';
      route?: string;
      params?: any;
      taskId?: string;
      task?: DashTask;
      reminder?: DashReminder;
      title?: string;
      content?: string;
    };
    emotions?: {
      sentiment: 'positive' | 'negative' | 'neutral';
      confidence: number;
      detected_emotions: string[];
    };
    user_intent?: {
      primary_intent: string;
      secondary_intents: string[];
      confidence: number;
    };
    task_progress?: {
      taskId: string;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
      progress: number;
      next_steps: string[];
    };
  };
}

// Task management types
export interface DashTaskStep {
  id: string;
  title: string;
  description: string;
  type: 'manual' | 'automated' | 'approval_required';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  estimatedDuration?: number;
  requiredData?: Record<string, any>;
  validation?: {
    required: boolean;
    criteria: string[];
  };
  actions?: DashAction[];
}

export interface DashAction {
  id: string;
  type: 'navigate' | 'api_call' | 'notification' | 'data_update' | 'file_generation' | 'email_send';
  parameters: Record<string, any>;
  condition?: Record<string, any>;
  retries?: number;
  timeout?: number;
}

export interface DashTask {
  id: string;
  title: string;
  description: string;
  type: 'one_time' | 'recurring' | 'workflow';
  status: 'pending' | 'in_progress' | 'completed' | 'paused' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: string;
  createdBy: string;
  createdAt: number;
  dueDate?: number;
  estimatedDuration?: number;
  steps: DashTaskStep[];
  dependencies?: string[];
  context: {
    conversationId: string;
    userRole: string;
    relatedEntities: Array<{
      type: 'student' | 'parent' | 'class' | 'lesson' | 'assignment';
      id: string;
      name: string;
    }>;
  };
  automation?: {
    triggers: string[];
    conditions: Record<string, any>;
    actions: DashAction[];
  };
  progress: {
    currentStep: number;
    completedSteps: string[];
    blockers?: string[];
    notes?: string;
  };
}

// Reminder types
export interface DashReminder {
  id: string;
  title: string;
  message: string;
  type: 'one_time' | 'recurring';
  triggerAt: number;
  recurrence?: {
    pattern: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: number;
  };
  userId: string;
  conversationId?: string;
  relatedTaskId?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'triggered' | 'dismissed' | 'snoozed';
}

// Conversation types
export interface DashConversation {
  id: string;
  title: string;
  messages: DashMessage[];
  created_at: number;
  updated_at: number;
  summary?: string;
  tags?: string[];
}

// Memory types
export interface DashMemoryItem {
  id: string;
  type: 'preference' | 'fact' | 'context' | 'skill' | 'goal' | 'interaction' | 'relationship' | 'pattern' | 'insight';
  key: string;
  value: any;
  confidence: number;
  created_at: number;
  updated_at: number;
  expires_at?: number;
  relatedEntities?: Array<{
    type: 'user' | 'student' | 'parent' | 'class' | 'subject';
    id: string;
    name: string;
  }>;
  embeddings?: number[];
  reinforcement_count?: number;
  emotional_weight?: number;
  retrieval_frequency?: number;
  tags?: string[];
}

// User profile types
export interface DashUserProfile {
  userId: string;
  role: 'teacher' | 'principal' | 'parent' | 'student' | 'admin';
  name: string;
  email?: string;
  preferences?: {
    language?: string;
    timezone?: string;
    notificationSettings?: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    dashPersonality?: {
      tone: 'professional' | 'friendly' | 'encouraging' | 'formal';
      verbosity: 'concise' | 'normal' | 'detailed';
      proactivity: 'high' | 'medium' | 'low';
    };
  };
  context?: {
    preschoolId?: string;
    preschoolName?: string;
    classes?: string[];
    students?: string[];
    subjects?: string[];
  };
}

// Personality and configuration types
export interface DashPersonality {
  name: string;
  description: string;
  voice_characteristics: {
    tone: string;
    pace: string;
    vocabulary_level: string;
  };
  behavioral_traits: {
    proactivity: 'high' | 'medium' | 'low';
    formality: 'formal' | 'professional' | 'casual' | 'friendly';
    empathy_level: 'high' | 'medium' | 'low';
    humor_usage: boolean;
  };
  role_specific_configs: {
    teacher: {
      greeting: string;
      capabilities: string[];
      tone: string;
      proactive_behaviors: string[];
      task_categories: string[];
    };
    principal: {
      greeting: string;
      capabilities: string[];
      tone: string;
      proactive_behaviors: string[];
      task_categories: string[];
    };
    parent: {
      greeting: string;
      capabilities: string[];
      tone: string;
      proactive_behaviors: string[];
      task_categories: string[];
    };
    student: {
      greeting: string;
      capabilities: string[];
      tone: string;
      proactive_behaviors: string[];
      task_categories: string[];
    };
  };
  agentic_settings: {
    autonomy_level: 'low' | 'medium' | 'high';
    can_create_tasks: boolean;
    can_schedule_actions: boolean;
    can_access_data: boolean;
    can_send_notifications: boolean;
    requires_confirmation_for: string[];
  };
}

// Insight types
export interface DashInsight {
  id: string;
  type: 'prediction' | 'recommendation' | 'pattern' | 'anomaly' | 'opportunity';
  title: string;
  description: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  category: string;
  actionable: boolean;
  suggestedActions?: Array<{
    title: string;
    description: string;
    taskTemplate?: string;
  }>;
  relatedData?: {
    entities: Array<{
      type: string;
      id: string;
      name: string;
    }>;
    metrics?: Record<string, any>;
    trends?: Record<string, any>;
  };
  created_at: number;
  expires_at?: number;
}
