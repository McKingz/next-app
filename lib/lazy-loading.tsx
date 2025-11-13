/**
 * Ultra-Smart Lazy Loading System for Dash
 * 
 * Advanced dynamic imports and code splitting that reduces
 * initial bundle size and makes navigation lightning-fast
 */

import React, { Suspense, lazy, ComponentType } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { mark, measure } from './perf';
import { logger } from './logger';
import { useTranslation } from 'react-i18next';

interface LazyComponentOptions {
  fallback?: React.ComponentType;
  errorBoundary?: React.ComponentType<{ error: Error; retry: () => void }>;
  preload?: boolean;
  chunkName?: string;
}

interface LazyLoadedModule<T = any> {
  component: React.ComponentType<T>;
  preloader: () => Promise<void>;
  isLoaded: boolean;
}

/**
 * Smart loading indicator for Dash
 */
const DashLoadingIndicator: React.FC<{ message?: string }> = ({ 
  message
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.loadingContainer}>
      <LinearGradient
        colors={['#0a0a0f', '#1a0a2e']}
        style={styles.loadingGradient}
      >
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#00f5ff" />
          <Text style={styles.loadingText}>{message || t('screens.loading')}</Text>
          <Text style={styles.loadingSubtext}>🧠 {t('dash_ai.optimizing', { defaultValue: 'Dash AI is optimizing...' })}</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

/**
 * Smart error boundary for lazy loaded components
 */
const DashErrorBoundary: React.FC<{ error: Error; retry: () => void }> = ({
  error,
  retry,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.errorContainer}>
      <LinearGradient
        colors={['#ff6b6b', '#ee5a52']}
        style={styles.errorGradient}
      >
        <View style={styles.errorContent}>
          <Text style={styles.errorTitle}>⚠️ {t('errors.generic')}</Text>
          <Text style={styles.errorMessage}>
            {error.message || t('screens.error_loading')}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={retry}>
            <Text style={styles.retryText}>{t('navigation.retry')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

/**
 * Create a lazy-loaded component with intelligent preloading
 */
export function createLazyComponent<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options: LazyComponentOptions = {}
): LazyLoadedModule<T> {
  const {
    fallback = DashLoadingIndicator,
    errorBoundary = DashErrorBoundary,
    preload = false,
    chunkName,
  } = options;

  let preloadPromise: Promise<void> | null = null;
  let isLoaded = false;

  // Create the lazy component
  const LazyComponent = lazy(() => {
    mark(chunkName ? `lazy_load_${chunkName}` : 'lazy_load');
    
    return importFn().then((module) => {
      const { duration } = measure(chunkName ? `lazy_load_${chunkName}` : 'lazy_load');
      
      if (__DEV__) {
        logger.debug(`📦 Lazy loaded ${chunkName || 'component'} in ${duration.toFixed(1)}ms`);
        
        // Agentic optimization suggestions
        if (duration > 2000) {
          logger.warn(`🤖 Dash AI: Slow chunk load detected (${duration.toFixed(1)}ms)`);
          logger.warn('  • Consider splitting this component further');
          logger.warn('  • Pre-load critical chunks during idle time');
          logger.warn('  • Optimize dependencies in this chunk');
        }
      }
      
      isLoaded = true;
      return module;
    });
  });

  // Preloader function
  const preloader = async (): Promise<void> => {
    if (preloadPromise) return preloadPromise;
    
    preloadPromise = importFn().then(() => {
      isLoaded = true;
      if (__DEV__) {
        logger.debug(`📦 Pre-loaded ${chunkName || 'component'}`);
      }
    });
    
    return preloadPromise;
  };

  // Auto-preload if requested
  if (preload) {
    // Use InteractionManager to avoid blocking initial render
    import('react-native').then(({ InteractionManager }) => {
      InteractionManager.runAfterInteractions(preloader);
    });
  }

  // Wrapper component with error boundary
  const component: ComponentType<T> = (props: T) => (
    <ErrorBoundaryWrapper errorBoundary={errorBoundary}>
      <Suspense fallback={React.createElement(fallback)}>
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundaryWrapper>
  );

  return {
    component,
    preloader,
    isLoaded,
  };
}

/**
 * Error boundary wrapper
 */
class ErrorBoundaryWrapper extends React.Component<
  { children: React.ReactNode; errorBoundary: React.ComponentType<{ error: Error; retry: () => void }> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Lazy component error', { error, errorInfo });
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const ErrorComponent = this.props.errorBoundary;
      return <ErrorComponent error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

/**
 * Preload multiple components intelligently
 */
export class ChunkPreloader {
  private static preloadQueue: Array<() => Promise<void>> = [];
  private static isProcessing = false;

  static addToQueue(preloader: () => Promise<void>) {
    this.preloadQueue.push(preloader);
    this.processQueue();
  }

  private static async processQueue() {
    if (this.isProcessing || this.preloadQueue.length === 0) return;
    
    this.isProcessing = true;
    mark('chunk_preload_batch');

    try {
      // Process preloads in batches of 3 to avoid overwhelming the system
      while (this.preloadQueue.length > 0) {
        const batch = this.preloadQueue.splice(0, 3);
        await Promise.allSettled(batch.map(preloader => preloader()));
        
        // Small delay between batches to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const { duration } = measure('chunk_preload_batch');
      if (__DEV__) {
        logger.debug(`📦 Chunk preload batch completed in ${duration.toFixed(1)}ms`);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  static preloadCriticalChunks() {
    // Pre-load the most commonly used screens after app startup
    import('react-native').then(({ InteractionManager }) => {
      InteractionManager.runAfterInteractions(() => {
        this.processQueue();
      });
    });
  }
}

/**
 * Lazy-loaded screen components for Dash
 */

// Financial Dashboard (heavy with charts)
export const LazyFinancialDashboard = createLazyComponent(
  () => import('../app/screens/financial-dashboard'),
  {
    chunkName: 'financial_dashboard',
    fallback: () => <DashLoadingIndicator message="Loading Financial Dashboard..." />,
  }
);

// Petty Cash Management
export const LazyPettyCash = createLazyComponent(
  () => import('../app/screens/petty-cash'),
  {
    chunkName: 'petty_cash',
    fallback: () => <DashLoadingIndicator message="Loading Petty Cash..." />,
  }
);

// AI Homework Grader
export const LazyAIHomeworkGrader = createLazyComponent(
  () => import('../app/screens/ai-homework-grader-live'),
  {
    chunkName: 'ai_homework_grader',
    preload: true, // Pre-load since it's commonly used
    fallback: () => <DashLoadingIndicator message="Loading AI Grader..." />,
  }
);

// Lesson Generator
export const LazyLessonGenerator = createLazyComponent(
  () => import('../app/screens/ai-lesson-generator'),
  {
    chunkName: 'lesson_generator',
    preload: true,
    fallback: () => <DashLoadingIndicator message="Loading Lesson Generator..." />,
  }
);

// Analytics Dashboard
export const LazyAnalyticsDashboard = createLazyComponent(
  () => import('../app/screens/principal-analytics'),
  {
    chunkName: 'analytics_dashboard',
    fallback: () => <DashLoadingIndicator message="Loading Analytics..." />,
  }
);

/**
 * Dynamic module loading for heavy libraries
 */
export const DynamicModules = {
  // Excel.js for report generation
  loadExcelJS: () => 
    import('exceljs').then(module => {
      if (__DEV__) {
        logger.debug('📊 Loaded ExcelJS dynamically');
      }
      return module.default;
    }),

  // Chart libraries
  loadChartKit: () =>
    import('react-native-chart-kit').then(module => {
      if (__DEV__) {
        logger.debug('📈 Loaded Chart Kit dynamically');
      }
      return module;
    }),

  // Heavy utilities
  loadDateFns: () =>
    import('date-fns').then(module => {
      if (__DEV__) {
        logger.debug('📅 Loaded date-fns dynamically');
      }
      return module;
    }),
};

/**
 * Route-based code splitting helper
 */
export function withLazyLoading<T>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  loadingMessage?: string
) {
  return createLazyComponent(importFn, {
    fallback: () => <DashLoadingIndicator message={loadingMessage} />,
  }).component;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#00f5ff',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContent: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    margin: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.8,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default {
  createLazyComponent,
  ChunkPreloader,
  DynamicModules,
  withLazyLoading,
};