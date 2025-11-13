/**
 * Security Audit and Monitoring System
 * 
 * Comprehensive security monitoring for the EduDash platform,
 * with special focus on superadmin access and privilege escalation detection.
 */

import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { assertSupabase } from '@/lib/supabase';
import type { EnhancedUserProfile } from './rbac';
import { normalizeRole } from './rbac';

export interface SecurityEvent {
  event_type: 'auth' | 'permission' | 'data_access' | 'system' | 'suspicious';
  severity: 'info' | 'warning' | 'critical';
  user_id: string;
  details: Record<string, any>;
  timestamp: string;
  session_id?: string;
  ip_address?: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  timestamp: string;
  success: boolean;
}

/**
 * Security audit logger with rate limiting and severity classification
 */
export class SecurityAuditor {
  private eventCounts: Map<string, number> = new Map();
  private lastReset: number = Date.now();
  private readonly RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  private readonly MAX_EVENTS_PER_WINDOW = 100;

  /**
   * Log a security event with automatic severity detection
   */
  logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    // Rate limiting check
    const now = Date.now();
    if (now - this.lastReset > this.RATE_LIMIT_WINDOW) {
      this.eventCounts.clear();
      this.lastReset = now;
    }

    const key = `${event.user_id}:${event.event_type}`;
    const currentCount = this.eventCounts.get(key) || 0;
    
    if (currentCount >= this.MAX_EVENTS_PER_WINDOW) {
      console.warn(`SECURITY: Rate limit exceeded for ${key}`);
      return;
    }
    
    this.eventCounts.set(key, currentCount + 1);

    // Create complete security event
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Log to analytics with security context
    track('edudash.security.audit_event', {
      ...securityEvent,
      scrubbed_details: this.scrubSensitiveData(event.details),
    });

    // Log to console based on severity
    const logMethod = this.getLogMethod(event.severity);
    logMethod(`SECURITY AUDIT [${event.severity.toUpperCase()}]:`, {
      type: event.event_type,
      user: event.user_id.substring(0, 8) + '***', // Partially obscure user ID
      details: this.scrubSensitiveData(event.details),
    });

    // Report critical events as errors
    if (event.severity === 'critical') {
      reportError(new Error(`Critical security event: ${event.event_type}`), {
        userId: event.user_id,
        eventType: event.event_type,
        details: this.scrubSensitiveData(event.details),
      });
    }
  }

  /**
   * Monitor superadmin access patterns
   */
  auditSuperAdminAccess(profile: EnhancedUserProfile, action: string, resource?: string): void {
    if (normalizeRole(profile.role) !== 'super_admin') {
      return;
    }

    this.logSecurityEvent({
      event_type: 'permission',
      severity: 'warning',
      user_id: profile.id,
      details: {
        action,
        resource: resource || 'unknown',
        role: profile.role,
        organization: profile.organization_id,
        capabilities: profile.capabilities?.length || 0,
        session_context: 'superadmin_access',
      },
    });

    // Additional monitoring for sensitive actions
    const sensitiveActions = [
      'manage_billing',
      'view_system_logs',
      'manage_feature_flags',
      'access_admin_tools',
      'manage_subscriptions',
    ];

    if (sensitiveActions.some(sensitive => action.includes(sensitive))) {
      this.logSecurityEvent({
        event_type: 'system',
        severity: 'critical',
        user_id: profile.id,
        details: {
          action,
          resource,
          alert_type: 'sensitive_admin_action',
          requires_review: true,
        },
      });
    }
  }

  /**
   * Monitor authentication anomalies
   */
  auditAuthenticationEvent(userId: string, event: 'login' | 'logout' | 'session_refresh' | 'auth_failure', details: any): void {
    const severity = event === 'auth_failure' ? 'warning' : 'info';
    
    this.logSecurityEvent({
      event_type: 'auth',
      severity,
      user_id: userId,
      details: {
        auth_event: event,
        ...this.scrubSensitiveData(details),
      },
    });
  }

  /**
   * Monitor suspicious data access patterns
   */
  auditDataAccess(profile: EnhancedUserProfile, resource: string, action: 'read' | 'write' | 'delete', recordCount?: number): void {
    // Flag unusual access patterns
    let severity: SecurityEvent['severity'] = 'info';
    
    if (recordCount && recordCount > 1000) {
      severity = 'warning'; // Large data access
    }
    
    if (action === 'delete' && recordCount && recordCount > 10) {
      severity = 'critical'; // Bulk deletions
    }

    this.logSecurityEvent({
      event_type: 'data_access',
      severity,
      user_id: profile.id,
      details: {
        resource,
        action,
        record_count: recordCount,
        role: profile.role,
        organization: profile.organization_id,
      },
    });
  }

  /**
   * Monitor privilege escalation attempts
   */
  auditPrivilegeEscalation(userId: string, attemptedAction: string, currentRole: string, requiredRole: string): void {
    this.logSecurityEvent({
      event_type: 'suspicious',
      severity: 'critical',
      user_id: userId,
      details: {
        attempted_action: attemptedAction,
        current_role: currentRole,
        required_role: requiredRole,
        escalation_attempt: true,
        requires_investigation: true,
      },
    });
  }

  /**
   * Get security metrics for monitoring dashboard
   */
  async getSecurityMetrics(timeframe: '1h' | '24h' | '7d' = '24h'): Promise<any> {
    // This would typically query a dedicated security events table
    // For now, we'll return structure for future implementation
    return {
      totalEvents: 0,
      criticalEvents: 0,
      superadminAccess: 0,
      failedAuth: 0,
      suspiciousActivity: 0,
      timeframe,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Scrub sensitive data from log entries
   */
  private scrubSensitiveData(data: Record<string, any>): Record<string, any> {
    const scrubbed = { ...data };
    
    // List of sensitive keys to scrub
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'auth',
      'email', 'phone', 'ssn', 'credit_card',
      'api_key', 'access_token', 'refresh_token'
    ];

    // Recursively scrub sensitive data
    const scrubObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(scrubObject);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
        
        if (isSensitive) {
          result[key] = typeof value === 'string' ? '[SCRUBBED]' : '[SCRUBBED_OBJECT]';
        } else {
          result[key] = scrubObject(value);
        }
      }
      return result;
    };

    return scrubObject(scrubbed);
  }

  /**
   * Get appropriate logging method based on severity
   */
  private getLogMethod(severity: SecurityEvent['severity']): (...args: any[]) => void {
    switch (severity) {
      case 'critical':
        return console.error;
      case 'warning':
        return console.warn;
      case 'info':
      default:
        return console.log;
    }
  }
}

/**
 * Global security auditor instance
 */
export const securityAuditor = new SecurityAuditor();

/**
 * Utility functions for common security checks
 */
export const SecurityUtils = {
  /**
   * Check if action requires elevated privileges
   */
  requiresElevatedPrivileges(action: string): boolean {
    const elevatedActions = [
      'manage_billing',
      'view_all_organizations', 
      'manage_feature_flags',
      'view_system_logs',
      'manage_subscriptions',
      'access_admin_tools',
    ];
    
    return elevatedActions.some(elevated => action.includes(elevated));
  },

  /**
   * Validate session integrity
   */
  async validateSession(userId: string): Promise<boolean> {
    try {
      const { data: { session } } = await assertSupabase().auth.getSession();
      return !!(session?.user?.id === userId);
    } catch (e) {
      console.debug('validateSession failed', e);
      return false;
    }
  },

  /**
   * Check for concurrent sessions (potential account compromise)
   */
  async checkConcurrentSessions(userId: string): Promise<boolean> {
    void userId;
    // This would require session tracking in database
    // For now, return false (no concurrent sessions detected)
    return false;
  },

  /**
   * Generate security report for user
   */
  generateSecurityReport(profile: EnhancedUserProfile): Record<string, any> {
    return {
      user_id: profile.id,
      role: profile.role,
      capabilities: profile.capabilities?.length || 0,
      organization: profile.organization_id,
      seat_status: profile.seat_status,
      is_superadmin: normalizeRole(profile.role) === 'super_admin',
      has_elevated_privileges: profile.capabilities?.some(cap => 
        SecurityUtils.requiresElevatedPrivileges(cap)
      ) || false,
      security_score: this.calculateSecurityScore(profile),
      last_audit: new Date().toISOString(),
    };
  },

  /**
   * Calculate security score based on profile and access patterns
   */
  calculateSecurityScore(profile: EnhancedUserProfile): number {
    let score = 100; // Start with perfect score

    // Reduce score for elevated privileges
    if (normalizeRole(profile.role) === 'super_admin') {
      score -= 30; // Superadmin inherently higher risk
    }

    // Reduce score for inactive seat
    if (profile.seat_status === 'inactive') {
      score -= 20;
    }

    // Reduce score for too many capabilities
    const capCount = profile.capabilities?.length || 0;
    if (capCount > 10) {
      score -= Math.min(20, (capCount - 10) * 2);
    }

    return Math.max(0, Math.min(100, score));
  },
};

/**
 * Security monitoring hooks for React components
 */
export const useSecurityMonitoring = (profile: EnhancedUserProfile | null) => {
  const auditAction = (action: string, resource?: string) => {
    if (!profile) return;
    
    securityAuditor.auditSuperAdminAccess(profile, action, resource);
    
    // Check for privilege escalation
    if (SecurityUtils.requiresElevatedPrivileges(action) && 
        normalizeRole(profile.role) !== 'super_admin' &&
        normalizeRole(profile.role) !== 'principal_admin') {
      securityAuditor.auditPrivilegeEscalation(
        profile.id,
        action,
        profile.role,
        'super_admin'
      );
    }
  };

  const auditDataAccess = (resource: string, action: 'read' | 'write' | 'delete', recordCount?: number) => {
    if (!profile) return;
    securityAuditor.auditDataAccess(profile, resource, action, recordCount);
  };

  return {
    auditAction,
    auditDataAccess,
    profile: profile ? SecurityUtils.generateSecurityReport(profile) : null,
  };
};
