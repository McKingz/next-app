/**
 * Quick Worksheet Test Screen
 * 
 * Simple screen to test PDF generation functionality
 * Access: http://localhost:8084/test-worksheet
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { EducationalPDFService } from '../lib/services/EducationalPDFService';

export default function TestWorksheetScreen() {
  const [isGenerating, setIsGenerating] = useState(false);

  const testMathWorksheet = async () => {
    setIsGenerating(true);
    try {
      const mathData = {
        type: 'addition' as const,
        problemCount: 10,
        numberRange: { min: 1, max: 20 },
        showHints: true,
        includeImages: false,
      };

      const options = {
        title: 'Test Math Worksheet',
        studentName: 'Test Student',
        difficulty: 'easy' as const,
        ageGroup: '5-6' as const,
        colorMode: 'color' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
        includeAnswerKey: true,
      };

      await EducationalPDFService.generateMathWorksheet(mathData, options);
      Alert.alert('Success!', 'Math worksheet PDF generated and ready to share!');
    } catch (error) {
      console.error('Test failed:', error);
      Alert.alert('Error', `Failed to generate worksheet: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const testReadingWorksheet = async () => {
    setIsGenerating(true);
    try {
      const readingData = {
        type: 'comprehension' as const,
        content: 'The little cat sat on the soft mat. It was a bright sunny day and the cat felt very happy. The cat played with a colorful ball of yarn and then took a nice long nap in the warm sunshine.',
        questions: [
          {
            question: 'Where did the cat sit?',
            type: 'short-answer' as const,
            correctAnswer: 'On the mat'
          },
          {
            question: 'What kind of day was it?',
            type: 'multiple-choice' as const,
            options: ['Rainy', 'Sunny', 'Cloudy', 'Snowy'],
            correctAnswer: 'Sunny'
          }
        ]
      };

      const options = {
        title: 'Reading Comprehension Test',
        studentName: 'Test Student',
        difficulty: 'easy' as const,
        ageGroup: '5-6' as const,
        colorMode: 'color' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
        includeAnswerKey: true,
      };

      await EducationalPDFService.generateReadingWorksheet(readingData, options);
      Alert.alert('Success!', 'Reading worksheet PDF generated and ready to share!');
    } catch (error) {
      console.error('Test failed:', error);
      Alert.alert('Error', `Failed to generate worksheet: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const testActivitySheet = async () => {
    setIsGenerating(true);
    try {
      const activityData = {
        type: 'coloring' as const,
        theme: 'Farm Animals',
        instructions: 'Color the farm animals using your favorite colors. Try to stay inside the lines and have fun!',
        materials: ['Crayons or colored pencils', 'Eraser (optional)', 'Paper']
      };

      const options = {
        title: 'Farm Animals Coloring Activity',
        studentName: 'Test Student',
        difficulty: 'easy' as const,
        ageGroup: '4-5' as const,
        colorMode: 'color' as const,
        paperSize: 'A4' as const,
        orientation: 'portrait' as const,
        includeAnswerKey: false,
      };

      await EducationalPDFService.generateActivitySheet(activityData, options);
      Alert.alert('Success!', 'Activity sheet PDF generated and ready to share!');
    } catch (error) {
      console.error('Test failed:', error);
      Alert.alert('Error', `Failed to generate worksheet: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>🧪 Worksheet PDF Test</Text>
        <Text style={styles.subtitle}>Test the educational PDF generation system</Text>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Different Worksheet Types</Text>
          <Text style={styles.description}>
            Tap any button below to generate and test PDF worksheets. The PDFs will be generated and you'll get an option to share or save them.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.testButton, styles.mathButton, isGenerating && styles.disabled]}
            onPress={testMathWorksheet}
            disabled={isGenerating}
          >
            <Text style={styles.buttonEmoji}>🔢</Text>
            <Text style={styles.buttonTitle}>Math Worksheet</Text>
            <Text style={styles.buttonDescription}>Addition problems with hints and answer key</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.readingButton, isGenerating && styles.disabled]}
            onPress={testReadingWorksheet}
            disabled={isGenerating}
          >
            <Text style={styles.buttonEmoji}>📖</Text>
            <Text style={styles.buttonTitle}>Reading Worksheet</Text>
            <Text style={styles.buttonDescription}>Comprehension passage with questions</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.activityButton, isGenerating && styles.disabled]}
            onPress={testActivitySheet}
            disabled={isGenerating}
          >
            <Text style={styles.buttonEmoji}>🎨</Text>
            <Text style={styles.buttonTitle}>Activity Sheet</Text>
            <Text style={styles.buttonDescription}>Coloring activity with instructions</Text>
          </TouchableOpacity>
        </View>

        {isGenerating && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>🔄 Generating PDF...</Text>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>ℹ️ How it works</Text>
          <Text style={styles.infoText}>
            • Each button generates a different type of educational PDF{'\n'}
            • PDFs are created using HTML templates and converted to PDF{'\n'}
            • You can share, print, or save the generated worksheets{'\n'}
            • All worksheets include proper formatting and styling
          </Text>
        </View>

        <View style={styles.accessInfo}>
          <Text style={styles.accessTitle}>🔗 Other ways to test</Text>
          <Text style={styles.accessText}>
            • Demo screen: /screens/worksheet-demo{'\n'}
            • Assignment integration: Go to "Assign Homework" screen{'\n'}
            • Component library: Import WorksheetGenerator in any screen
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 32,
  },
  testButton: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mathButton: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  readingButton: {
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  activityButton: {
    borderLeftWidth: 4,
    borderLeftColor: '#45B7D1',
  },
  disabled: {
    opacity: 0.6,
  },
  buttonEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  buttonDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  loadingContainer: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#1976D2',
    textAlign: 'center',
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  accessInfo: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#B3D9FF',
  },
  accessTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  accessText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});