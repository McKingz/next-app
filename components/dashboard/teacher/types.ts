/**
 * Teacher Dashboard Type Definitions
 */

import { Dimensions } from 'react-native';

// Screen dimensions and responsive constants
export const { width, height } = Dimensions.get('window');
export const isSmallScreen = width < 380;
export const isTablet = width > 768;
export const cardWidth = (width - 48) / 2;

// Dynamic scaling functions
export const getScaledSize = (baseSize: number): number => {
  if (isTablet) return baseSize * 1.2;
  if (isSmallScreen) return baseSize * 0.85;
  return baseSize;
};

export const getResponsivePadding = (basePadding: number): number => {
  if (isTablet) return basePadding * 1.5;
  if (isSmallScreen) return basePadding * 0.8;
  return basePadding;
};

// Data types
export interface ClassInfo {
  id: string;
  name: string;
  studentCount: number;
  grade: string;
  room: string;
  nextLesson: string;
}

export interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  submitted: number;
  total: number;
  status: 'pending' | 'graded' | 'overdue';
}

export interface TeacherMetric {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: string;
}

export interface AITool {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export interface QuickAction {
  id: string;
  title: string;
  icon: string;
  color: string;
  onPress: () => void | Promise<void>;
  requiredCap?: string;
}

export interface OrgLimits {
  used: {
    lesson_generation: number;
    grading_assistance: number;
    homework_help: number;
  };
  quotas: {
    lesson_generation: number;
    grading_assistance: number;
    homework_help: number;
  };
}
