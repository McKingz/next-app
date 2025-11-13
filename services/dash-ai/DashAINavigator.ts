/**
 * DashAINavigator
 * 
 * Handles navigation, deep links, and screen routing for Dash AI:
 * - Expo Router v5 navigation
 * - Deep link parsing and routing
 * - Screen parameter extraction
 * - Natural language route resolution
 * 
 * Design principles:
 * - Uses Expo Router v5 patterns (useRouter from expo-router)
 * - Never uses React Navigation Stack.push()
 * - File-based routing conventions
 */

import { router } from 'expo-router';

/**
 * Navigator configuration
 */
export interface NavigatorConfig {
  /** Base screen routes for natural language mapping */
  screenRoutes?: Record<string, string>;
}

/**
 * Navigation result
 */
export interface NavigationResult {
  success: boolean;
  screen?: string;
  error?: string;
}

/**
 * DashAINavigator
 * Manages navigation and deep linking
 */
export class DashAINavigator {
  private config: NavigatorConfig;

  constructor(config: NavigatorConfig = {}) {
    this.config = {
      screenRoutes: config.screenRoutes || this.getDefaultScreenRoutes(),
    };
  }

  /**
   * Get default screen route mappings
   */
  private getDefaultScreenRoutes(): Record<string, string> {
    return {
      // Dashboard & Home
      dashboard: '/screens/dashboard',
      home: '/screens/dashboard',
      
      // Lesson & Content Generation
      'lesson-generator': '/screens/ai-lesson-generator',
      'lesson-planner': '/screens/ai-lesson-generator',
      lessons: '/screens/ai-lesson-generator',
      
      // Worksheets
      worksheet: '/screens/worksheet-demo',
      worksheets: '/screens/worksheet-demo',
      'worksheet-demo': '/screens/worksheet-demo',
      
      // Student Management
      students: '/screens/student-management',
      'student-management': '/screens/student-management',
      
      // Teacher Management
      teachers: '/screens/teacher-management',
      'teacher-management': '/screens/teacher-management',
      
      // Communication
      messages: '/screens/teacher-messages',
      'teacher-messages': '/screens/teacher-messages',
      announcements: '/screens/principal-announcement',
      
      // Financial
      financial: '/screens/financial-dashboard',
      finance: '/screens/financial-dashboard',
      fees: '/screens/financial-dashboard',
    };
  }

  /**
   * Navigate to a screen by route key or path
   */
  public async navigateToScreen(
    route: string,
    params?: Record<string, any>
  ): Promise<NavigationResult> {
    try {
      // Resolve route to actual path
      const resolvedRoute = this.resolveRoute(route);

      if (!resolvedRoute) {
        return {
          success: false,
          error: `Unknown route: ${route}`,
        };
      }

      // Navigate using Expo Router v5
      if (params) {
        router.push({ pathname: resolvedRoute, params } as any);
      } else {
        router.push(resolvedRoute as any);
      }

      console.log(`[DashNavigator] Navigated to: ${resolvedRoute}`);
      return { success: true, screen: resolvedRoute };
    } catch (error) {
      console.error('[DashNavigator] Navigation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Navigation failed',
      };
    }
  }

  /**
   * Navigate using natural language (voice commands)
   */
  public async navigateByVoice(command: string): Promise<NavigationResult> {
    const commandLower = command.toLowerCase().trim();

    // Extract intent and parameters
    const intent = this.parseNavigationIntent(commandLower);

    if (!intent) {
      return {
        success: false,
        error: 'Could not understand navigation command',
      };
    }

    return this.navigateToScreen(intent.route, intent.params);
  }

  /**
   * Parse navigation intent from natural language
   */
  private parseNavigationIntent(command: string): {
    route: string;
    params?: Record<string, any>;
  } | null {
    // Dashboard commands
    if (
      /\b(go to|open|show me|take me to)\s+(dashboard|home)\b/i.test(command)
    ) {
      return { route: 'dashboard' };
    }

    // Lesson generator commands
    if (
      /\b(create|generate|make)\s+(lesson|lesson plan)\b/i.test(command) ||
      /\b(lesson|lesson plan)\s+(generator|planner)\b/i.test(command)
    ) {
      return { route: 'lesson-generator' };
    }

    // Worksheet commands
    if (
      /\b(create|generate|make)\s+worksheet\b/i.test(command) ||
      /\bworksheet\b/i.test(command)
    ) {
      return { route: 'worksheet' };
    }

    // Student management
    if (/\b(student|students|pupil)\b/i.test(command)) {
      return { route: 'students' };
    }

    // Teacher management
    if (/\b(teacher|teachers|staff)\b/i.test(command)) {
      return { route: 'teachers' };
    }

    // Messages/Communication
    if (/\b(message|messages|email|communicate)\b/i.test(command)) {
      return { route: 'messages' };
    }

    // Financial
    if (/\b(financial|finance|fees|payment)\b/i.test(command)) {
      return { route: 'financial' };
    }

    return null;
  }

  /**
   * Resolve route key to actual path
   */
  private resolveRoute(routeKey: string): string | null {
    // If already a path (starts with /), return as-is
    if (routeKey.startsWith('/')) {
      return routeKey;
    }

    // Normalize route key
    const normalizedKey = routeKey.toLowerCase().trim();

    // Look up in route mappings
    return this.config.screenRoutes?.[normalizedKey] || null;
  }

  /**
   * Open lesson generator with prefilled parameters
   */
  public openLessonGenerator(params: Record<string, string>): void {
    this.navigateToScreen('/screens/ai-lesson-generator', params);
  }

  /**
   * Open worksheet demo with prefilled parameters
   */
  public openWorksheetDemo(params: Record<string, string>): void {
    this.navigateToScreen('/screens/worksheet-demo', params);
  }

  /**
   * Open teacher messages with prefilled subject/body
   */
  public openTeacherMessages(subject?: string, body?: string): void {
    const params: Record<string, string> = {};
    if (subject) params.prefillSubject = subject;
    if (body) params.prefillMessage = body;
    this.navigateToScreen('/screens/teacher-messages', params);
  }

  /**
   * Navigate back (Expo Router back navigation)
   */
  public goBack(): void {
    try {
      if (router.canGoBack()) {
        router.back();
      }
    } catch (error) {
      console.error('[DashNavigator] Back navigation failed:', error);
    }
  }
}

export default DashAINavigator;
