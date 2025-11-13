import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook to detect if user prefers reduced motion
 * Used to disable non-essential animations for accessibility
 */

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  
  useEffect(() => {
    // Check initial preference
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      setReduceMotion(enabled);
    });
    
    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    
    return () => {
      subscription?.remove();
    };
  }, []);
  
  return reduceMotion;
}
