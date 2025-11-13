/**
 * Lesson Detail Screen
 * 
 * Displays detailed lesson content with interactive features,
 * progress tracking, and navigation capabilities.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { router, useLocalSearchParams } from 'expo-router';
import { Lesson, LessonProgress } from '@/types/lessons';
import LessonsService from '@/services/LessonsService';

export default function LessonDetailScreen() {
  const { theme } = useTheme();
  const { lessonId } = useLocalSearchParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const lessonsService = LessonsService;

  useEffect(() => {
    loadLessonData();
  }, [lessonId]);

  const loadLessonData = async () => {
    if (!lessonId || typeof lessonId !== 'string') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load lesson data
      const lessonData = await lessonsService.getLessonById(lessonId);
      if (lessonData) {
        setLesson(lessonData);
        
        // Load progress data
        const progressData = await lessonsService.getUserLessonProgress(lessonId);
        if (progressData) {
          setProgress(progressData);
          setIsBookmarked(!!progressData.bookmarked_at);
        }
      }
    } catch (error) {
      console.error('Error loading lesson data:', error);
      Alert.alert('Error', 'Failed to load lesson details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartLesson = async () => {
    if (!lesson) return;

    try {
      await lessonsService.updateLessonProgress(lesson.id, {
        status: 'in_progress',
        progress_percentage: progress?.progress_percentage || 0,
        started_at: new Date().toISOString(),
      });
      
      Alert.alert('Lesson Started', 'You have started this lesson! Progress will be tracked.');
      loadLessonData(); // Refresh progress
    } catch (error) {
      console.error('Error starting lesson:', error);
      Alert.alert('Error', 'Failed to start lesson. Please try again.');
    }
  };

  const handleCompleteLesson = async () => {
    if (!lesson) return;

    try {
      await lessonsService.updateLessonProgress(lesson.id, {
        status: 'completed',
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
      });
      
      Alert.alert('Congratulations!', 'You have completed this lesson!');
      loadLessonData(); // Refresh progress
    } catch (error) {
      console.error('Error completing lesson:', error);
      Alert.alert('Error', 'Failed to complete lesson. Please try again.');
    }
  };

  const handleBookmarkToggle = async () => {
    if (!lesson) return;

    try {
      const newBookmarkStatus = await lessonsService.toggleLessonBookmark(lesson.id);
      setIsBookmarked(newBookmarkStatus);
      
      Alert.alert(
        newBookmarkStatus ? 'Bookmarked' : 'Bookmark Removed', 
        newBookmarkStatus ? 'Lesson added to your bookmarks' : 'Lesson removed from your bookmarks'
      );
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      Alert.alert('Error', 'Failed to update bookmark. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading lesson...</Text>
        </View>
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            Lesson Not Found
          </Text>
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.errorTitle, { color: theme.text }]}>Lesson Not Found</Text>
          <Text style={[styles.errorDescription, { color: theme.textSecondary }]}>
            The lesson you're looking for could not be found. It may have been removed or the link may be incorrect.
          </Text>
          
          <TouchableOpacity
            style={[styles.backToHubButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Ionicons name="library-outline" size={20} color={theme.onPrimary} />
            <Text style={[styles.backToHubText, { color: theme.onPrimary }]}>
              Back to Lessons Hub
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {lesson.title}
        </Text>
        <TouchableOpacity 
          onPress={handleBookmarkToggle}
          style={styles.bookmarkButton}
        >
          <Ionicons 
            name={isBookmarked ? "bookmark" : "bookmark-outline"} 
            size={24} 
            color={isBookmarked ? theme.primary : theme.text} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Lesson Header */}
        <View style={styles.lessonHeader}>
          <Text style={[styles.lessonTitle, { color: theme.text }]}>
            {lesson.title}
          </Text>
          <Text style={[styles.lessonDescription, { color: theme.textSecondary }]}>
            {lesson.description}
          </Text>
        </View>

        {/* Lesson Meta Info */}
        <View style={[styles.metaContainer, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={20} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.text }]}>
                {lesson.estimated_duration} min
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="school-outline" size={20} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.text }]}>
                {lesson.skill_level.name}
              </Text>
            </View>
          </View>
          
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={20} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.text }]}>
                Ages {lesson.age_range.min_age}-{lesson.age_range.max_age}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={20} color={"#FFD700"} />
              <Text style={[styles.metaText, { color: theme.text }]}>
                {lesson.rating.toFixed(1)} ({lesson.review_count})
              </Text>
            </View>
          </View>
        </View>

        {/* Progress Bar */}
        {progress && (
          <View style={[styles.progressContainer, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.progressTitle, { color: theme.text }]}>Your Progress</Text>
            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { backgroundColor: theme.primary, width: `${progress.progress_percentage}%` }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              {progress.progress_percentage}% complete • Status: {progress.status.replace('_', ' ')}
            </Text>
          </View>
        )}

        {/* Learning Objectives */}
        {lesson.learning_objectives && lesson.learning_objectives.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Learning Objectives</Text>
            {lesson.learning_objectives.map((objective, index) => (
              <View key={index} style={styles.objectiveItem}>
                <Ionicons name="checkmark-circle-outline" size={20} color={theme.primary} />
                <Text style={[styles.objectiveText, { color: theme.textSecondary }]}>
                  {objective.description}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Prerequisites */}
        {lesson.prerequisites && lesson.prerequisites.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Prerequisites</Text>
            {lesson.prerequisites.map((prereq, index) => (
              <View key={index} style={styles.prereqItem}>
                <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
                <Text style={[styles.prereqText, { color: theme.textSecondary }]}>
                  {prereq}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {!progress || progress.status === 'not_started' ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={handleStartLesson}
            >
              <Ionicons name="play-circle" size={24} color={theme.onPrimary} />
              <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                Start Lesson
              </Text>
            </TouchableOpacity>
          ) : progress.status === 'in_progress' ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: theme.cardBackground, borderColor: theme.primary }]}
                onPress={handleStartLesson}
              >
                <Ionicons name="refresh" size={20} color={theme.primary} />
                <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                  Continue
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.primary, flex: 1 }]}
                onPress={handleCompleteLesson}
              >
                <Ionicons name="checkmark-circle" size={20} color={theme.onPrimary} />
                <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                  Mark Complete
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.completedContainer, { backgroundColor: theme.success + '20', borderColor: theme.success }]}>
              <Ionicons name="checkmark-circle" size={24} color={theme.success} />
              <Text style={[styles.completedText, { color: theme.success }]}>
                Lesson Completed!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  bookmarkButton: {
    padding: 8,
    marginLeft: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  lessonHeader: {
    marginBottom: 20,
  },
  lessonTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    lineHeight: 34,
  },
  lessonDescription: {
    fontSize: 16,
    lineHeight: 24,
  },
  metaContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  objectiveText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  prereqItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  prereqText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  actionContainer: {
    marginBottom: 32,
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  completedText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backToHubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  backToHubText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
