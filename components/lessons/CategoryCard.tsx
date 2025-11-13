/**
 * Category Card Component
 * 
 * Displays lesson categories with icons, colors, and counts
 * in an attractive card format for the lessons hub.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { LessonCategory } from '@/types/lessons';

interface CategoryCardProps {
  category: LessonCategory;
  onPress: () => void;
  lessonCount?: number;
  variant?: 'default' | 'compact' | 'large';
  style?: any;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  onPress,
  lessonCount,
  variant = 'default',
  style,
}) => {
  const { theme } = useTheme();

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[
          styles.compactCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
          style,
        ]}
        onPress={onPress}
      >
        <View
          style={[
            styles.compactIconContainer,
            { backgroundColor: `${category.color}20` },
          ]}
        >
          <Ionicons
            name={category.icon as any}
            size={24}
            color={category.color}
          />
        </View>
        
        <Text style={[styles.compactTitle, styles.clickableTitle, { color: theme.primary }]} numberOfLines={2} accessibilityRole="link">
          {category.name}
        </Text>
        
        {lessonCount !== undefined && (
          <Text style={[styles.compactCount, { color: theme.textSecondary }]}>
            {lessonCount} lessons
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'large') {
    return (
      <TouchableOpacity
        style={[
          styles.largeCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
          style,
        ]}
        onPress={onPress}
      >
        <View
          style={[
            styles.largeIconContainer,
            { backgroundColor: category.color },
          ]}
        >
          <Ionicons
            name={category.icon as any}
            size={32}
            color="white"
          />
        </View>
        
        <View style={styles.largeContent}>
          <Text style={[styles.largeTitle, styles.clickableTitle, { color: theme.primary }]} accessibilityRole="link">
            {category.name}
          </Text>
          
          <Text style={[styles.largeDescription, { color: theme.textSecondary }]} numberOfLines={2}>
            {category.description}
          </Text>
          
          {lessonCount !== undefined && (
            <Text style={[styles.largeCount, { color: theme.textTertiary }]}>
              {lessonCount} lessons available
            </Text>
          )}
        </View>
        
        <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
      </TouchableOpacity>
    );
  }

  // Default variant
  return (
    <TouchableOpacity
      style={[
        styles.defaultCard,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.defaultIconContainer,
          { backgroundColor: category.color },
        ]}
      >
        <Ionicons
          name={category.icon as any}
          size={28}
          color="white"
        />
      </View>
      
      <View style={styles.defaultContent}>
        <Text style={[styles.defaultTitle, styles.clickableTitle, { color: theme.primary }]} numberOfLines={1} accessibilityRole="link">
          {category.name}
        </Text>
        
        <Text style={[styles.defaultDescription, { color: theme.textSecondary }]} numberOfLines={2}>
          {category.description}
        </Text>
        
        {lessonCount !== undefined && (
          <Text style={[styles.defaultCount, { color: category.color }]}>
            {lessonCount} lessons
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Default variant styles
  defaultCard: {
    width: 160,
    marginRight: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  defaultIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  defaultContent: {
    flex: 1,
  },
  defaultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  clickableTitle: {
    textDecorationLine: 'underline',
  },
  defaultDescription: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  defaultCount: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Compact variant styles
  compactCard: {
    width: 120,
    marginRight: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  compactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 18,
  },
  compactCount: {
    fontSize: 10,
    textAlign: 'center',
  },

  // Large variant styles
  largeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  largeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  largeContent: {
    flex: 1,
    marginRight: 12,
  },
  largeTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 24,
  },
  largeDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  largeCount: {
    fontSize: 12,
  },
});

export default CategoryCard;