/**
 * Lesson Card Component
 * 
 * Reusable card component for displaying lessons in different layouts
 * across the lessons hub with modern design and consistent styling.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Lesson } from '@/types/lessons';

const { width: screenWidth } = Dimensions.get('window');

interface LessonCardProps {
  lesson: Lesson;
  onPress: () => void;
  variant?: 'featured' | 'compact' | 'list' | 'grid';
  style?: any;
}

export const LessonCard: React.FC<LessonCardProps> = ({
  lesson,
  onPress,
  variant = 'featured',
  style,
}) => {
  const { theme } = useTheme();

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const getDifficultyColor = (rating: number) => {
    if (rating <= 2) return theme.success;
    if (rating <= 3) return theme.warning;
    return theme.error;
  };

  const getDifficultyLabel = (rating: number) => {
    if (rating <= 2) return 'Easy';
    if (rating <= 3) return 'Medium';
    return 'Hard';
  };

  const renderRating = () => {
    const rating = lesson.rating || 0;
    const stars = [];
    
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={12}
          color={i <= rating ? theme.warning : theme.textTertiary}
        />
      );
    }
    
    return (
      <View style={styles.ratingContainer}>
        <View style={styles.stars}>
          {stars}
        </View>
        <Text style={[styles.ratingText, { color: theme.textSecondary }]}>
          ({lesson.review_count || 0})
        </Text>
      </View>
    );
  };

  const renderTags = (maxTags: number = 2) => {
    if (!lesson.tags || lesson.tags.length === 0) return null;
    
    const displayTags = lesson.tags.slice(0, maxTags);
    
    return (
      <View style={styles.tagsContainer}>
        {displayTags.map((tag, idx) => (
          <View
            key={tag?.id ? String(tag.id) : `${tag?.name || 'tag'}-${idx}`}
            style={[
              styles.tag,
              { backgroundColor: `${tag.color}20`, borderColor: tag.color },
            ]}
          >
            <Text style={[styles.tagText, { color: tag.color }]}> 
              {tag.name}
            </Text>
          </View>
        ))}
        {lesson.tags.length > maxTags && (
          <View style={[styles.tag, { backgroundColor: theme.surfaceVariant }]}>
            <Text style={[styles.tagText, { color: theme.textSecondary }]}>
              +{lesson.tags.length - maxTags}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (variant === 'featured') {
    return (
      <TouchableOpacity
        style={[
          styles.featuredCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
          style,
        ]}
        onPress={onPress}
      >
        {lesson.thumbnail_url && (
          <Image
            source={{ uri: lesson.thumbnail_url }}
            style={styles.featuredImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.featuredContent}>
          <View style={styles.featuredHeader}>
            <View style={[styles.categoryBadge, { backgroundColor: lesson.category.color }]}>
              <Ionicons
                name={lesson.category.icon as any}
                size={12}
                color="white"
              />
              <Text style={styles.categoryBadgeText}>
                {lesson.category.name}
              </Text>
            </View>
            
            {lesson.is_premium && (
              <View style={[styles.premiumBadge, { backgroundColor: theme.accent }]}>
                <Ionicons name="diamond" size={10} color="white" />
              </View>
            )}
          </View>
          
          <Text style={[styles.featuredTitle, styles.clickableTitle, { color: theme.primary }]} numberOfLines={2} accessibilityRole="link">
            {lesson.title}
          </Text>
          
          <Text style={[styles.featuredDescription, { color: theme.textSecondary }]} numberOfLines={2}>
            {lesson.short_description}
          </Text>
          
          <View style={styles.featuredMeta}>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={theme.textTertiary} />
              <Text style={[styles.metaText, { color: theme.textTertiary }]}>
                {formatDuration(lesson.estimated_duration)}
              </Text>
              
              <View style={styles.metaSeparator} />
              
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: getDifficultyColor(lesson.difficulty_rating) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.difficultyText,
                    { color: getDifficultyColor(lesson.difficulty_rating) },
                  ]}
                >
                  {getDifficultyLabel(lesson.difficulty_rating)}
                </Text>
              </View>
            </View>
            
            {renderRating()}
          </View>
          
          {renderTags(3)}
        </View>
      </TouchableOpacity>
    );
  }

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
        {lesson.thumbnail_url && (
          <Image
            source={{ uri: lesson.thumbnail_url }}
            style={styles.compactImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.compactContent}>
          <View style={styles.compactHeader}>
            <View style={[styles.categoryDot, { backgroundColor: lesson.category.color }]} />
            {lesson.is_premium && (
              <Ionicons name="diamond" size={12} color={theme.accent} style={styles.premiumIcon} />
            )}
          </View>
          
          <Text style={[styles.compactTitle, styles.clickableTitle, { color: theme.primary }]} numberOfLines={2} accessibilityRole="link">
            {lesson.title}
          </Text>
          
          <View style={styles.compactMeta}>
            <Text style={[styles.compactDuration, { color: theme.textSecondary }]}>
              {formatDuration(lesson.estimated_duration)}
            </Text>
            {renderRating()}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  if (variant === 'list') {
    return (
      <TouchableOpacity
        style={[
          styles.listCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
          style,
        ]}
        onPress={onPress}
      >
        {lesson.thumbnail_url && (
          <Image
            source={{ uri: lesson.thumbnail_url }}
            style={styles.listImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.listContent}>
          <View style={styles.listHeader}>
            <Text style={[styles.listTitle, styles.clickableTitle, { color: theme.primary }]} numberOfLines={1} accessibilityRole="link">
              {lesson.title}
            </Text>
            {lesson.is_premium && (
              <Ionicons name="diamond" size={14} color={theme.accent} />
            )}
          </View>
          
          <Text style={[styles.listDescription, { color: theme.textSecondary }]} numberOfLines={2}>
            {lesson.short_description}
          </Text>
          
          <View style={styles.listMeta}>
            <View style={styles.listMetaLeft}>
              <View style={[styles.categoryDot, { backgroundColor: lesson.category.color }]} />
              <Text style={[styles.listCategory, { color: theme.textSecondary }]}>
                {lesson.category.name}
              </Text>
              <Text style={[styles.listDuration, { color: theme.textTertiary }]}>
                • {formatDuration(lesson.estimated_duration)}
              </Text>
            </View>
            
            {renderRating()}
          </View>
          
          {renderTags(2)}
        </View>
        
        <Ionicons name="chevron-forward" size={20} color={theme.textTertiary} />
      </TouchableOpacity>
    );
  }

  // Default grid variant
  return (
    <TouchableOpacity
      style={[
        styles.gridCard,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
      onPress={onPress}
    >
      {lesson.thumbnail_url && (
        <Image
          source={{ uri: lesson.thumbnail_url }}
          style={styles.gridImage}
          resizeMode="cover"
        />
      )}
      
      <View style={styles.gridContent}>
        <Text style={[styles.gridTitle, styles.clickableTitle, { color: theme.primary }]} numberOfLines={2} accessibilityRole="link">
          {lesson.title}
        </Text>
        
        <View style={styles.gridMeta}>
          <Text style={[styles.gridDuration, { color: theme.textSecondary }]}>
            {formatDuration(lesson.estimated_duration)}
          </Text>
          {renderRating()}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Featured variant styles
  featuredCard: {
    width: 280,
    marginRight: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  featuredImage: {
    width: '100%',
    height: 160,
  },
  featuredContent: {
    padding: 16,
  },
  featuredHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  premiumBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredTitle: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 8,
  },
  featuredDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  featuredMeta: {
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    marginLeft: 4,
  },
  metaSeparator: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.3)',
    marginHorizontal: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Compact variant styles
  compactCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  compactImage: {
    width: '100%',
    height: 120,
  },
  compactContent: {
    padding: 12,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  premiumIcon: {
    marginLeft: 'auto',
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  compactMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactDuration: {
    fontSize: 12,
  },

  // List variant styles
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  listImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  listContent: {
    flex: 1,
    marginRight: 8,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  listDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  listMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listCategory: {
    fontSize: 12,
    marginLeft: 6,
  },
  listDuration: {
    fontSize: 12,
    marginLeft: 4,
  },

  // Grid variant styles
  gridCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  gridImage: {
    width: '100%',
    height: 100,
  },
  gridContent: {
    padding: 12,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  gridMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridDuration: {
    fontSize: 12,
  },

  // Common styles
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
    marginRight: 4,
  },
  ratingText: {
    fontSize: 10,
  },
  clickableTitle: {
    textDecorationLine: 'underline',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
    marginBottom: 4,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default LessonCard;