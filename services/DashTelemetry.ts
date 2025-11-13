/**
 * DashTelemetry Service
 * 
 * Collects performance metrics and insights to help Dash AI improve over time.
 * Tracks success/failure rates, user satisfaction, and feature usage patterns.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

interface TelemetryEvent {
  id: string;
  type: 'interaction' | 'action' | 'error' | 'feedback';
  timestamp: number;
  data: Record<string, any>;
}

interface InteractionMetrics {
  totalInteractions: number;
  successfulResponses: number;
  failedResponses: number;
  averageResponseTime: number;
  userSatisfactionScore: number;
}

interface FeatureUsage {
  featureId: string;
  usageCount: number;
  successCount: number;
  failureCount: number;
  lastUsed: number;
}

interface ErrorLog {
  id: string;
  error: string;
  context: Record<string, any>;
  timestamp: number;
  resolved: boolean;
}

const STORAGE_KEY_EVENTS = '@dash_telemetry_events';
const STORAGE_KEY_METRICS = '@dash_telemetry_metrics';
const MAX_EVENTS = 500;

export class DashTelemetry {
  private static events: TelemetryEvent[] = [];
  private static metrics: InteractionMetrics | null = null;
  private static featureUsage: Map<string, FeatureUsage> = new Map();
  private static errorLogs: ErrorLog[] = [];

  /**
   * Initialize telemetry system
   */
  static async initialize(): Promise<void> {
    try {
      // Load events
      const eventsJson = await AsyncStorage.getItem(STORAGE_KEY_EVENTS);
      if (eventsJson) {
        this.events = JSON.parse(eventsJson);
      }

      // Load metrics
      const metricsJson = await AsyncStorage.getItem(STORAGE_KEY_METRICS);
      if (metricsJson) {
        this.metrics = JSON.parse(metricsJson);
      } else {
        this.metrics = {
          totalInteractions: 0,
          successfulResponses: 0,
          failedResponses: 0,
          averageResponseTime: 0,
          userSatisfactionScore: 0
        };
      }
    } catch (error) {
      console.error('Failed to initialize telemetry:', error);
      this.metrics = {
        totalInteractions: 0,
        successfulResponses: 0,
        failedResponses: 0,
        averageResponseTime: 0,
        userSatisfactionScore: 0
      };
    }
  }

  /**
   * Track an interaction with Dash
   */
  static async trackInteraction(data: {
    success: boolean;
    responseTime: number;
    intent?: string;
    featureUsed?: string;
  }): Promise<void> {
    if (!this.metrics) {
      await this.initialize();
    }

    // Update metrics
    this.metrics!.totalInteractions++;
    if (data.success) {
      this.metrics!.successfulResponses++;
    } else {
      this.metrics!.failedResponses++;
    }

    // Update average response time
    const totalTime = this.metrics!.averageResponseTime * (this.metrics!.totalInteractions - 1);
    this.metrics!.averageResponseTime = (totalTime + data.responseTime) / this.metrics!.totalInteractions;

    // Track feature usage
    if (data.featureUsed) {
      this.trackFeatureUsage(data.featureUsed, data.success);
    }

    // Log event
    await this.logEvent({
      type: 'interaction',
      data: {
        success: data.success,
        responseTime: data.responseTime,
        intent: data.intent,
        featureUsed: data.featureUsed
      }
    });

    // Persist metrics
    await this.persistMetrics();
  }

  /**
   * Track feature usage
   */
  static trackFeatureUsage(featureId: string, success: boolean): void {
    let usage = this.featureUsage.get(featureId);

    if (!usage) {
      usage = {
        featureId,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        lastUsed: Date.now()
      };
      this.featureUsage.set(featureId, usage);
    }

    usage.usageCount++;
    if (success) {
      usage.successCount++;
    } else {
      usage.failureCount++;
    }
    usage.lastUsed = Date.now();
  }

  /**
   * Track user feedback
   */
  static async trackFeedback(rating: number, comment?: string): Promise<void> {
    if (!this.metrics) {
      await this.initialize();
    }

    // Update satisfaction score (weighted average)
    const totalRatings = this.metrics!.totalInteractions;
    const currentScore = this.metrics!.userSatisfactionScore;
    this.metrics!.userSatisfactionScore = 
      (currentScore * (totalRatings - 1) + rating) / totalRatings;

    await this.logEvent({
      type: 'feedback',
      data: { rating, comment }
    });

    await this.persistMetrics();
  }

  /**
   * Log an error
   */
  static async logError(
    error: string,
    context: Record<string, any>
  ): Promise<void> {
    const errorLog: ErrorLog = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      error,
      context,
      timestamp: Date.now(),
      resolved: false
    };

    this.errorLogs.push(errorLog);

    await this.logEvent({
      type: 'error',
      data: { error, context }
    });
  }

  /**
   * Log a telemetry event
   */
  private static async logEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): Promise<void> {
    const telemetryEvent: TelemetryEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      ...event
    };

    this.events.unshift(telemetryEvent);

    // Limit event storage
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(0, MAX_EVENTS);
    }

    // Persist events
    try {
      await AsyncStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(this.events));
    } catch (error) {
      console.error('Failed to persist telemetry events:', error);
    }
  }

  /**
   * Persist metrics to storage
   */
  private static async persistMetrics(): Promise<void> {
    try {
      if (this.metrics) {
        await AsyncStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(this.metrics));
      }
    } catch (error) {
      console.error('Failed to persist telemetry metrics:', error);
    }
  }

  /**
   * Get current metrics
   */
  static async getMetrics(): Promise<InteractionMetrics> {
    if (!this.metrics) {
      await this.initialize();
    }
    return this.metrics!;
  }

  /**
   * Get feature usage statistics
   */
  static getFeatureUsage(): FeatureUsage[] {
    return Array.from(this.featureUsage.values())
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Get top used features
   */
  static getTopFeatures(limit: number = 5): FeatureUsage[] {
    return this.getFeatureUsage().slice(0, limit);
  }

  /**
   * Get problematic features (high failure rate)
   */
  static getProblematicFeatures(minUsage: number = 5): FeatureUsage[] {
    return this.getFeatureUsage()
      .filter(f => f.usageCount >= minUsage)
      .filter(f => f.failureCount / f.usageCount > 0.3) // >30% failure rate
      .sort((a, b) => (b.failureCount / b.usageCount) - (a.failureCount / a.usageCount));
  }

  /**
   * Get insights for self-improvement
   */
  static async getInsights(): Promise<{
    successRate: number;
    avgResponseTime: number;
    satisfactionScore: number;
    topFeatures: string[];
    problematicFeatures: string[];
    recentErrors: string[];
    recommendation: string;
  }> {
    const metrics = await this.getMetrics();
    const topFeatures = this.getTopFeatures(3);
    const problematicFeatures = this.getProblematicFeatures();
    const recentErrors = this.errorLogs.slice(0, 5).map(e => e.error);

    const successRate = metrics.totalInteractions > 0
      ? (metrics.successfulResponses / metrics.totalInteractions) * 100
      : 0;

    // Generate recommendation
    let recommendation = '';
    if (successRate < 70) {
      recommendation = 'Success rate is low. Consider reviewing error logs and improving response quality.';
    } else if (metrics.averageResponseTime > 3000) {
      recommendation = 'Response times are high. Consider optimizing AI calls or caching.';
    } else if (metrics.userSatisfactionScore < 3.5) {
      recommendation = 'User satisfaction is moderate. Gather more feedback to identify pain points.';
    } else if (problematicFeatures.length > 0) {
      recommendation = `Some features have high failure rates: ${problematicFeatures.map(f => f.featureId).join(', ')}`;
    } else {
      recommendation = 'System is performing well! Continue monitoring metrics.';
    }

    return {
      successRate: Math.round(successRate),
      avgResponseTime: Math.round(metrics.averageResponseTime),
      satisfactionScore: Math.round(metrics.userSatisfactionScore * 10) / 10,
      topFeatures: topFeatures.map(f => f.featureId),
      problematicFeatures: problematicFeatures.map(f => f.featureId),
      recentErrors,
      recommendation
    };
  }

  /**
   * Clear all telemetry data
   */
  static async clearAll(): Promise<void> {
    this.events = [];
    this.featureUsage.clear();
    this.errorLogs = [];
    this.metrics = {
      totalInteractions: 0,
      successfulResponses: 0,
      failedResponses: 0,
      averageResponseTime: 0,
      userSatisfactionScore: 0
    };

    try {
      await AsyncStorage.removeItem(STORAGE_KEY_EVENTS);
      await AsyncStorage.removeItem(STORAGE_KEY_METRICS);
    } catch (error) {
      console.error('Failed to clear telemetry data:', error);
    }
  }

  /**
   * Export telemetry data for analysis
   */
  static async exportData(): Promise<{
    events: TelemetryEvent[];
    metrics: InteractionMetrics;
    featureUsage: FeatureUsage[];
    errors: ErrorLog[];
  }> {
    const metrics = await this.getMetrics();
    
    return {
      events: this.events,
      metrics,
      featureUsage: this.getFeatureUsage(),
      errors: this.errorLogs
    };
  }
}
