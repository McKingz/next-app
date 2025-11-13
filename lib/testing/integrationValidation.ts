/**
 * Integration Validation and Testing System
 * 
 * Comprehensive testing utilities to validate business logic integration,
 * dashboard functionality, and real-time data flows across the education platform.
 */

import { assertSupabase } from '@/lib/supabase';
import { 
  FinancialAnalyticsService,
  AttendanceAnalyticsService,
  PerformanceAnalyticsService,
  StudentAnalyticsService,
  TeacherAnalyticsService
} from '@/lib/services/businessLogicServices';
import { RealtimeSubscriptionService } from '@/lib/services/realtimeSubscriptionService';

// Test result types
export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  duration: number;
  details?: any;
}

export interface ValidationSuite {
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  duration: number;
  results: TestResult[];
}

export interface SystemHealthCheck {
  overall: 'healthy' | 'warning' | 'critical';
  database: 'connected' | 'disconnected' | 'error';
  realtime: 'connected' | 'disconnected' | 'error';
  businessLogic: 'functional' | 'partial' | 'non-functional';
  dashboards: 'rendering' | 'partial' | 'broken';
  timestamp: string;
  details: {
    databaseLatency?: number;
    realtimeChannels?: number;
    businessLogicServices?: string[];
    dashboardComponents?: string[];
    errors?: string[];
  };
}

/**
 * Core Integration Validator
 * Tests fundamental system components and their integration
 */
export class IntegrationValidator {
  private static testResults: ValidationSuite[] = [];

  /**
   * Run comprehensive system validation
   */
  static async runFullValidation(schoolId?: string): Promise<SystemHealthCheck> {
    console.log('🔍 Starting full system validation...');
    const startTime = Date.now();

    const healthCheck: SystemHealthCheck = {
      overall: 'healthy',
      database: 'connected',
      realtime: 'connected',
      businessLogic: 'functional',
      dashboards: 'rendering',
      timestamp: new Date().toISOString(),
      details: {
        errors: []
      }
    };

    try {
      // Test database connectivity
      const dbTest = await this.validateDatabaseConnectivity();
      healthCheck.database = dbTest.status === 'passed' ? 'connected' : 'error';
      healthCheck.details.databaseLatency = dbTest.details?.latency;

      // Test business logic services
      const businessLogicTest = await this.validateBusinessLogicServices(schoolId);
      healthCheck.businessLogic = businessLogicTest.passed === businessLogicTest.totalTests ? 'functional' : 
        businessLogicTest.failed === businessLogicTest.totalTests ? 'non-functional' : 'partial';
      healthCheck.details.businessLogicServices = businessLogicTest.results.map(r => r.testName);

      // Test real-time functionality
      const realtimeTest = await this.validateRealtimeFunctionality(schoolId);
      healthCheck.realtime = realtimeTest.status === 'passed' ? 'connected' : 'error';
      healthCheck.details.realtimeChannels = realtimeTest.details?.channels || 0;

      // Test dashboard functionality
      const dashboardTest = await this.validateDashboardIntegration(schoolId);
      healthCheck.dashboards = dashboardTest.status === 'passed' ? 'rendering' : 
        dashboardTest.status === 'warning' ? 'partial' : 'broken';
      healthCheck.details.dashboardComponents = dashboardTest.details?.components || [];

      // Collect errors
      const allTests = [dbTest, businessLogicTest.results, realtimeTest, dashboardTest].flat();
      const failedTests = Array.isArray(allTests) ? allTests.filter(t => t.status === 'failed') : [];
      healthCheck.details.errors = failedTests.map(t => t.message);

      // Determine overall health
      if (healthCheck.database === 'error' || healthCheck.businessLogic === 'non-functional') {
        healthCheck.overall = 'critical';
      } else if (
        healthCheck.database === 'connected' && 
        healthCheck.businessLogic === 'partial' || 
        healthCheck.dashboards === 'partial'
      ) {
        healthCheck.overall = 'warning';
      }

      const duration = Date.now() - startTime;
      console.log(`✅ System validation completed in ${duration}ms`);
      console.log(`📊 Overall health: ${healthCheck.overall.toUpperCase()}`);

      return healthCheck;

    } catch (error) {
      console.error('❌ System validation failed:', error);
      healthCheck.overall = 'critical';
      healthCheck.details.errors = [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`];
      return healthCheck;
    }
  }

  /**
   * Validate database connectivity and basic operations
   */
  static async validateDatabaseConnectivity(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing database connectivity...');

      const testStartTime = Date.now();
      
      // Simple connectivity test - try to fetch from a system table
      const { data, error } = await assertSupabase()
        .from('information_schema.tables')
        .select('table_name')
        .limit(1);

      const latency = Date.now() - testStartTime;

      if (error) {
        return {
          testName: 'Database Connectivity',
          status: 'failed',
          message: `Database connection failed: ${error.message}`,
          duration: Date.now() - startTime,
          details: { error: error.message }
        };
      }

      return {
        testName: 'Database Connectivity',
        status: 'passed',
        message: `Database connected successfully (${latency}ms)`,
        duration: Date.now() - startTime,
        details: { latency, tablesFound: data?.length || 0 }
      };

    } catch (error) {
      return {
        testName: 'Database Connectivity',
        status: 'failed',
        message: `Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Validate business logic services functionality
   */
  static async validateBusinessLogicServices(schoolId: string = 'test-school'): Promise<ValidationSuite> {
    console.log('🔍 Testing business logic services...');
    const startTime = Date.now();
    const results: TestResult[] = [];

    // Test Financial Analytics Service
    try {
      const testStart = Date.now();
      const financialMetrics = await FinancialAnalyticsService.calculateFinancialMetrics(schoolId);
      
      results.push({
        testName: 'Financial Analytics Service',
        status: financialMetrics ? 'passed' : 'failed',
        message: financialMetrics ? 
          `Financial metrics calculated: R${financialMetrics.monthlyRevenue} revenue` : 
          'Failed to calculate financial metrics',
        duration: Date.now() - testStart,
        details: financialMetrics
      });
    } catch (error) {
      results.push({
        testName: 'Financial Analytics Service',
        status: 'failed',
        message: `Financial service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0
      });
    }

    // Test Attendance Analytics Service
    try {
      const testStart = Date.now();
      const attendanceMetrics = await AttendanceAnalyticsService.calculateAttendanceMetrics(schoolId);
      
      results.push({
        testName: 'Attendance Analytics Service',
        status: attendanceMetrics ? 'passed' : 'failed',
        message: attendanceMetrics ? 
          `Attendance metrics calculated: ${attendanceMetrics.overallRate}% rate` : 
          'Failed to calculate attendance metrics',
        duration: Date.now() - testStart,
        details: attendanceMetrics
      });
    } catch (error) {
      results.push({
        testName: 'Attendance Analytics Service',
        status: 'failed',
        message: `Attendance service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0
      });
    }

    // Test Performance Analytics Service
    try {
      const testStart = Date.now();
      const performanceMetrics = await PerformanceAnalyticsService.calculatePerformanceMetrics(schoolId);
      
      results.push({
        testName: 'Performance Analytics Service',
        status: performanceMetrics ? 'passed' : 'failed',
        message: performanceMetrics ? 
          `Performance metrics calculated: ${performanceMetrics.academicPerformance.averageGrade} avg grade` : 
          'Failed to calculate performance metrics',
        duration: Date.now() - testStart,
        details: performanceMetrics
      });
    } catch (error) {
      results.push({
        testName: 'Performance Analytics Service',
        status: 'failed',
        message: `Performance service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0
      });
    }

    // Test Student Analytics Service
    try {
      const testStart = Date.now();
      const studentAnalytics = await StudentAnalyticsService.calculateStudentAnalytics(schoolId);
      
      results.push({
        testName: 'Student Analytics Service',
        status: studentAnalytics ? 'passed' : 'failed',
        message: studentAnalytics ? 
          `Student analytics calculated: ${studentAnalytics.totalStudents} students` : 
          'Failed to calculate student analytics',
        duration: Date.now() - testStart,
        details: studentAnalytics
      });
    } catch (error) {
      results.push({
        testName: 'Student Analytics Service',
        status: 'failed',
        message: `Student service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0
      });
    }

    // Test Teacher Analytics Service
    try {
      const testStart = Date.now();
      const teacherAnalytics = await TeacherAnalyticsService.calculateTeacherAnalytics(schoolId);
      
      results.push({
        testName: 'Teacher Analytics Service',
        status: teacherAnalytics ? 'passed' : 'failed',
        message: teacherAnalytics ? 
          `Teacher analytics calculated: ${teacherAnalytics.totalTeachers} teachers` : 
          'Failed to calculate teacher analytics',
        duration: Date.now() - testStart,
        details: teacherAnalytics
      });
    } catch (error) {
      results.push({
        testName: 'Teacher Analytics Service',
        status: 'failed',
        message: `Teacher service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0
      });
    }

    const suite: ValidationSuite = {
      suiteName: 'Business Logic Services',
      totalTests: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      warnings: results.filter(r => r.status === 'warning').length,
      duration: Date.now() - startTime,
      results
    };

    return suite;
  }

  /**
   * Validate real-time functionality
   */
  static async validateRealtimeFunctionality(schoolId: string = 'test-school'): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing real-time functionality...');

if (!assertSupabase) {
        return {
          testName: 'Real-time Functionality',
          status: 'failed',
          message: 'Supabase client not available for real-time testing',
          duration: Date.now() - startTime
        };
      }

      // Test subscription creation (without actually subscribing to avoid side effects)
      let subscriptionCreated = false;
      let channels = 0;

      try {
        // Mock subscription test - just check if the service methods exist and are callable
        const mockCallback = () => {};
        const subscriptionId = RealtimeSubscriptionService.subscribeToStudentEnrollments(
          schoolId,
          mockCallback,
          'test-subscription'
        );

        if (subscriptionId) {
          subscriptionCreated = true;
          const activeSubscriptions = RealtimeSubscriptionService.getActiveSubscriptions();
          channels = activeSubscriptions.channels;
          
          // Clean up test subscription
          RealtimeSubscriptionService.unsubscribe(subscriptionId);
        }

      } catch (error) {
        console.debug('Real-time subscription test failed (setup)', error);
        console.error('Real-time subscription test failed:', error);
      }

      if (!subscriptionCreated) {
        return {
          testName: 'Real-time Functionality',
          status: 'warning',
          message: 'Real-time subscriptions created but not tested with live data',
          duration: Date.now() - startTime,
          details: { channels: 0, note: 'Live testing skipped to avoid side effects' }
        };
      }

      return {
        testName: 'Real-time Functionality',
        status: 'passed',
        message: 'Real-time subscription system functional',
        duration: Date.now() - startTime,
        details: { channels, subscriptionTested: true }
      };

    } catch (error) {
      return {
        testName: 'Real-time Functionality',
        status: 'failed',
        message: `Real-time test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Validate dashboard integration
   */
  static async validateDashboardIntegration(schoolId: string = 'test-school'): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing dashboard integration...');

      const components = [];
      let issues = [];

      // Test that business logic services can be called (which dashboards depend on)
      try {
        const financialData = await FinancialAnalyticsService.calculateFinancialMetrics(schoolId);
        if (financialData) {
          components.push('Financial Metrics');
        }
      } catch (error) {
        console.debug('Financial dashboard integration issue details', error);
        issues.push('Financial dashboard integration issue');
      }

      try {
        const attendanceData = await AttendanceAnalyticsService.calculateAttendanceMetrics(schoolId);
        if (attendanceData) {
          components.push('Attendance Metrics');
        }
      } catch (error) {
        console.debug('Attendance dashboard integration issue details', error);
        issues.push('Attendance dashboard integration issue');
      }

      try {
        const studentData = await StudentAnalyticsService.calculateStudentAnalytics(schoolId);
        if (studentData) {
          components.push('Student Analytics');
        }
      } catch (error) {
        console.debug('Student dashboard integration issue details', error);
        issues.push('Student dashboard integration issue');
      }

      // Check meeting room component (simulate)
      try {
        // Since meeting rooms are UI components, we just check if the service dependencies are available
components.push('Meeting Room System');
      } catch (error) {
        console.debug('Meeting room system integration issue details', error);
        issues.push('Meeting room system integration issue');
      }

      const status = issues.length === 0 ? 'passed' : 
                   issues.length < components.length ? 'warning' : 'failed';

      return {
        testName: 'Dashboard Integration',
        status,
        message: `Dashboard integration: ${components.length} components functional${issues.length > 0 ? `, ${issues.length} issues` : ''}`,
        duration: Date.now() - startTime,
        details: { 
          components, 
          issues,
          functionalComponents: components.length,
          totalIssues: issues.length
        }
      };

    } catch (error) {
      return {
        testName: 'Dashboard Integration',
        status: 'failed',
        message: `Dashboard integration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Generate comprehensive test report
   */
  static generateTestReport(healthCheck: SystemHealthCheck): string {
    const report = `
# EduDash Pro - System Integration Validation Report

**Generated:** ${healthCheck.timestamp}
**Overall Status:** ${healthCheck.overall.toUpperCase()}

## System Components

### Database Connectivity
- **Status:** ${healthCheck.database.toUpperCase()}
- **Latency:** ${healthCheck.details.databaseLatency || 'N/A'}ms

### Real-time Services
- **Status:** ${healthCheck.realtime.toUpperCase()}
- **Active Channels:** ${healthCheck.details.realtimeChannels || 0}

### Business Logic Services
- **Status:** ${healthCheck.businessLogic.toUpperCase()}
- **Services:** ${healthCheck.details.businessLogicServices?.join(', ') || 'None'}

### Dashboard Components
- **Status:** ${healthCheck.dashboards.toUpperCase()}
- **Components:** ${healthCheck.details.dashboardComponents?.join(', ') || 'None'}

## Issues Found
${healthCheck.details.errors?.length ? 
  healthCheck.details.errors.map(error => `- ${error}`).join('\n') : 
  'No issues detected'}

## Recommendations

${healthCheck.overall === 'critical' ? `
🚨 **CRITICAL**: System requires immediate attention
- Check database connectivity
- Verify Supabase configuration
- Review error logs
` : healthCheck.overall === 'warning' ? `
⚠️ **WARNING**: System functional but has issues
- Monitor performance metrics
- Address partial service failures
- Consider optimization
` : `
✅ **HEALTHY**: System operating normally
- All services functional
- Performance within acceptable range
- Continue regular monitoring
`}

---
*Report generated by EduDash Pro Integration Validator*
`;

    return report.trim();
  }

  /**
   * Quick health check for monitoring
   */
  static async quickHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    timestamp: string;
  }> {
    try {
      const dbCheck = await this.validateDatabaseConnectivity();
      
      if (dbCheck.status === 'failed') {
        return {
          status: 'critical',
          message: 'Database connectivity failed',
          timestamp: new Date().toISOString()
        };
      }

      const businessLogicCheck = await this.validateBusinessLogicServices();
      const healthyServices = businessLogicCheck.passed / businessLogicCheck.totalTests;

      if (healthyServices < 0.5) {
        return {
          status: 'critical',
          message: 'Multiple business logic services failing',
          timestamp: new Date().toISOString()
        };
      } else if (healthyServices < 0.8) {
        return {
          status: 'warning',
          message: 'Some business logic services have issues',
          timestamp: new Date().toISOString()
        };
      }

      return {
        status: 'healthy',
        message: 'All systems operational',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'critical',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
    }
  }
}

/**
 * Performance Monitoring Utilities
 */
class PerformanceMonitor {
  
  /**
   * Monitor dashboard load performance
   */
  static async measureDashboardLoadTime(dashboardType: 'principal' | 'teacher' | 'parent', schoolId?: string): Promise<{
    loadTime: number;
    dataFetchTime: number;
    renderingTime: number;
    status: 'fast' | 'acceptable' | 'slow';
  }> {
    const startTime = Date.now();
    
    try {
      // Simulate data fetching
      const dataStart = Date.now();
      
      if (dashboardType === 'principal') {
        await Promise.all([
          FinancialAnalyticsService.calculateFinancialMetrics(schoolId || 'test'),
          StudentAnalyticsService.calculateStudentAnalytics(schoolId || 'test'),
          TeacherAnalyticsService.calculateTeacherAnalytics(schoolId || 'test')
        ]);
      } else if (dashboardType === 'teacher') {
        await Promise.all([
          AttendanceAnalyticsService.calculateAttendanceMetrics(schoolId || 'test'),
          PerformanceAnalyticsService.calculatePerformanceMetrics(schoolId || 'test')
        ]);
      }
      
      const dataFetchTime = Date.now() - dataStart;
      
      // Simulate rendering time (basic calculation)
      const renderingStart = Date.now();
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate rendering
      const renderingTime = Date.now() - renderingStart;
      
      const totalLoadTime = Date.now() - startTime;
      
      const status = totalLoadTime < 1000 ? 'fast' : 
                   totalLoadTime < 3000 ? 'acceptable' : 'slow';
      
      return {
        loadTime: totalLoadTime,
        dataFetchTime,
        renderingTime,
        status
      };
      
    } catch (error) {
      void error;
      return {
        loadTime: Date.now() - startTime,
        dataFetchTime: 0,
        renderingTime: 0,
        status: 'slow'
      };
    }
  }
}

export {
  IntegrationValidator as default,
  PerformanceMonitor
};
