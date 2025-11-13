/**
 * Lessons Search Screen (Stub)
 * 
 * Placeholder screen to prevent routing errors.
 * This will be built out later with full search and filtering capabilities.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { router, useLocalSearchParams } from 'expo-router';

export default function LessonsSearchScreen() {
  const { theme } = useTheme();
  const { query, featured, sort } = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState((query as string) || '');

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
          Search Lessons
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: theme.inputBackground,
                borderColor: theme.inputBorder,
              },
            ]}
          >
            <Ionicons name="search" size={20} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.inputText }]}
              placeholder="Search lessons, topics, or skills..."
              placeholderTextColor={theme.inputPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Parameters Info (for debugging/development) */}
        {(query || featured || sort) && (
          <View style={styles.paramsContainer}>
            <Text style={[styles.paramsTitle, { color: theme.textSecondary }]}>
              Search Parameters:
            </Text>
            {query && (
              <Text style={[styles.paramItem, { color: theme.textSecondary }]}>
                Query: {query}
              </Text>
            )}
            {featured && (
              <Text style={[styles.paramItem, { color: theme.textSecondary }]}>
                Featured: {featured}
              </Text>
            )}
            {sort && (
              <Text style={[styles.paramItem, { color: theme.textSecondary }]}>
                Sort: {sort}
              </Text>
            )}
          </View>
        )}

        {/* Coming Soon Content */}
        <View style={styles.comingSoonContainer}>
          <Ionicons name="search-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.comingSoonTitle, { color: theme.text }]}>
            Coming Soon
          </Text>
          <Text style={[styles.comingSoonDescription, { color: theme.textSecondary }]}>
            Advanced lesson search and filtering capabilities are currently under development. 
            For now, you can browse lessons from the Lessons Hub.
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
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  paramsContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  paramsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  paramItem: {
    fontSize: 12,
    marginBottom: 4,
  },
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 16,
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