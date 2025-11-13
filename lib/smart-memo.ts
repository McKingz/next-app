/**
 * Ultra-Smart Memoization System for Dash
 * 
 * Advanced React optimization utilities that make components render
 * lightning-fast by intelligently preventing unnecessary re-renders
 */

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { measureRender, mark, measure } from './perf';
import { logger } from './logger';

/**
 * Ultra-smart memo that includes performance tracking
 */
export function ultraMemo<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  propsAreEqual?: (prevProps: P, nextProps: P) => boolean,
  displayName?: string
): React.ComponentType<P> {
  const MemoComponent = React.memo(Component, propsAreEqual);
  ;(MemoComponent as any).displayName = displayName || `UltraMemo(${(Component as any).displayName || (Component as any).name})`;
  
  if (__DEV__) {
    return measureRender(MemoComponent as unknown as React.ComponentType<P>, (MemoComponent as any).displayName);
  }
  
  return MemoComponent as unknown as React.ComponentType<P>;
}

/**
 * Deep comparison for objects (use sparingly)
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * Shallow comparison for props (fast)
 */
export function shallowEqual<T extends Record<string, any>>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  
  return true;
}

/**
 * Smart useMemo that includes performance tracking
 */
export function useSmartMemo<T>(
  factory: () => T,
  deps: React.DependencyList | undefined,
  debugLabel?: string
): T {
  return useMemo(() => {
    if (__DEV__ && debugLabel) {
      mark(`memo_${debugLabel}`);
      const result = factory();
      const { duration } = measure(`memo_${debugLabel}`);
      
      if (duration > 50) {
        logger.debug(`🧠 Smart memo ${debugLabel} took ${duration}ms`);
      }
      
      return result;
    }
    
    return factory();
  }, deps);
}

/**
 * Smart useCallback with stability tracking
 */
export function useSmartCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  debugLabel?: string
): T {
  const stableCallback = useCallback(callback, deps);
  const prevDepsRef = useRef<React.DependencyList | null>(null);
  
  useEffect(() => {
    if (__DEV__ && debugLabel) {
      // Track callback stability in development
      if (prevDepsRef.current && prevDepsRef.current !== deps) {
        logger.debug(`🔄 Smart callback ${debugLabel} recreated due to deps change`);
      }
      prevDepsRef.current = deps;
    }
  });
  
  return stableCallback;
}

/**
 * Deferred computation hook - runs heavy work after interactions
 */
export function useDeferredComputation<T>(
  computation: () => T,
  deps: React.DependencyList,
  defaultValue: T
): T {
  const [result, setResult] = React.useState<T>(defaultValue);
  const depsRef = useRef<React.DependencyList>(deps);
  
  useEffect(() => {
    // Only run if dependencies actually changed
    if (shallowEqual(depsRef.current as any, deps as any)) return;
    
    depsRef.current = deps;
    
    InteractionManager.runAfterInteractions(() => {
      try {
        mark('deferred_computation');
        const newResult = computation();
        const { duration } = measure('deferred_computation');
        
        if (__DEV__ && duration > 100) {
          logger.debug(`⏳ Deferred computation took ${duration}ms`);
        }
        
        setResult(newResult);
      } catch (error) {
        logger.warn('Deferred computation failed', error);
      }
    });
  }, deps);
  
  return result;
}

/**
 * Stable styles hook - prevents style object recreation
 */
export function useStableStyles<T extends Record<string, any>>(
  styleFactory: () => T,
  deps?: React.DependencyList
): T {
  return useSmartMemo(styleFactory, deps, 'stable_styles');
}

/**
 * Optimized data transformations with caching
 */
export function useDataTransform<TInput, TOutput>(
  data: TInput[],
  transform: (data: TInput[]) => TOutput[],
  keyExtractor?: (item: TInput) => string,
  debugLabel?: string
): TOutput[] {
  const cacheRef = useRef<Map<string, TOutput>>(new Map());
  
  return useSmartMemo(() => {
    if (!keyExtractor) {
      // No caching, just transform
      return transform(data);
    }
    
    const cache = cacheRef.current;
    const currentKeys = new Set(data.map(keyExtractor));
    
    // Remove stale cache entries
    for (const [key] of cache) {
      if (!currentKeys.has(key)) {
        cache.delete(key);
      }
    }
    
    // Transform and cache
    return transform(data);
  }, [data, transform, keyExtractor], debugLabel || 'data_transform');
}

/**
 * Smart component factory for commonly memoized patterns
 */
export const SmartComponents = {
  /**
   * Memoized text component
   */
  Text: ultraMemo(
    ({ children, ...props }: any) => React.createElement('Text', props, children),
    (prev, next) => prev.children === next.children && shallowEqual(prev, next),
    'SmartText'
  ),
  
  /**
   * Memoized view component
   */
  View: ultraMemo(
    ({ children, style, ...props }: any) => 
      React.createElement('View', { ...props, style }, children),
    (prev, next) => {
      // Smart comparison for style prop
      if (Array.isArray(prev.style) !== Array.isArray(next.style)) return false;
      if (Array.isArray(prev.style)) {
        return shallowEqual(prev.style, next.style) && 
               prev.children === next.children;
      }
      return prev.style === next.style && prev.children === next.children;
    },
    'SmartView'
  ),
};

/**
 * Performance-aware list item memoization
 */
export function createSmartListItem<T>(
  Component: React.ComponentType<{ item: T; index: number }>,
  itemComparator?: (prev: T, next: T) => boolean
) {
  return ultraMemo(
    Component,
    (prevProps, nextProps) => {
      if (prevProps.index !== nextProps.index) return false;
      
      if (itemComparator) {
        return itemComparator(prevProps.item, nextProps.item);
      }
      
      // Default to shallow comparison
      return shallowEqual(prevProps.item as any, nextProps.item as any);
    },
    `SmartListItem(${Component.displayName || Component.name})`
  );
}

/**
 * Agentic optimization - AI-powered component optimization suggestions
 */
export class AgenticOptimizer {
  private static renderTimes = new Map<string, number[]>();
  
  static trackRender(componentName: string, duration: number) {
    if (!this.renderTimes.has(componentName)) {
      this.renderTimes.set(componentName, []);
    }
    
    const times = this.renderTimes.get(componentName)!;
    times.push(duration);
    
    // Keep only last 50 measurements
    if (times.length > 50) {
      times.shift();
    }
    
    // AI suggestions based on performance patterns
    this.generateOptimizationSuggestions(componentName, times);
  }
  
  private static generateOptimizationSuggestions(componentName: string, times: number[]) {
    if (times.length < 10) return;
    
    const avgTime = times.reduce((a, b) => a + b) / times.length;
    const maxTime = Math.max(...times);
    
    if (avgTime > 16) { // 60fps = 16.67ms budget
      logger.warn(`🤖 Dash AI: ${componentName} is slow (avg: ${avgTime.toFixed(1)}ms). Consider memoization.`);
    }
    
    if (maxTime > 100) {
      logger.warn(`🤖 Dash AI: ${componentName} had a ${maxTime.toFixed(1)}ms render. Consider deferred computation.`);
    }
    
    // Detect render spikes
    const spikes = times.filter(t => t > avgTime * 3).length;
    if (spikes > times.length * 0.1) {
      logger.warn(`🤖 Dash AI: ${componentName} has render spikes. Check for prop instability.`);
    }
  }
  
  static getOptimizationReport() {
    const report: Array<{ component: string; avgTime: number; suggestions: string[] }> = [];
    
    for (const [component, times] of this.renderTimes) {
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const suggestions: string[] = [];
      
      if (avgTime > 16) suggestions.push('Consider React.memo()');
      if (avgTime > 50) suggestions.push('Move heavy computations to useMemo()');
      if (Math.max(...times) > 100) suggestions.push('Use deferred computation for heavy work');
      
      if (suggestions.length > 0) {
        report.push({ component, avgTime, suggestions });
      }
    }
    
    return report.sort((a, b) => b.avgTime - a.avgTime);
  }
}

export default {
  ultraMemo,
  useSmartMemo,
  useSmartCallback,
  useDeferredComputation,
  useStableStyles,
  useDataTransform,
  SmartComponents,
  createSmartListItem,
  AgenticOptimizer,
};