/**
 * Lesson Viewer Screen
 * 
 * Displays AI-generated lesson plans from Dash AI Assistant
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { EducationalPDFService } from '@/lib/services/EducationalPDFService';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface LessonPlan {
  id: string;
  title: string;
  subject: string;
  grade: string;
  duration: string;
  objectives: string[];
  activities: Array<{
    name: string;
    duration: string;
    description: string;
    materials?: string[];
  }>;
  resources: string[];
  assessments: string[];
  differentiation: string;
  extensions?: string[];
  createdBy: string;
  createdAt: string;
}

export default function LessonViewer() {
  const { theme, isDark } = useTheme();
  const params = useLocalSearchParams();
  const [lesson, setLesson] = useState<LessonPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadLessonData();
  }, [params.lessonId]);

  const loadLessonData = async () => {
    try {
      if (!params.lessonId) {
        Alert.alert('Error', 'No lesson ID provided');
        router.back();
        return;
      }

      let dash;
      try {
        // Dynamic import to avoid circular dependency
        const module = await import('@/services/dash-ai/DashAICompat');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        if (DashClass && DashClass.getInstance) {
          dash = DashClass.getInstance();
          await dash.initialize();
        } else {
          dash = null;
        }
      } catch (error) {
        console.error('[LessonViewer] Failed to get DashAI instance:', error);
        // Continue with fallback lesson data
        dash = null;
      }

      // Try to get lesson from Dash memory
      if (dash) {
        try {
          const memoryItems = await dash.getAllMemoryItems();
          const lessonMemory = memoryItems.find(item => 
            item.key === `generated_lesson_${params.lessonId}`
          );

          if (lessonMemory && lessonMemory.value) {
            setLesson(lessonMemory.value as LessonPlan);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('[LessonViewer] Failed to load from memory:', error);
        }
      }
      
      {
        // Fallback: create a demo lesson
        setLesson({
          id: params.lessonId as string,
          title: 'Learning Adventure: Colors and Shapes',
          subject: params.subject as string || 'General Education',
          grade: params.grade as string || 'Preschool',
          duration: '45 minutes',
          objectives: [
            'Identify basic colors and shapes in the environment',
            'Develop fine motor skills through hands-on activities',
            'Practice vocabulary related to colors and shapes',
            'Work collaboratively in small groups'
          ],
          activities: [
            {
              name: 'Shape Hunt',
              duration: '15 minutes',
              description: 'Students search the classroom for different shapes and sort them by type',
              materials: ['Shape cards', 'Collection baskets', 'Sorting mats']
            },
            {
              name: 'Color Mixing Magic',
              duration: '20 minutes', 
              description: 'Hands-on exploration of primary and secondary colors using safe paints',
              materials: ['Washable paints', 'Paper plates', 'Brushes', 'Paper towels']
            },
            {
              name: 'Shape Story Time',
              duration: '10 minutes',
              description: 'Interactive story featuring shape characters and their adventures'
            }
          ],
          resources: [
            'Shape and color picture books',
            'Digital shape games on tablet',
            'Art supplies for creative expression',
            'Background music for activities'
          ],
          assessments: [
            'Observation checklist for shape identification',
            'Portfolio collection of student artwork',
            'Informal questioning during activities',
            'Peer interaction assessment'
          ],
          differentiation: 'Provide visual supports for visual learners, kinesthetic activities for active learners, and verbal descriptions for auditory learners',
          extensions: [
            'Create a shapes book to take home',
            'Design patterns using shapes and colors',
            'Explore shapes in nature during outdoor time'
          ],
          createdBy: 'DashAI',
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Failed to load lesson:', error);
      Alert.alert('Error', 'Failed to load lesson plan');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!lesson) return;

    try {
      setGenerating(true);
      const pdfService = EducationalPDFService;
      
      const pdfResult = await pdfService.generateLessonPlanPDF({
        title: lesson.title,
        subject: lesson.subject,
        grade: lesson.grade,
        duration: lesson.duration,
        objectives: lesson.objectives,
        activities: lesson.activities.map(activity => ({
          name: activity.name,
          duration: activity.duration,
          description: activity.description,
          materials: activity.materials || []
        })),
        resources: lesson.resources,
        assessments: lesson.assessments,
        differentiation: lesson.differentiation,
        extensions: lesson.extensions || []
      });

      if (pdfResult.success && pdfResult.filePath) {
        Alert.alert(
          'PDF Generated!',
          'Your lesson plan PDF is ready to download.',
          [
            { text: 'View', onPress: () => sharePDF(pdfResult.filePath!) },
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert('Error', pdfResult.error || 'Failed to generate PDF');
      }
    } catch (error) {
      console.error('PDF generation failed:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const sharePDF = async (filePath: string) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert('Share Not Available', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Failed to share PDF:', error);
      Alert.alert('Error', 'Failed to share PDF');
    }
  };

  const shareLesson = async () => {
    if (!lesson) return;

    try {
      const shareContent = `${lesson.title}\n\nSubject: ${lesson.subject}\nGrade: ${lesson.grade}\nDuration: ${lesson.duration}\n\nObjectives:\n${lesson.objectives.map(obj => `• ${obj}`).join('\n')}\n\nGenerated by EduDash Pro AI Assistant`;
      
      await Share.share({
        message: shareContent,
        title: lesson.title
      });
    } catch (error) {
      console.error('Failed to share lesson:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>
            Loading lesson plan...
          </Text>
        </View>
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="document-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.errorText, { color: theme.text }]}>
            Lesson plan not found
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backButtonText, { color: theme.onPrimary }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.backIconButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={[styles.headerTitleText, { color: theme.text }]} numberOfLines={1}>
            Lesson Plan
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {lesson.subject} • {lesson.grade}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={shareLesson}
          >
            <Ionicons name="share-outline" size={20} color={theme.text} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.pdfButton, { backgroundColor: theme.primary }]}
            onPress={generatePDF}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <>
                <Ionicons name="document-text" size={16} color={theme.onPrimary} />
                <Text style={[styles.pdfButtonText, { color: theme.onPrimary }]}>PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title Section */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.lessonTitle, { color: theme.text }]}>
            {lesson.title}
          </Text>
          <View style={styles.metadataRow}>
            <View style={styles.metadataItem}>
              <Ionicons name="time-outline" size={16} color={theme.accent} />
              <Text style={[styles.metadataText, { color: theme.textSecondary }]}>
                {lesson.duration}
              </Text>
            </View>
            <View style={styles.metadataItem}>
              <Ionicons name="person-outline" size={16} color={theme.accent} />
              <Text style={[styles.metadataText, { color: theme.textSecondary }]}>
                {lesson.createdBy}
              </Text>
            </View>
          </View>
        </View>

        {/* Learning Objectives */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            <Ionicons name="flag-outline" size={18} color={theme.primary} /> Learning Objectives
          </Text>
          {lesson.objectives.map((objective, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={[styles.bullet, { color: theme.accent }]}>•</Text>
              <Text style={[styles.listItemText, { color: theme.text }]}>
                {objective}
              </Text>
            </View>
          ))}
        </View>

        {/* Activities */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            <Ionicons name="play-outline" size={18} color={theme.primary} /> Activities
          </Text>
          {lesson.activities.map((activity, index) => (
            <View key={index} style={[styles.activityCard, { borderLeftColor: theme.accent }]}>
              <View style={styles.activityHeader}>
                <Text style={[styles.activityName, { color: theme.text }]}>
                  {activity.name}
                </Text>
                <Text style={[styles.activityDuration, { color: theme.textSecondary }]}>
                  {activity.duration}
                </Text>
              </View>
              <Text style={[styles.activityDescription, { color: theme.textSecondary }]}>
                {activity.description}
              </Text>
              {activity.materials && activity.materials.length > 0 && (
                <View style={styles.materialsContainer}>
                  <Text style={[styles.materialsTitle, { color: theme.accent }]}>Materials:</Text>
                  <Text style={[styles.materialsText, { color: theme.textSecondary }]}>
                    {activity.materials.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Resources */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            <Ionicons name="library-outline" size={18} color={theme.primary} /> Resources
          </Text>
          {lesson.resources.map((resource, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={[styles.bullet, { color: theme.accent }]}>•</Text>
              <Text style={[styles.listItemText, { color: theme.text }]}>
                {resource}
              </Text>
            </View>
          ))}
        </View>

        {/* Assessment */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={theme.primary} /> Assessment
          </Text>
          {lesson.assessments.map((assessment, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={[styles.bullet, { color: theme.accent }]}>•</Text>
              <Text style={[styles.listItemText, { color: theme.text }]}>
                {assessment}
              </Text>
            </View>
          ))}
        </View>

        {/* Differentiation */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            <Ionicons name="people-outline" size={18} color={theme.primary} /> Differentiation
          </Text>
          <Text style={[styles.differentiationText, { color: theme.text }]}>
            {lesson.differentiation}
          </Text>
        </View>

        {/* Extensions */}
        {lesson.extensions && lesson.extensions.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              <Ionicons name="trending-up-outline" size={18} color={theme.primary} /> Extensions
            </Text>
            {lesson.extensions.map((extension, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={[styles.bullet, { color: theme.accent }]}>•</Text>
                <Text style={[styles.listItemText, { color: theme.text }]}>
                  {extension}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingTop: 48,
  },
  backIconButton: {
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 8,
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  pdfButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  lessonTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    lineHeight: 32,
  },
  metadataRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadataText: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  activityCard: {
    padding: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  activityDuration: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  activityDescription: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 8,
  },
  materialsContainer: {
    marginTop: 4,
  },
  materialsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  materialsText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  differentiationText: {
    fontSize: 16,
    lineHeight: 22,
  },
  bottomSpacing: {
    height: 32,
  },
});