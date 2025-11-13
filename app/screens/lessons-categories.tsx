/**
 * Lessons Categories Screen (Stub)
 * 
 * Placeholder screen to prevent routing errors.
 * This will be built out later with full category browsing functionality.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';

export default function LessonsCategoriesScreen() {
  const { theme } = useTheme();

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
          All Categories
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Coming Soon Content */}
        <View style={styles.comingSoonContainer}>
          <Ionicons name="construct-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.comingSoonTitle, { color: theme.text }]}>
            Coming Soon
          </Text>
          <Text style={[styles.comingSoonDescription, { color: theme.textSecondary }]}>
            The full categories browser is currently under development. 
            For now, you can explore categories from the Lessons Hub.
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
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  comingSoonTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  comingSoonDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  backToHubButton: {
    flexDirection: 'row',
    alignItems: 'center',
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