// Dependency Injection Types and Tokens

export type Token<T> = symbol & { __type?: T };

export const TOKENS = {
  auth: Symbol.for('AuthService') as Token<AuthService>,
  storage: Symbol.for('StorageService') as Token<StorageService>,
  organization: Symbol.for('OrganizationService') as Token<OrganizationService>,
  ai: Symbol.for('AIService') as Token<AIService>,
  features: Symbol.for('FeatureFlagService') as Token<FeatureFlagService>,
  eventBus: Symbol.for('EventBus') as Token<EventBus>,
  memory: Symbol.for('MemoryService') as Token<MemoryService>,
  lessons: Symbol.for('LessonsService') as Token<LessonsService>,
  sms: Symbol.for('SMSService') as Token<SMSService>,
  googleCalendar: Symbol.for('GoogleCalendarService') as Token<GoogleCalendarService>,
  dashTaskAutomation: Symbol.for('DashTaskAutomation') as Token<IDashTaskAutomation>,
  dashDecisionEngine: Symbol.for('DashDecisionEngine') as Token<DashDecisionEngine>,
  dashNavigation: Symbol.for('DashNavigation') as Token<DashNavigation>,
  dashWebSearch: Symbol.for('DashWebSearch') as Token<DashWebSearch>,
  semanticMemory: Symbol.for('SemanticMemory') as Token<SemanticMemoryType>,
  dashProactive: Symbol.for('DashProactive') as Token<DashProactive>,
  dashDiagnostic: Symbol.for('DashDiagnostic') as Token<DashDiagnostic>,
  dashAI: Symbol.for('DashAI') as Token<DashAI>,
  dashWhatsApp: Symbol.for('DashWhatsApp') as Token<DashWhatsApp>,
  dashContextAnalyzer: Symbol.for('DashContextAnalyzer') as Token<IDashContextAnalyzer>,
  dashRealTimeAwareness: Symbol.for('DashRealTimeAwareness') as Token<IDashRealTimeAwareness>,
  dashAgenticEngine: Symbol.for('DashAgenticEngine') as Token<IDashAgenticEngine>,
  agentOrchestrator: Symbol.for('AgentOrchestrator') as Token<IAgentOrchestrator>,
};

// Minimal interfaces to start wiring gradually
export interface AuthService {
  getCurrentUser(): Promise<unknown | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface StorageService {
  getItem<T = string>(key: string): Promise<T | null>;
  setItem<T = string>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface OrganizationService {
  getDisplayName(type: string): string;
  mapTerm(term: keyof import('../types/organization').TerminologyMap, type: string): string;
  getGreeting(type: string, role: string, userName?: string): string;
  getCapabilities(type: string, role: string): string[];
}

export interface AIService {
  ask(prompt: string, context?: Record<string, unknown>): Promise<string>;
}

export interface FeatureFlagService {
  isEnabled(flag: string): boolean;
}

export interface EventBus {
  subscribe(event: string, handler: (data: any) => void | Promise<void>): () => void;
  publish(event: string, data?: any): Promise<void>;
  dispose(): void;
}

export interface MemoryService {
  initialize(): Promise<void>;
  upsertMemory(input: any): Promise<any | null>;
  retrieveRelevant(query: string, topK?: number, minSimilarity?: number): Promise<any[]>;
  snapshotContext(context: any): Promise<void>;
  recordAccess(memoryId: string): Promise<void>;
  getCachedMemories(): any[];
  dispose(): void;
}

export interface LessonsService {
  getCategories(): Promise<any[]>;
  getSkillLevels(): Promise<any[]>;
  getTags(): Promise<any[]>;
  searchLessons(query?: string, filters?: any, sortBy?: any, page?: number, pageSize?: number): Promise<any>;
  getLessonById(lessonId: string): Promise<any | null>;
  getUserLessonProgress(lessonId: string): Promise<any | null>;
  updateLessonProgress(lessonId: string, updates: any): Promise<any | null>;
  toggleLessonBookmark(lessonId: string): Promise<boolean>;
  getFeaturedLessons(limit?: number): Promise<any[]>;
  getPopularLessons(limit?: number): Promise<any[]>;
  getTeacherGeneratedLessons(): Promise<any[]>;
  dispose(): void;
}

export interface SMSService {
  sendSMS(message: any, options?: { validateOptOut?: boolean }): Promise<{ success: boolean; messageId?: string; error?: string }>;
  sendBulkSMS(options: any): Promise<{ success: boolean; result?: any; error?: string }>;
  getDeliveryStatus(messageId: string): Promise<any | null>;
  updateDeliveryStatus(twilioPayload: any): Promise<void>;
  dispose(): void;
}

export interface GoogleCalendarService {
  initiateOAuthFlow(userId: string, preschoolId: string): Promise<string>;
  completeOAuthFlow(userId: string, authorizationCode: string, state: string): Promise<{ success: boolean; error?: string }>;
  disconnectAccount(userId: string): Promise<{ success: boolean; error?: string }>;
  isConnected(userId: string): Promise<boolean>;
  dispose(): void;
}

export interface IDashTaskAutomation {
  createTask(templateId?: string, customParams?: any, userRole?: string): Promise<any>;
  executeTaskStep(taskId: string, stepId: string, userInput?: any): Promise<{ success: boolean; result?: any; nextStep?: string; error?: string }>;
  getTaskTemplates(userRole?: string): any[];
  getTask(taskId: string): any | undefined;
  getActiveTasks(): any[];
  cancelTask(taskId: string): { success: boolean; error?: string };
  dispose(): void;
}

export interface DashDecisionEngine {
  decide(candidate: any, context: any): Promise<any>;
  getDecisionHistory(): any[];
  getRecentDecisions(limit?: number): any[];
  getDecisionStats(): any;
  dispose(): void;
}

export interface DashNavigation {
  navigateByVoice(command: string): Promise<any>;
  navigateToScreen(screenKey: string, params?: Record<string, any>): Promise<any>;
  getCurrentScreen(): string | null;
  goBack(): any;
  clearHistory(): Promise<void>;
  dispose(): void;
}

export interface DashWebSearch {
  search(query: string, options?: any): Promise<any>;
  dispose(): void;
}

export interface SemanticMemoryType {
  initialize(): Promise<void>;
  storeMemory(content: string, type: any, importance?: number, metadata?: Record<string, any>): Promise<any>;
  searchMemories(query: any): Promise<any[]>;
  dispose(): void;
}

export interface DashProactive {
  checkForSuggestions(userRole: string, context: any): Promise<any[]>;
  dismissSuggestion(suggestionId: string): void;
  getStats(): { totalRules: number; activeRules: number; triggeredToday: number; dismissedToday: number };
  dispose(): void;
}

export interface DashDiagnostic {
  getDiagnostics(): Promise<any>;
  runFullDiagnostics(): Promise<any>;
  getDiagnosticSummary(): Promise<string>;
  autoFixIssues(issueIds?: string[]): Promise<{ fixed: string[]; failed: string[] }>;
  updateFeatureHealth(feature: string, success: boolean, responseTime?: number): void;
  logError(error: any): void;
  recordMetric(name: string, value: number): void;
  dispose(): void;
}

export interface DashAI {
  initialize(): Promise<void>;
  dispose(): void;
  cleanup(): void;
  clearCache(): void;
  sendMessage(content: string, attachments?: any[], conversationId?: string): Promise<any>;
  sendVoiceMessage(audioUri: string, conversationId?: string): Promise<any>;
  startNewConversation(title?: string): Promise<string>;
  getAllConversations(): Promise<any[]>;
  getConversation(conversationId: string): Promise<any | null>;
  deleteConversation(conversationId: string): Promise<void>;
  getCurrentConversationId(): string | null;
  setCurrentConversationId(conversationId: string): void;
  getAllMemoryItems(): any[];
  getMemory(): any;
  clearMemory(): Promise<void>;
  getPersonality(): any;
  savePersonality(personality: any): Promise<void>;
  preWarmRecorder(): Promise<void>;
  speakResponse(message: any, callbacks?: any): Promise<void>;
  stopSpeaking(): Promise<void>;
  navigateToScreen(route: string, params?: Record<string, any>): Promise<{ success: boolean; error?: string }>;
  getCurrentScreenContext(): { screen: string; capabilities: string[]; suggestions: string[] };
  openLessonGeneratorFromContext(userInput: string, aiResponse: string): void;
  generateWorksheetAutomatically(params: Record<string, any>): Promise<{ success: boolean; worksheetData?: any; error?: string }>;
  saveLessonToDatabase(lessonContent: string, lessonParams: any): Promise<{ success: boolean; lessonId?: string; error?: string }>;
  createAutomatedTask(templateId: string, customParams?: any): Promise<{ success: boolean; task?: any; error?: string }>;
  getActiveTasks(): any[];
  openTeacherMessageComposer(subject?: string, body?: string): void;
  exportTextAsPDFForDownload(title: string, content: string): Promise<{ success: boolean; uri?: string; filename?: string; error?: string }>;
}

// Note: Full interfaces are defined in service files
// These are minimal stubs for DI container typing
export type IAgentOrchestrator = any;
export type IDashContextAnalyzer = any;
export type IDashRealTimeAwareness = any;
export type IDashAgenticEngine = any;

// Note: Full interface defined in DashWhatsAppIntegration.ts
export type DashWhatsApp = any;
