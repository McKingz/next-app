// 🔐 Security Event Logger
// Comprehensive security event tracking and monitoring system

import { 
  SecurityEvent, 
  SecurityEventType, 
  RateLimit, 
  RateLimitAction,
  AuthError 
} from '../../types/auth-enhanced';

interface SecurityEventConfig {
  maxEventsInMemory: number;
  retentionPeriodDays: number;
  alertThresholds: {
    failedLogins: number;
    suspiciousActivity: number;
    rateLimitViolations: number;
  };
  enableRealTimeAlerts: boolean;
  logToConsole: boolean;
}

interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsByRiskLevel: Record<string, number>;
  activeIncidents: number;
  alertsTriggered: number;
}

interface SecurityAlert {
  id: string;
  type: 'authentication' | 'rate_limit' | 'suspicious_activity' | 'security_policy';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  userId?: string;
  email?: string;
  ipAddress: string;
  triggeredAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  actions: string[];
  metadata: Record<string, any>;
}

interface RateLimitConfig {
  windows: Record<RateLimitAction, { limit: number; windowMs: number }>;
  blockDurationMs: number;
  maxViolationsBeforeLongBlock: number;
  longBlockDurationMs: number;
}

const DEFAULT_CONFIG: SecurityEventConfig = {
  maxEventsInMemory: 10000,
  retentionPeriodDays: 90,
  alertThresholds: {
    failedLogins: 5,
    suspiciousActivity: 3,
    rateLimitViolations: 10
  },
  enableRealTimeAlerts: true,
  logToConsole: true
};

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windows: {
    login: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts in 15 minutes
    registration: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts in 1 hour
    password_reset: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts in 1 hour
    email_verification: { limit: 5, windowMs: 60 * 60 * 1000 } // 5 attempts in 1 hour
  },
  blockDurationMs: 15 * 60 * 1000, // 15 minutes
  maxViolationsBeforeLongBlock: 3,
  longBlockDurationMs: 24 * 60 * 60 * 1000 // 24 hours
};

export class SecurityEventLogger {
  private events: SecurityEvent[] = [];
  private rateLimits: Map<string, RateLimit> = new Map();
  private alerts: SecurityAlert[] = [];
  private config: SecurityEventConfig;
  private rateLimitConfig: RateLimitConfig;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(
    config?: Partial<SecurityEventConfig>,
    rateLimitConfig?: Partial<RateLimitConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rateLimitConfig = { 
      ...DEFAULT_RATE_LIMIT_CONFIG, 
      ...rateLimitConfig,
      windows: { ...DEFAULT_RATE_LIMIT_CONFIG.windows, ...rateLimitConfig?.windows }
    };

    // Cleanup old events periodically
    setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000); // Clean up every hour
  }

  /**
   * Log a security event
   */
  async logEvent(
    type: SecurityEventType,
    details: {
      userId?: string;
      email?: string;
      ipAddress: string;
      userAgent: string;
      success?: boolean;
      errorCode?: string;
      errorMessage?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      type,
      userId: details.userId,
      email: details.email,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      timestamp: new Date(),
      details: {
        success: details.success,
        errorCode: details.errorCode,
        errorMessage: details.errorMessage,
        ...details.metadata
      },
      riskLevel: this.calculateRiskLevel(type, details),
      resolved: false
    };

    // Store event
    this.events.push(event);

    // Maintain memory limit
    if (this.events.length > this.config.maxEventsInMemory) {
      this.events.shift(); // Remove oldest event
    }

    // Log to console if enabled
    if (this.config.logToConsole) {
      console.log(`[SECURITY] ${type.toUpperCase()}: ${JSON.stringify(event)}`);
    }

    // Check for security alerts
    await this.checkForSecurityAlerts(event);

    // Trigger event listeners
    this.triggerEventListeners('event_logged', event);

    return event;
  }

  /**
   * Check rate limits for an action
   */
  checkRateLimit(identifier: string, action: RateLimitAction): {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    blocked: boolean;
  } {
    const rateLimitKey = `${identifier}:${action}`;
    const now = new Date();
    const config = this.rateLimitConfig.windows[action];
    
    let rateLimit = this.rateLimits.get(rateLimitKey);

    // Initialize if doesn't exist
    if (!rateLimit) {
      rateLimit = {
        identifier,
        action,
        attempts: 0,
        firstAttempt: now,
        lastAttempt: now
      };
    }

    // Check if blocked
    if (rateLimit.blockedUntil && rateLimit.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: rateLimit.blockedUntil,
        blocked: true
      };
    }

    // Reset window if expired
    const windowExpired = now.getTime() - rateLimit.firstAttempt.getTime() > config.windowMs;
    if (windowExpired) {
      rateLimit = {
        identifier,
        action,
        attempts: 0,
        firstAttempt: now,
        lastAttempt: now
      };
    }

    // Check if limit exceeded
    const remaining = Math.max(0, config.limit - rateLimit.attempts);
    const allowed = remaining > 0;

    // If not allowed, apply blocking
    if (!allowed) {
      const blockDuration = this.calculateBlockDuration(identifier, action);
      rateLimit.blockedUntil = new Date(now.getTime() + blockDuration);
      
      // Log rate limit violation
      this.logEvent('rate_limit_exceeded', {
        ipAddress: identifier,
        userAgent: 'Unknown',
        metadata: {
          action,
          attempts: rateLimit.attempts,
          limit: config.limit,
          windowMs: config.windowMs,
          blockedUntil: rateLimit.blockedUntil
        }
      });
    }

    // Update rate limit
    rateLimit.attempts++;
    rateLimit.lastAttempt = now;
    this.rateLimits.set(rateLimitKey, rateLimit);

    const resetTime = new Date(rateLimit.firstAttempt.getTime() + config.windowMs);

    return {
      allowed,
      remaining: allowed ? remaining - 1 : 0,
      resetTime,
      blocked: !allowed
    };
  }

  /**
   * Record a rate limit attempt (successful or failed)
   */
  recordAttempt(identifier: string, action: RateLimitAction, success: boolean): void {
    const result = this.checkRateLimit(identifier, action);
    
    if (!result.allowed && !success) {
      // Additional logging for blocked attempts
      this.logEvent('rate_limit_exceeded', {
        ipAddress: identifier,
        userAgent: 'Unknown',
        success: false,
        metadata: {
          action,
          blocked: true,
          resetTime: result.resetTime
        }
      });
    }
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    const eventsByType: Record<SecurityEventType, number> = {
      'login_attempt': 0,
      'login_success': 0,
      'login_failure': 0,
      'registration_attempt': 0,
      'registration_success': 0,
      'password_change': 0,
      'email_verification': 0,
      'account_lockout': 0,
      'invitation_sent': 0,
      'invitation_accepted': 0,
      'role_change': 0,
      'suspicious_activity': 0,
      'rate_limit_exceeded': 0
    };

    const eventsByRiskLevel: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    for (const event of this.events) {
      eventsByType[event.type]++;
      eventsByRiskLevel[event.riskLevel]++;
    }

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsByRiskLevel,
      activeIncidents: this.events.filter(e => !e.resolved && e.riskLevel === 'critical').length,
      alertsTriggered: this.alerts.filter(a => !a.acknowledged).length
    };
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit: number = 100, filters?: {
    type?: SecurityEventType;
    riskLevel?: string;
    userId?: string;
    ipAddress?: string;
    timeRange?: { start: Date; end: Date };
  }): SecurityEvent[] {
    let filteredEvents = [...this.events];

    if (filters) {
      if (filters.type) {
        filteredEvents = filteredEvents.filter(e => e.type === filters.type);
      }
      if (filters.riskLevel) {
        filteredEvents = filteredEvents.filter(e => e.riskLevel === filters.riskLevel);
      }
      if (filters.userId) {
        filteredEvents = filteredEvents.filter(e => e.userId === filters.userId);
      }
      if (filters.ipAddress) {
        filteredEvents = filteredEvents.filter(e => e.ipAddress === filters.ipAddress);
      }
      if (filters.timeRange) {
        filteredEvents = filteredEvents.filter(e => 
          e.timestamp >= filters.timeRange!.start && 
          e.timestamp <= filters.timeRange!.end
        );
      }
    }

    return filteredEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get active security alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return this.alerts
      .filter(alert => !alert.resolved)
      .sort((a, b) => {
        // Sort by severity first, then by timestamp
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.triggeredAt.getTime() - a.triggeredAt.getTime();
      });
  }

  /**
   * Acknowledge a security alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.triggerEventListeners('alert_acknowledged', alert);
    return true;
  }

  /**
   * Resolve a security alert
   */
  resolveAlert(alertId: string, resolvedBy: string, resolution?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedBy = resolvedBy;
    alert.resolvedAt = new Date();
    
    if (resolution) {
      alert.metadata.resolution = resolution;
    }

    this.triggerEventListeners('alert_resolved', alert);
    return true;
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, callback: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, callback: Function): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Generate analysis report
   */
  generateSecurityReport(timeRange: { start: Date; end: Date }): {
    summary: SecurityMetrics;
    trends: {
      failedLogins: number[];
      suspiciousActivity: number[];
      rateLimitViolations: number[];
    };
    topRisks: Array<{
      type: string;
      count: number;
      riskLevel: string;
    }>;
    recommendations: string[];
  } {
    const eventsInRange = this.events.filter(
      e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );

    const summary = this.getSecurityMetrics();
    
    // Calculate trends (simplified - in production would use time buckets)
    const trends = {
      failedLogins: [eventsInRange.filter(e => e.type === 'login_failure').length],
      suspiciousActivity: [eventsInRange.filter(e => e.type === 'suspicious_activity').length],
      rateLimitViolations: [eventsInRange.filter(e => e.type === 'rate_limit_exceeded').length]
    };

    // Identify top risks
    const riskCounts = new Map<string, { count: number; maxRiskLevel: string }>();
    for (const event of eventsInRange) {
      const key = event.type;
      const current = riskCounts.get(key) || { count: 0, maxRiskLevel: 'low' };
      current.count++;
      if (this.getRiskLevelOrder(event.riskLevel) > this.getRiskLevelOrder(current.maxRiskLevel)) {
        current.maxRiskLevel = event.riskLevel;
      }
      riskCounts.set(key, current);
    }

    const topRisks = Array.from(riskCounts.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        riskLevel: data.maxRiskLevel
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Generate recommendations
    const recommendations = this.generateSecurityRecommendations(eventsInRange, summary);

    return {
      summary,
      trends,
      topRisks,
      recommendations
    };
  }

  /**
   * Private helper methods
   */

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateRiskLevel(type: SecurityEventType, details: any): SecurityEvent['riskLevel'] {
    // High-risk events
    if (type === 'account_lockout' || type === 'suspicious_activity') {
      return 'critical';
    }

    // Medium-risk events
    if (type === 'login_failure' || type === 'rate_limit_exceeded') {
      return 'medium';
    }

    // Events with multiple failures become high risk
    if (type === 'login_attempt' && !details.success) {
      return 'medium';
    }

    // Low-risk events (successful operations)
    return 'low';
  }

  private async checkForSecurityAlerts(event: SecurityEvent): Promise<void> {
    if (!this.config.enableRealTimeAlerts) return;

    // Check for repeated login failures
    if (event.type === 'login_failure') {
      await this.checkFailedLoginAlert(event);
    }

    // Check for suspicious activity
    if (event.riskLevel === 'critical') {
      await this.createSuspiciousActivityAlert(event);
    }

    // Check for rate limit violations
    if (event.type === 'rate_limit_exceeded') {
      await this.checkRateLimitAlert(event);
    }
  }

  private async checkFailedLoginAlert(event: SecurityEvent): Promise<void> {
    const recentFailures = this.events.filter(e => 
      e.type === 'login_failure' &&
      e.ipAddress === event.ipAddress &&
      e.timestamp.getTime() > Date.now() - (15 * 60 * 1000) // Last 15 minutes
    );

    if (recentFailures.length >= this.config.alertThresholds.failedLogins) {
      await this.createAlert({
        type: 'authentication',
        severity: 'high',
        title: 'Multiple Failed Login Attempts',
        description: `${recentFailures.length} failed login attempts detected from IP ${event.ipAddress}`,
        ipAddress: event.ipAddress,
        userId: event.userId,
        email: event.email,
        actions: [
          'Monitor IP address',
          'Consider IP blocking',
          'Review access logs'
        ],
        metadata: {
          failureCount: recentFailures.length,
          timeWindow: '15 minutes',
          events: recentFailures.map(e => e.id)
        }
      });
    }
  }

  private async createSuspiciousActivityAlert(event: SecurityEvent): Promise<void> {
    await this.createAlert({
      type: 'suspicious_activity',
      severity: 'critical',
      title: 'Suspicious Activity Detected',
      description: `Critical security event: ${event.type}`,
      ipAddress: event.ipAddress,
      userId: event.userId,
      email: event.email,
      actions: [
        'Immediate investigation required',
        'Review user activity',
        'Check for account compromise'
      ],
      metadata: {
        event: event
      }
    });
  }

  private async checkRateLimitAlert(event: SecurityEvent): Promise<void> {
    const recentViolations = this.events.filter(e => 
      e.type === 'rate_limit_exceeded' &&
      e.ipAddress === event.ipAddress &&
      e.timestamp.getTime() > Date.now() - (60 * 60 * 1000) // Last hour
    );

    if (recentViolations.length >= this.config.alertThresholds.rateLimitViolations) {
      await this.createAlert({
        type: 'rate_limit',
        severity: 'medium',
        title: 'Excessive Rate Limit Violations',
        description: `${recentViolations.length} rate limit violations from IP ${event.ipAddress}`,
        ipAddress: event.ipAddress,
        actions: [
          'Review IP activity',
          'Consider extending block duration',
          'Investigate potential abuse'
        ],
        metadata: {
          violationCount: recentViolations.length,
          timeWindow: '1 hour'
        }
      });
    }
  }

  private async createAlert(alertData: Omit<SecurityAlert, 'id' | 'triggeredAt' | 'acknowledged' | 'resolved'>): Promise<SecurityAlert> {
    const alert: SecurityAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      triggeredAt: new Date(),
      acknowledged: false,
      resolved: false,
      ...alertData
    };

    this.alerts.push(alert);
    this.triggerEventListeners('alert_created', alert);

    return alert;
  }

  private calculateBlockDuration(identifier: string, action: RateLimitAction): number {
    // Count recent violations for this identifier/action
    const recentViolations = this.events.filter(e => 
      e.type === 'rate_limit_exceeded' &&
      e.ipAddress === identifier &&
      e.details.action === action &&
      e.timestamp.getTime() > Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
    );

    if (recentViolations.length >= this.rateLimitConfig.maxViolationsBeforeLongBlock) {
      return this.rateLimitConfig.longBlockDurationMs;
    }

    return this.rateLimitConfig.blockDurationMs;
  }

  private cleanupOldEvents(): void {
    const cutoffTime = new Date(
      Date.now() - (this.config.retentionPeriodDays * 24 * 60 * 60 * 1000)
    );

    this.events = this.events.filter(event => event.timestamp > cutoffTime);
  }

  private triggerEventListeners(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in security event listener: ${error}`);
        }
      });
    }
  }

  private getRiskLevelOrder(riskLevel: string): number {
    const order = { low: 1, medium: 2, high: 3, critical: 4 };
    return order[riskLevel as keyof typeof order] || 0;
  }

  private generateSecurityRecommendations(events: SecurityEvent[], metrics: SecurityMetrics): string[] {
    const recommendations: string[] = [];

    // Check for high failure rates
    const totalLogins = metrics.eventsByType.login_attempt;
    const failedLogins = metrics.eventsByType.login_failure;
    if (totalLogins > 0 && (failedLogins / totalLogins) > 0.3) {
      recommendations.push('High login failure rate detected - consider implementing CAPTCHA or additional security measures');
    }

    // Check for rate limit violations
    if (metrics.eventsByType.rate_limit_exceeded > 10) {
      recommendations.push('Frequent rate limit violations - review and potentially adjust rate limiting policies');
    }

    // Check for suspicious activity
    if (metrics.eventsByType.suspicious_activity > 0) {
      recommendations.push('Suspicious activity detected - conduct security audit and review access logs');
    }

    // Check for unresolved incidents
    if (metrics.activeIncidents > 0) {
      recommendations.push(`${metrics.activeIncidents} active security incidents require immediate attention`);
    }

    // Default recommendations
    if (recommendations.length === 0) {
      recommendations.push('Security posture appears stable - continue monitoring');
      recommendations.push('Consider regular security audits and penetration testing');
    }

    return recommendations;
  }
}

// Export a default instance
export const securityLogger = new SecurityEventLogger();

// Export helper functions
export const SecurityUtils = {
  /**
   * Analyze user behavior patterns for anomaly detection
   */
  analyzeUserBehavior(events: SecurityEvent[], userId: string): {
    riskScore: number;
    anomalies: string[];
    recommendations: string[];
  } {
    const userEvents = events.filter(e => e.userId === userId);
    let riskScore = 0;
    const anomalies: string[] = [];
    const recommendations: string[] = [];

    // Check for unusual login times
    const loginEvents = userEvents.filter(e => e.type === 'login_success');
    if (loginEvents.length > 0) {
      const unusualHours = loginEvents.filter(e => {
        const hour = e.timestamp.getHours();
        return hour < 6 || hour > 22; // Outside normal hours
      });

      if (unusualHours.length > loginEvents.length * 0.3) {
        riskScore += 20;
        anomalies.push('Frequent logins outside normal business hours');
        recommendations.push('Review login times and consider time-based access controls');
      }
    }

    // Check for multiple IP addresses
    const uniqueIPs = new Set(userEvents.map(e => e.ipAddress));
    if (uniqueIPs.size > 5) {
      riskScore += 15;
      anomalies.push('Access from multiple IP addresses');
      recommendations.push('Implement IP address monitoring and alerts');
    }

    // Check for failed attempts
    const failedAttempts = userEvents.filter(e => e.type === 'login_failure');
    if (failedAttempts.length > 3) {
      riskScore += 25;
      anomalies.push('Multiple failed authentication attempts');
      recommendations.push('Consider enforcing stronger authentication requirements');
    }

    return {
      riskScore: Math.min(100, riskScore),
      anomalies,
      recommendations
    };
  },

  /**
   * Generate security dashboard data
   */
  generateDashboardData(events: SecurityEvent[]): {
    overview: {
      totalEvents: number;
      criticalEvents: number;
      activeThreats: number;
      securityScore: number;
    };
    charts: {
      eventTimeline: Array<{ time: Date; count: number }>;
      eventTypes: Array<{ type: string; count: number }>;
      riskLevels: Array<{ level: string; count: number }>;
    };
  } {
    const now = new Date();
    const last24Hours = events.filter(
      e => e.timestamp.getTime() > now.getTime() - (24 * 60 * 60 * 1000)
    );

    // Calculate security score (simplified)
    const criticalEvents = last24Hours.filter(e => e.riskLevel === 'critical').length;
    const highRiskEvents = last24Hours.filter(e => e.riskLevel === 'high').length;
    let securityScore = 100;
    securityScore -= (criticalEvents * 20);
    securityScore -= (highRiskEvents * 10);
    securityScore = Math.max(0, securityScore);

    // Event timeline (hourly buckets for last 24 hours)
    const eventTimeline: Array<{ time: Date; count: number }> = [];
    for (let i = 23; i >= 0; i--) {
      const bucketTime = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const bucketEvents = last24Hours.filter(e => {
        const hourDiff = Math.floor((bucketTime.getTime() - e.timestamp.getTime()) / (60 * 60 * 1000));
        return hourDiff === 0;
      });
      eventTimeline.push({ time: bucketTime, count: bucketEvents.length });
    }

    // Event types
    const typeCounts = new Map<string, number>();
    last24Hours.forEach(e => {
      typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
    });
    const eventTypes = Array.from(typeCounts.entries()).map(([type, count]) => ({
      type, count
    }));

    // Risk levels
    const riskCounts = new Map<string, number>();
    last24Hours.forEach(e => {
      riskCounts.set(e.riskLevel, (riskCounts.get(e.riskLevel) || 0) + 1);
    });
    const riskLevels = Array.from(riskCounts.entries()).map(([level, count]) => ({
      level, count
    }));

    return {
      overview: {
        totalEvents: last24Hours.length,
        criticalEvents,
        activeThreats: criticalEvents + highRiskEvents,
        securityScore
      },
      charts: {
        eventTimeline,
        eventTypes,
        riskLevels
      }
    };
  }
};