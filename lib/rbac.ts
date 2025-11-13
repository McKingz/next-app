/**
 * Role-Based Access Control (RBAC) System
 * 
 * Comprehensive permission system with role hierarchy, capability flags,
 * and organization-level access control for the EduDash platform.
 */

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { shouldAllowFallback, trackFallbackUsage } from '@/lib/security-config';
import { getCurrentSession } from '@/lib/sessionManager';
import type { UserProfile } from './sessionManager';
import { log, warn, debug, error as logError } from '@/lib/debug';

// Core role definitions with hierarchy (higher number = more permissions)
export const ROLES = {
  parent: { level: 1, name: 'parent', display: 'Parent' },
  teacher: { level: 2, name: 'teacher', display: 'Teacher' },
  principal: { level: 3, name: 'principal', display: 'Principal' },
  principal_admin: { level: 3, name: 'principal_admin', display: 'Principal/Admin' },
  super_admin: { level: 4, name: 'super_admin', display: 'Super Admin' },
} as const;

export type Role = keyof typeof ROLES;
export type SeatStatus = 'active' | 'inactive' | 'pending' | 'revoked';
export type PlanTier = 'free' | 'starter' | 'premium' | 'enterprise';

// Comprehensive capability flags
export const CAPABILITIES = {
  // Core access capabilities
  view_dashboard: 'view_dashboard',
  access_mobile_app: 'access_mobile_app',
  
  // Organization-level capabilities
  view_organization_settings: 'view_organization_settings',
  manage_organization: 'manage_organization',
  invite_members: 'invite_members',
  manage_seats: 'manage_seats',
  
  // School/educational capabilities
  view_school_metrics: 'view_school_metrics',
  manage_teachers: 'manage_teachers',
  manage_students: 'manage_students',
  manage_classes: 'manage_classes',
  access_principal_hub: 'access_principal_hub',
  generate_school_reports: 'generate_school_reports',
  
  // Teaching capabilities
  create_assignments: 'create_assignments',
  grade_assignments: 'grade_assignments',
  view_class_analytics: 'view_class_analytics',
  communicate_with_parents: 'communicate_with_parents',
  
  // Parent capabilities (ENHANCED for Parent Dashboard)
  view_child_progress: 'view_child_progress',
  communicate_with_teachers: 'communicate_with_teachers',
  access_homework_help: 'access_homework_help',
  
  // Parent Dashboard Capabilities (NEW)
  access_parent_dashboard: 'access_parent_dashboard',
  submit_homework: 'submit_homework',
  view_announcements: 'view_announcements',
  use_whatsapp: 'use_whatsapp',
  send_voice_notes: 'send_voice_notes',
  view_progress: 'view_progress',
  in_app_messaging: 'in_app_messaging',
  parent_teacher_chat: 'parent_teacher_chat',
  offline_homework_submission: 'offline_homework_submission',
  receive_push_notifications: 'receive_push_notifications',
  
  // WhatsApp Integration Capabilities
  whatsapp_opt_in: 'whatsapp_opt_in',
  whatsapp_send_messages: 'whatsapp_send_messages',
  whatsapp_receive_messages: 'whatsapp_receive_messages',
  whatsapp_voice_messages: 'whatsapp_voice_messages',
  
  // Communication & Engagement
  read_school_announcements: 'read_school_announcements',
  reply_to_teachers: 'reply_to_teachers',
  send_media_messages: 'send_media_messages',
  record_voice_feedback: 'record_voice_feedback',
  view_engagement_metrics: 'view_engagement_metrics',
  provide_feedback: 'provide_feedback',
  
  // Progress & Analytics
  view_student_progress: 'view_student_progress',
  view_homework_history: 'view_homework_history',
  view_attendance_records: 'view_attendance_records',
  access_ai_insights: 'access_ai_insights',
  view_progress_reports: 'view_progress_reports',
  
  // AI capabilities (tier-dependent)
  ai_lesson_generation: 'ai_lesson_generation',
  ai_grading_assistance: 'ai_grading_assistance',
  ai_homework_helper: 'ai_homework_helper',
  ai_stem_activities: 'ai_stem_activities',
  ai_progress_analysis: 'ai_progress_analysis',
  ai_insights: 'ai_insights',
  ai_quota_management: 'ai_quota_management',
  
  // Premium/Enterprise capabilities
  advanced_analytics: 'advanced_analytics',
  bulk_operations: 'bulk_operations',
  custom_reports: 'custom_reports',
  api_access: 'api_access',
  sso_access: 'sso_access',
  priority_support: 'priority_support',
  
  // Admin capabilities
  view_all_organizations: 'view_all_organizations',
  manage_billing: 'manage_billing',
  manage_subscriptions: 'manage_subscriptions',
  access_admin_tools: 'access_admin_tools',
  manage_feature_flags: 'manage_feature_flags',
  view_system_logs: 'view_system_logs',
} as const;

export type Capability = keyof typeof CAPABILITIES;

// Role-based capability mapping
const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  parent: [
    // Core access
    'view_dashboard',
    'access_mobile_app',
    'view_child_progress',
    'communicate_with_teachers',
    'access_homework_help',
    
    // Parent Dashboard Core Features
    'access_parent_dashboard',
    'submit_homework',
    'view_announcements',
    'send_voice_notes',
    'view_progress',
    'in_app_messaging',
    'parent_teacher_chat',
    'offline_homework_submission',
    'receive_push_notifications',
    
    // Communication & Engagement
    'read_school_announcements',
    'reply_to_teachers',
    'send_media_messages',
    'record_voice_feedback',
    'provide_feedback',
    
    // Progress & Analytics
    'view_student_progress',
    'view_homework_history',
    'view_attendance_records',
    'view_progress_reports',
    
    // WhatsApp Integration (base capabilities - tier dependent for advanced)
    'whatsapp_opt_in',
    'whatsapp_send_messages',
    'whatsapp_receive_messages',
    
    // AI capabilities (basic tier)
    'ai_homework_helper',
  ],
  teacher: [
    'view_dashboard',
    'access_mobile_app',
    'manage_classes',
    'create_assignments',
    'grade_assignments',
    'view_class_analytics',
    'communicate_with_parents',
    
    // AI capabilities for teachers
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_homework_helper',
    'ai_progress_analysis',
    'ai_insights',
  ],
  principal: [
    'view_dashboard',
    'access_mobile_app',
    'view_organization_settings',
    'invite_members',
    'manage_seats',
    'view_school_metrics',
    'manage_teachers',
    'manage_students',
    'manage_classes',
    'access_principal_hub',
    'generate_school_reports',
    'create_assignments',
    'grade_assignments',
    'view_class_analytics',
    
    // AI capabilities for principals
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_homework_helper',
    'ai_progress_analysis',
    'ai_insights',
    'ai_quota_management',
  ],
  principal_admin: [
    'view_dashboard',
    'access_mobile_app',
    'view_organization_settings',
    'invite_members',
    'manage_seats',
    'view_school_metrics',
    'manage_teachers',
    'manage_students',
    'manage_classes',
    'access_principal_hub',
    'generate_school_reports',
    'create_assignments',
    'grade_assignments',
    'view_class_analytics',
    
    // AI capabilities for principal_admin (same as principal)
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_homework_helper',
    'ai_progress_analysis',
    'ai_insights',
    'ai_quota_management',
  ],
  super_admin: [
    'view_dashboard',
    'access_mobile_app',
    'view_all_organizations',
    'manage_organization',
    'manage_billing',
    'manage_subscriptions',
    'access_admin_tools',
    'manage_feature_flags',
    'view_system_logs',
    'advanced_analytics',
    'bulk_operations',
    'custom_reports',
    'api_access',
    'priority_support',
    
    // All AI capabilities for super_admin
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_homework_helper',
    'ai_stem_activities',
    'ai_progress_analysis',
    'ai_insights',
    'ai_quota_management',
  ],
};

// Plan tier capability additions
const TIER_CAPABILITIES: Record<PlanTier | 'basic' | 'pro', Capability[]> = {
  free: [
    'ai_homework_helper', // Limited usage (10 requests/month per roadmap)
    'view_engagement_metrics', // Basic engagement tracking
  ],
  starter: [
    'ai_homework_helper',
    'ai_lesson_generation', // Limited usage
    'view_engagement_metrics',
    'whatsapp_voice_messages', // Voice messages in WhatsApp
    'ai_insights', // Basic AI insights
  ],
  basic: [
    'ai_homework_helper',
    'ai_lesson_generation',
    'view_engagement_metrics',
    'ai_insights',
  ],
  pro: [
    'ai_homework_helper',
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_stem_activities',
    'ai_progress_analysis',
    'advanced_analytics',
    'view_engagement_metrics',
    'whatsapp_voice_messages',
    'ai_insights',
    'use_whatsapp',
  ],
  premium: [
    'ai_homework_helper',
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_stem_activities',
    'ai_progress_analysis',
    'advanced_analytics',
    'view_engagement_metrics',
    'whatsapp_voice_messages',
    'ai_insights',
    'use_whatsapp', // Full WhatsApp integration
  ],
  enterprise: [
    'ai_homework_helper',
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_stem_activities',
    'ai_progress_analysis',
    'advanced_analytics',
    'bulk_operations',
    'custom_reports',
    'sso_access',
    'priority_support',
    'view_engagement_metrics',
    'whatsapp_voice_messages',
    'ai_insights',
    'ai_quota_management',
    'use_whatsapp',
  ],
};

/**
 * Student record type with parent and guardian support
 */
export interface Student {
  id: string;
  created_at: string;
  updated_at: string;
  preschool_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  parent_id?: string;
  guardian_id?: string; // New field for secondary parent/guardian
  parent_email?: string;
  class_id?: string;
  is_active: boolean;
}

/**
 * Enhanced user profile with complete RBAC information
 */
export interface EnhancedUserProfile extends UserProfile {
  // Organization membership
  organization_membership?: {
    organization_id: string;
    organization_name: string;
    plan_tier: PlanTier;
    seat_status: SeatStatus;
    invited_by?: string;
    joined_at: string;
  };
  
  // Complete capabilities list
  capabilities: Capability[];
  
  // Permission checking methods
  hasCapability: (capability: Capability) => boolean;
  hasRole: (role: Role) => boolean;
  hasRoleOrHigher: (role: Role) => boolean;
  isOrgMember: (orgId: string) => boolean;
  hasActiveSeat: () => boolean;
}

/**
 * Get comprehensive user capabilities based on role, organization, and subscription
 */
export async function getUserCapabilities(
  role: string,
  planTier?: string,
  seatStatus?: string
): Promise<Capability[]> {
  const normalizedRole = (normalizeRole(role) || 'parent') as Role;
  const capabilities = new Set<Capability>();
  
  // Add role-based capabilities
  if (normalizedRole && ROLE_CAPABILITIES[normalizedRole]) {
    ROLE_CAPABILITIES[normalizedRole].forEach(cap => capabilities.add(cap));
  }

  // Determine if seat is effectively active (case-insensitive, with common synonyms)
  const seatActive = typeof seatStatus === 'string' && ['active','approved','assigned','enabled','granted']
    .includes(String(seatStatus).toLowerCase());

  // If teacher without an active seat, remove core teaching capabilities but allow basic app access
  if (normalizedRole === 'teacher' && !seatActive) {
    ['manage_classes','create_assignments','grade_assignments','view_class_analytics'].forEach((cap) => {
      capabilities.delete(cap as Capability);
    });
  }
  
  // Add tier-based capabilities (only if seat is active)
  if (planTier && seatActive) {
    const tier = planTier as PlanTier;
    if (TIER_CAPABILITIES[tier]) {
      TIER_CAPABILITIES[tier].forEach(cap => capabilities.add(cap));
    }
  }
  
  return Array.from(capabilities);
}

/**
 * Normalize role strings to canonical format
 */
export function normalizeRole(role: string): Role | null {
  const normalized = role?.toLowerCase().trim();
  
  if (!normalized) return null;
  
  // Map various role formats to canonical roles
  if (normalized.includes('super') || normalized === 'superadmin') {
    return 'super_admin';
  }
  if (normalized.includes('principal') || normalized === 'admin') {
    return 'principal_admin';
  }
  if (normalized.includes('teacher')) {
    return 'teacher';
  }
  if (normalized.includes('parent')) {
    return 'parent';
  }
  
  return null;
}

/**
 * Create enhanced user profile with permission checking methods
 */
export function createEnhancedProfile(
  baseProfile: UserProfile,
  orgMembership?: any
): EnhancedUserProfile {
  const profile = baseProfile as EnhancedUserProfile;
  
  // Add organization membership details
  if (orgMembership) {
    profile.organization_membership = {
      organization_id: orgMembership.organization_id,
      organization_name: orgMembership.organization_name,
      plan_tier: orgMembership.plan_tier || 'free',
      seat_status: orgMembership.seat_status || 'inactive',
      invited_by: orgMembership.invited_by,
      joined_at: orgMembership.created_at,
    };
  }
  
  // Add permission checking methods
  profile.hasCapability = (capability: Capability): boolean => {
    return profile.capabilities?.includes(capability) || false;
  };
  
  profile.hasRole = (role: Role): boolean => {
    return normalizeRole(profile.role) === role;
  };
  
  profile.hasRoleOrHigher = (role: Role): boolean => {
    const userRole = normalizeRole(profile.role);
    if (!userRole) return false;
    
    return ROLES[userRole].level >= ROLES[role].level;
  };
  
  profile.isOrgMember = (orgId: string): boolean => {
    return profile.organization_membership?.organization_id === orgId;
  };
  
  profile.hasActiveSeat = (): boolean => {
    // Check both organization_membership.seat_status and direct seat_status property
    return profile.organization_membership?.seat_status === 'active' || 
           profile.seat_status === 'active';
  };
  
  return profile;
}

/**
 * Permission checking utilities for UI components
 */
export class PermissionChecker {
  constructor(private profile: EnhancedUserProfile | null) {
    // Security: Monitor creation of superadmin permission checkers
    if (this.profile && normalizeRole(this.profile.role) === 'super_admin') {
      track('edudash.security.superadmin_permissions_accessed', {
        user_id: this.profile.id,
        timestamp: new Date().toISOString(),
        context: 'permission_checker_created'
      });
    }
  }
  
  /**
   * Check if user has specific capability
   */
  can(capability: Capability): boolean {
    const hasCapability = this.profile?.hasCapability(capability) || false;
    
    // Security: Monitor access to sensitive capabilities
    const sensitiveCaps: Capability[] = [
      'view_all_organizations',
      'manage_organization', 
      'manage_billing',
      'manage_subscriptions',
      'access_admin_tools',
      'manage_feature_flags',
      'view_system_logs'
    ];
    
    if (hasCapability && sensitiveCaps.includes(capability) && this.profile) {
      track('edudash.security.sensitive_capability_accessed', {
        user_id: this.profile.id,
        capability,
        role: normalizeRole(this.profile.role),
        timestamp: new Date().toISOString()
      });
    }
    
    return hasCapability;
  }
  
  /**
   * Check if user has any of the specified capabilities
   */
  canAny(capabilities: Capability[]): boolean {
    return capabilities.some(cap => this.can(cap));
  }
  
  /**
   * Check if user has all specified capabilities
   */
  canAll(capabilities: Capability[]): boolean {
    return capabilities.every(cap => this.can(cap));
  }
  
  /**
   * Check if user has specific role
   */
  hasRole(role: Role): boolean {
    return this.profile?.hasRole(role) || false;
  }
  
  /**
   * Check if user has role or higher in hierarchy
   */
  hasRoleOrHigher(role: Role): boolean {
    return this.profile?.hasRoleOrHigher(role) || false;
  }
  
  /**
   * Check if user is member of specific organization
   */
  isMemberOf(orgId: string): boolean {
    return this.profile?.isOrgMember(orgId) || false;
  }
  
  /**
   * Check if user has active seat in their organization
   */
  hasActiveSeat(): boolean {
    if (!this.profile) return false;
    // Check both organization_membership.seat_status and direct seat_status
    return this.profile.organization_membership?.seat_status === 'active' || 
           (this.profile as any).seat_status === 'active';
  }
  
  /**
   * Get user's plan tier
   */
  getPlanTier(): PlanTier | null {
    return this.profile?.organization_membership?.plan_tier || null;
  }
  
  /**
   * Check if user's organization has specific plan tier or higher
   */
  hasPlanTier(tier: PlanTier): boolean {
    const userTier = this.getPlanTier();
    if (!userTier) return false;
    
    const tiers: PlanTier[] = ['free', 'starter', 'premium', 'enterprise'];
    const userTierIndex = tiers.indexOf(userTier);
    const requiredTierIndex = tiers.indexOf(tier);
    
    return userTierIndex >= requiredTierIndex;
  }
  
  /**
   * Get the enhanced profile (for backward compatibility)
   */
  get enhancedProfile(): EnhancedUserProfile | null {
    return this.profile;
  }
}

/**
 * Create permission checker instance
 */
export function createPermissionChecker(profile: EnhancedUserProfile | null): PermissionChecker {
  return new PermissionChecker(profile);
}

/**
 * Fetch complete user profile with organization membership and permissions
 */
export async function fetchEnhancedUserProfile(userId: string): Promise<EnhancedUserProfile | null> {
  try {
    log('Attempting to fetch profile for authenticated user:', userId);
    
    // SECURITY: Validate the requester identity as best as possible
    // Try multiple sources for current authenticated identity
    let session: any = null;
    let sessionUserId: string | null = null;
    let storedSession: import('@/lib/sessionManager').UserSession | null = null;
    
    // Try stored session first (faster and more reliable after sign-in)
    log('[Profile] Checking stored session first...');
    try {
      storedSession = await getCurrentSession();
      if (storedSession?.user_id) {
        sessionUserId = storedSession.user_id;
        log('[Profile] Stored session result: SUCCESS, user:', sessionUserId);
        // Construct a minimal session object from stored data
        session = {
          user: { id: storedSession.user_id, email: storedSession.email },
          access_token: storedSession.access_token
        };
      } else {
        log('[Profile] Stored session exists but no user_id');
      }
    } catch (e) {
      log('[Profile] getCurrentSession() failed:', e);
    }
    
    // Then try getUser() if no stored session
    if (!sessionUserId) {
      log('[Profile] No stored session, trying getUser()...');
      try {
        const getUserPromise = assertSupabase().auth.getUser();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getUser timeout')), 3000)
        );
        const { data: { user } } = await Promise.race([getUserPromise, timeoutPromise]) as any;
        if (user?.id) {
          sessionUserId = user.id;
          log('[Profile] getUser() result: SUCCESS, user:', sessionUserId);
          // Construct a minimal session object for later use
          session = { user };
        }
      } catch (e) {
        log('[Profile] getUser() failed or timed out:', e);
      }
    }
    
    // Only try getSession as last resort (can be slow/locked after sign-out)
    if (!sessionUserId && !session) {
      log('[Profile] Trying getSession() as last resort...');
      try {
        const sessionPromise = assertSupabase().auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session fetch timeout')), 3000)
        );
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        session = result?.data?.session;
        sessionUserId = session?.user?.id ?? null;
        log('[Profile] getSession() result:', sessionUserId ? 'SUCCESS' : 'FAILED');
      } catch (e) {
        log('[Profile] getSession() failed or timed out:', e);
      }
    }

    // If we have an authenticated identity and it mismatches, block
    if (sessionUserId && sessionUserId !== userId) {
      logError('User ID mismatch - cannot fetch profile for different user');
      reportError(new Error('Profile fetch attempted for different user'), {
        requestedUserId: userId,
        sessionUserId,
      });
      return null;
    }
    
    // If we couldn't get sessionUserId due to lock contention, trust the provided userId
    // This happens when user signs in immediately after sign-out
    if (!sessionUserId && userId) {
      log('[Profile] Could not validate session, trusting provided userId:', userId);
      sessionUserId = userId;
    }
    
    // Try to get the profile with a more permissive approach
    // First, let's try without RLS constraints by using a function call
    let profile = null;
    let profileError = null;
    
    // Production: Use secure profile fetching without debug logging

    // Preferred: Use secure RPC that returns the caller's profile (bypasses RLS safely)
    log('[Profile] Calling get_my_profile RPC...');
    const rpcCall = () => assertSupabase().rpc('get_my_profile').maybeSingle();
    const rpcTimeoutMs = 8000; // allow a bit more time on slow networks
    const rpcTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('RPC timeout')), rpcTimeoutMs)
    );

    let rpcProfile: any = null;
    let rpcError: any = null;
    
    // First attempt
    ({ data: rpcProfile, error: rpcError } = await Promise.race([rpcCall(), rpcTimeout]).catch(err => {
      log('[Profile] RPC call failed or timed out:', err.message);
      return { data: null, error: err };
    }) as any);

    // Quick, single retry on timeout
    if ((!rpcProfile || !(rpcProfile as any).id) && rpcError && String(rpcError.message || '').includes('timeout')) {
      debug('Retrying get_my_profile RPC once after timeout...');
      await new Promise(res => setTimeout(res, 300));
      ({ data: rpcProfile, error: rpcError } = await Promise.race([rpcCall(), rpcTimeout]).catch(err => {
        log('[Profile] RPC retry failed or timed out:', err.message);
        return { data: null, error: err };
      }) as any);
    }

    if (rpcProfile && (rpcProfile as any).id) {
      profile = rpcProfile as any;
      debug('RPC get_my_profile succeeded');
    } else {
      profileError = rpcError;
      debug('RPC get_my_profile failed or returned null');

      // Fallback 1: Try direct table read of own profile (should be allowed by RLS)
      try {
        const { data: selfProfile } = await assertSupabase()
          .from('profiles')
          .select('id,email,role,first_name,last_name,avatar_url,created_at,preschool_id')
          .eq('id', userId)
          .maybeSingle();
        if (selfProfile && (selfProfile as any).id) {
          profile = selfProfile as any;
          debug('Using direct profiles table read as fallback');
        }
      } catch (selfReadErr) {
        debug('Direct profiles read failed (non-fatal):', selfReadErr);
      }
      
      // Fallback 2: Try the debug RPC (SECURITY DEFINER)
      if (!profile) {
        try {
          const { data: directProfile } = await assertSupabase()
            .rpc('debug_get_profile_direct', { target_auth_id: userId })
            .maybeSingle();
          debug('Direct profile fetch completed');
          if (directProfile && (directProfile as any).id) {
            profile = directProfile as any;
            debug('Using direct profile as fallback');
          }
        } catch (directError) {
          debug('Direct profile fetch failed:', directError);
        }
      }
    }
    
    if (!profile) {
      // Only log an error if it's not the common "no rows" case
      if (!(profileError && (profileError as any).code === 'PGRST116')) {
        logError('Failed to fetch basic user profile:', profileError);
      }
      
      // SECURITY: Check if fallback is allowed for this session
      const sessionToken = session?.access_token || storedSession?.access_token || '';
      const sessionId = sessionToken ? sessionToken.substring(0, 32) : '';
      if (!sessionId || !shouldAllowFallback(sessionId)) {
        logError('SECURITY: Fallback profile not allowed - returning null');
        return null;
      }
      
      // Track fallback usage for rate limiting
      trackFallbackUsage(sessionId);
      
      // SECURITY: Create minimal fallback profile with restricted permissions
      // Use actual authenticated user data, not hardcoded values
      if (!session?.user) {
        return null;
      }
      const fallbackProfile: UserProfile = {
        id: session.user.id, // Use actual authenticated user ID
        email: session.user.email || 'unknown@example.com', // Use actual email
        role: 'parent' as any, // DEFAULT TO LOWEST PRIVILEGE ROLE
        first_name: 'User',
        last_name: '',
        avatar_url: undefined,
        organization_id: undefined,
        organization_name: undefined,
        seat_status: 'inactive' as any, // INACTIVE by default for security
        capabilities: [], // NO CAPABILITIES by default
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      };
      
      const enhancedFallback = createEnhancedProfile(fallbackProfile, {
        organization_id: null,
        organization_name: null,
        plan_tier: 'free',
        seat_status: 'inactive', // INACTIVE seat status
        invited_by: null,
        created_at: new Date().toISOString(),
      });
      
      // Log security event for monitoring
      track('edudash.security.fallback_profile_used', {
        user_id: session.user.id,
        email: session.user.email,
        reason: 'database_access_failed',
        timestamp: new Date().toISOString(),
      });
      
      warn('SECURITY: Using fallback profile with minimal permissions');
      return enhancedFallback;
    }
    
    debug('Successfully fetched profile');
    
    // Process the real profile data
    // Resolve organization identifier (UUID id or tenant slug)
    let orgMember = null as any;
    let org: any = null;

    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    // Consider multiple sources for organization identifier
    const sessionMeta = (session?.user as any)?.user_metadata || {};
    const orgIdentifierRaw: string | undefined =
      (profile as any)?.preschool_id ||
      (profile as any)?.organization_id ||
      (profile as any)?.tenant_slug ||
      sessionMeta.tenant_slug ||
      sessionMeta.preschool_slug ||
      sessionMeta.school_slug ||
      (isUuid(String(sessionMeta.school_id || '')) ? undefined : sessionMeta.school_id);
    let resolvedOrgId: string | null = null;

    if (orgIdentifierRaw) {
      try {
        if (isUuid(orgIdentifierRaw)) {
          // Try preschools by id first
          const { data: presById } = await assertSupabase()
            .from('preschools')
            .select('id, name, subscription_tier')
            .eq('id', orgIdentifierRaw)
            .maybeSingle();
          if (presById) {
            org = presById;
            resolvedOrgId = presById.id;
          } else {
            // Try organizations by id
            const { data: orgById } = await assertSupabase()
              .from('organizations')
              .select('id, name, plan_tier')
              .eq('id', orgIdentifierRaw)
              .maybeSingle();
            if (orgById) {
              // Standardize org object shape
              org = { ...orgById };
              resolvedOrgId = orgById.id;
            }
          }
        } else {
          // Treat as tenant slug
          // Prefer preschools.tenant_slug
          try {
            const { data: presBySlug } = await assertSupabase()
              .from('preschools')
              .select('id, name, subscription_tier')
              .eq('tenant_slug', orgIdentifierRaw)
              .maybeSingle();
            if (presBySlug) {
              org = presBySlug;
              resolvedOrgId = presBySlug.id;
            }
          } catch (e) {
            debug('preschools by tenant_slug lookup failed', e);
          }

          if (!resolvedOrgId) {
            // Try organizations.tenant_slug
            try {
              const { data: orgBySlug } = await assertSupabase()
                .from('organizations')
                .select('id, name, plan_tier')
                .eq('tenant_slug', orgIdentifierRaw)
                .maybeSingle();
              if (orgBySlug) {
                org = { ...orgBySlug };
                resolvedOrgId = orgBySlug.id;
              }
            } catch (e2) {
              console.debug('organizations by tenant_slug lookup failed', e2);
            }
          }
        }
      } catch (e) {
        warn('Organization resolution failed:', e);
      }
    }

    // If we have a resolved ID, attempt to get membership details
    if (resolvedOrgId) {
      try {
        const { data: memberData } = await assertSupabase()
          .rpc('get_my_org_member', { p_org_id: resolvedOrgId as any })
          .single();
        if (memberData) {
          orgMember = memberData as any;
        }
      } catch (e) {
        debug('get_my_org_member RPC failed', e);
      }

      // If org details not loaded yet (e.g., organizations table), try preschools by id to get name
      if (!org) {
        try {
          const { data: orgData } = await assertSupabase()
            .from('preschools')
            .select('id, name, subscription_tier')
            .eq('id', resolvedOrgId)
            .maybeSingle();
          if (orgData) org = orgData;
        } catch (e) {
          debug('preschools by id lookup failed', e);
        }
      }
    }

    // Get capabilities based on role
    const capabilities = await getUserCapabilities(
      profile.role,
      org?.subscription_tier || org?.plan_tier || 'free',
      orgMember?.seat_status
    );

    // Create base profile from database data
    const baseProfile: UserProfile = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      organization_id: resolvedOrgId || orgMember?.organization_id || (profile as any)?.organization_id || (profile as any)?.preschool_id,
      organization_name: org?.name,
      seat_status: orgMember?.seat_status || 'active',
      capabilities,
      created_at: profile.created_at,
      last_login_at: profile.last_login_at,
    };

    // Create enhanced profile
    const enhancedProfile = createEnhancedProfile(baseProfile, {
      organization_id: baseProfile.organization_id,
      organization_name: org?.name,
      plan_tier: org?.subscription_tier || org?.plan_tier || 'free',
      seat_status: orgMember?.seat_status || 'active',
      invited_by: orgMember?.invited_by,
      created_at: orgMember?.created_at,
    });
    
    // Track profile fetch for analytics with security monitoring
    track('edudash.rbac.profile_fetched', {
      user_id: userId,
      role: normalizeRole(profile.role) || 'unknown',
      has_org: !!orgMember || !!profile.preschool_id,
      seat_status: orgMember?.seat_status || 'active',
      plan_tier: org?.subscription_tier || org?.plan_tier || 'free',
      capabilities_count: capabilities.length,
      database_success: true,
    });
    
    // Special monitoring for superadmin access
    if (normalizeRole(profile.role) === 'super_admin') {
      track('edudash.security.superadmin_access', {
        user_id: userId,
        timestamp: new Date().toISOString(),
        session_source: 'profile_fetch'
      });
      
      warn('SECURITY: Super admin profile accessed - monitoring enabled');
    }
    
    return enhancedProfile;
  } catch (error) {
    logError('Error in fetchEnhancedUserProfile:', error);
    reportError(new Error('Failed to fetch enhanced user profile'), {
      userId,
      error,
    });
    
    // SECURITY: Validate authentication before returning error fallback
    const { data: { session } } = await assertSupabase().auth.getSession();

    // Allow stored session for error fallback as well
    let sessionUserId: string | null = session?.user?.id ?? null;
    let storedSession: import('@/lib/sessionManager').UserSession | null = null;
    if (!sessionUserId) {
      try {
        storedSession = await getCurrentSession();
        if (storedSession?.user_id) sessionUserId = storedSession.user_id;
      } catch (e) {
        debug('getCurrentSession() failed in error fallback', e);
      }
    }

    if (!sessionUserId || sessionUserId !== userId) {
      logError('Authentication validation failed in error handler');
      return null; // No fallback for unauthenticated users
    }

    // Return MINIMAL fallback profile on error
    if (!session?.user) {
      return null;
    }
    const fallbackProfile: UserProfile = {
      id: session.user.id,
      email: session.user.email || 'unknown@example.com',
      role: 'parent' as any, // LOWEST PRIVILEGE ROLE
      first_name: 'User',
      last_name: '',
      avatar_url: undefined,
      organization_id: undefined,
      organization_name: undefined,
      seat_status: 'inactive' as any, // INACTIVE for security
      capabilities: [], // NO CAPABILITIES
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    };
    
    const enhancedFallback = createEnhancedProfile(fallbackProfile, {
      organization_id: null,
      organization_name: null,
      plan_tier: 'free',
      seat_status: 'inactive',
      invited_by: null,
      created_at: new Date().toISOString(),
    });
    
    // Log security event
    const sessionToken = session?.access_token || storedSession?.access_token || '';
    const sessionId = sessionToken ? sessionToken.substring(0, 32) : '';
    if (sessionId) {
      trackFallbackUsage(sessionId);
    }

    track('edudash.security.error_fallback_profile_used', {
      user_id: sessionUserId,
      email: session?.user?.email || storedSession?.email,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    
    console.warn('SECURITY: Using error fallback profile with minimal permissions');
    return enhancedFallback;
  }
}

/**
 * Audit permission changes
 */
export async function auditPermissionChange(
  userId: string,
  action: string,
  details: Record<string, any>
): Promise<void> {
  try {
    // Log to analytics
    track('edudash.rbac.permission_change', {
      user_id: userId,
      action,
      ...details,
      timestamp: new Date().toISOString(),
    });
    
    // Could also log to a dedicated audit table if needed
    log('Permission audit:', { userId, action, details });
  } catch (error) {
    reportError(new Error('Failed to audit permission change'), {
      userId,
      action,
      details,
      error,
    });
  }
}

/**
 * Create SecurityContext from EnhancedUserProfile
 * Used to integrate RBAC with security utilities
 */
export function createSecurityContext(profile: EnhancedUserProfile | null): any | null {
  if (!profile) return null;
  
  return {
    userId: profile.id,
    role: normalizeRole(profile.role) as Role,
    organizationId: profile.organization_id,
    capabilities: profile.capabilities,
    seatStatus: profile.seat_status,
  };
}

/**
 * Get secure database instance for user profile
 */
export function getSecureDatabase(profile: EnhancedUserProfile | null) {
  const context = createSecurityContext(profile);
  if (!context) {
    throw new Error('Cannot create secure database without valid user profile');
  }
  
  // Import dynamically to avoid circular dependencies
  const { createSecureDatabase } = require('@/lib/security');
  return createSecureDatabase(context);
}
