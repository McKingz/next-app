/**
 * FAB Position Utilities
 * 
 * Handles position bounds, clamping, and persistence for the Dash Voice FAB.
 * Ensures FAB stays within safe screen bounds with proper margins.
 */

import { Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const FAB_SIZE = 60;
export const FAB_POSITION_KEY = '@dash_fab_position';

// Safe movement bounds to prevent FAB from going off-screen
const RIGHT_MARGIN = 20;
const BOTTOM_MARGIN = Platform.OS === 'ios' ? 90 : 80;
const LEFT_MARGIN = 20;
const TOP_MARGIN = 100; // avoid headers/notches

export type FABPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface Position {
  x: number;
  y: number;
}

export interface PositionBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Calculate position bounds based on screen size and margins
 */
export function getPositionBounds(): PositionBounds {
  const minX = -(screenWidth - FAB_SIZE - (LEFT_MARGIN + RIGHT_MARGIN));
  const maxX = 0; // 0 = right edge (anchored at right)
  const minY = -(screenHeight - FAB_SIZE - (TOP_MARGIN + BOTTOM_MARGIN));
  const maxY = 0; // 0 = bottom edge (anchored at bottom)
  return { minX, maxX, minY, maxY };
}

/**
 * Clamp a value between min and max
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Clamp position to stay within screen bounds
 */
export function clampPosition(x: number, y: number): Position {
  const { minX, maxX, minY, maxY } = getPositionBounds();
  return {
    x: clamp(x, minX, maxX),
    y: clamp(y, minY, maxY),
  };
}

/**
 * Get initial position based on preset position
 */
export function getInitialPosition(position: FABPosition = 'bottom-right'): Position {
  const margin = 20;
  switch (position) {
    case 'bottom-left':
      return { x: -(screenWidth - FAB_SIZE - margin * 2), y: 0 };
    case 'top-right':
      return { x: 0, y: -(screenHeight - FAB_SIZE - 100) };
    case 'top-left':
      return { x: -(screenWidth - FAB_SIZE - margin * 2), y: -(screenHeight - FAB_SIZE - 100) };
    default: // bottom-right
      return { x: 0, y: 0 };
  }
}

/**
 * Load saved FAB position from AsyncStorage
 */
export async function loadSavedPosition(fallbackPosition: FABPosition = 'bottom-right'): Promise<Position> {
  try {
    const saved = await AsyncStorage.getItem(FAB_POSITION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Position;
      return clampPosition(parsed.x, parsed.y);
    }
  } catch (error) {
    console.error('[FAB Position] Failed to load saved position:', error);
  }
  
  // Return clamped initial position as fallback
  const initial = getInitialPosition(fallbackPosition);
  return clampPosition(initial.x, initial.y);
}

/**
 * Save FAB position to AsyncStorage
 */
export async function savePosition(x: number, y: number): Promise<void> {
  try {
    await AsyncStorage.setItem(FAB_POSITION_KEY, JSON.stringify({ x, y }));
  } catch (error) {
    console.error('[FAB Position] Failed to save position:', error);
  }
}
