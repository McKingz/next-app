import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { InteractiveLesson } from '@/services/ProactiveInsightsService';

interface InteractiveLessonsWidgetProps {
  lessons: InteractiveLesson[];
  onLessonPress?: (lesson: InteractiveLesson) => void;
}

export function InteractiveLessonsWidget({ lessons, onLessonPress }: InteractiveLessonsWidgetProps) {
  if (lessons.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="book-outline" size={48} color="#9CA3AF" />
        <Text style={styles.emptyText}>No interactive lessons available yet</Text>
      </View>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return '#4ade80';
      case 'intermediate':
        return '#fbbf24';
      case 'advanced':
        return '#ff6b6b';
      default:
        return '#9CA3AF';
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    const color = getDifficultyColor(difficulty);
    return (
      <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color }]}>
        <Text style={[styles.badgeText, { color }]}>{difficulty}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={24} color="#00f5ff" />
        <Text style={styles.headerTitle}>Interactive Lessons for Your Child</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {lessons.map((lesson, index) => (
          <TouchableOpacity
            key={index}
            style={styles.lessonCard}
            onPress={() => onLessonPress?.(lesson)}
            activeOpacity={0.7}
          >
            <View style={styles.lessonIconContainer}>
              <Ionicons name="play-circle" size={32} color="#00f5ff" />
            </View>

            <Text style={styles.lessonTitle} numberOfLines={2}>
              {lesson.title}
            </Text>

            <Text style={styles.lessonDescription} numberOfLines={2}>
              {lesson.description}
            </Text>

            <View style={styles.lessonFooter}>
              {getDifficultyBadge(lesson.difficulty)}
              <View style={styles.durationContainer}>
                <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                <Text style={styles.durationText}>{lesson.estimated_duration}</Text>
              </View>
            </View>

            {lesson.caps_topics && lesson.caps_topics.length > 0 && (
              <View style={styles.topicsContainer}>
                {lesson.caps_topics.slice(0, 2).map((topic, idx) => (
                  <View key={idx} style={styles.topicTag}>
                    <Text style={styles.topicText} numberOfLines={1}>
                      {topic}
                    </Text>
                  </View>
                ))}
                {lesson.caps_topics.length > 2 && (
                  <View style={styles.topicTag}>
                    <Text style={styles.topicText}>+{lesson.caps_topics.length - 2}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.startButton}>
              <Text style={styles.startButtonText}>Start Lesson</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {lessons.length > 0 && (
        <TouchableOpacity style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All Lessons</Text>
          <Ionicons name="chevron-forward" size={18} color="#00f5ff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  lessonCard: {
    width: 280,
    backgroundColor: '#1a2332',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a3442',
  },
  lessonIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0f1824',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    lineHeight: 22,
  },
  lessonDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
    lineHeight: 20,
  },
  lessonFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  topicTag: {
    backgroundColor: '#2a3442',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  topicText: {
    fontSize: 11,
    color: '#00f5ff',
    fontWeight: '500',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00f5ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f1824',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00f5ff',
    marginRight: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
});
