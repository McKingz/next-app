/**
 * Lessons Hub Component
 * 
 * Main hub for browsing, searching, and discovering lessons across
 * Robotics, AI, STEM, and Coding categories with modern UI/UX.
 */

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import LessonsService from '@/services/LessonsService';
import {
  Lesson,
  LessonCategory,
  DEFAULT_LESSON_CATEGORIES,
} from '@/types/lessons';
import LessonCard from './LessonCard';
import CategoryCard from './CategoryCard';
import { useFocusEffect } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');

interface LessonsHubProps {
  onLessonSelect?: (lesson: Lesson) => void;
  onCategorySelect?: (category: LessonCategory) => void;
}

export const LessonsHub = forwardRef<{ handleRefresh: () => void }, LessonsHubProps>((
  { onLessonSelect, onCategorySelect },
  ref
) => {
  const { theme, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<LessonCategory[]>(DEFAULT_LESSON_CATEGORIES);
  const [featuredLessons, setFeaturedLessons] = useState<Lesson[]>([]);
  const [popularLessons, setPopularLessons] = useState<Lesson[]>([]);
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([]);
  const [myGeneratedLessons, setMyGeneratedLessons] = useState<Lesson[]>([]);
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const lessonsService = LessonsService;

  // Define loadData function first to avoid reference before declaration
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[LessonsHub] Starting to load data...');

      const [
        categoriesData,
        featuredData,
        popularData,
        recentData,
        myGeneratedData,
      ] = await Promise.all([
        lessonsService.getCategories(),
        lessonsService.getFeaturedLessons(6),
        lessonsService.getPopularLessons(8),
        lessonsService.searchLessons('', {}, 'newest', 1, 8),
        lessonsService.getTeacherGeneratedLessons(),
      ]);

      console.log('[LessonsHub] Data loaded:', {
        categories: categoriesData?.length || 0,
        featured: featuredData?.length || 0,
        popular: popularData?.length || 0,
        recent: recentData?.lessons?.length || 0,
        myGenerated: myGeneratedData?.length || 0,
      });
      
      // Additional debugging
      if (featuredData?.length > 0) {
        console.log('[LessonsHub] First featured lesson:', featuredData[0]?.title);
      }
      if (myGeneratedData?.length > 0) {
        console.log('[LessonsHub] First generated lesson:', myGeneratedData[0]?.title);
      }

      setCategories(categoriesData);
      setFeaturedLessons(featuredData);
      setPopularLessons(popularData);
      setRecentLessons(recentData.lessons);
      setMyGeneratedLessons(myGeneratedData);
    } catch (error) {
      console.error('Error loading lessons hub data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lessonsService]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Expose handleRefresh method through ref
  useImperativeHandle(ref, () => ({
    handleRefresh,
  }));

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push({
        pathname: '/screens/lessons-search',
        params: { query: searchQuery.trim() },
      });
    }
  };

  const handleLessonPress = (lesson: Lesson) => {
    if (onLessonSelect) {
      onLessonSelect(lesson);
    } else {
      router.push({
        pathname: '/screens/lesson-detail',
        params: { lessonId: lesson.id },
      });
    }
  };

  const handleCategoryPress = (category: LessonCategory) => {
    if (onCategorySelect) {
      onCategorySelect(category);
    } else {
      router.push({
        pathname: '/screens/lessons-category',
        params: { categoryId: category.id, categoryName: category.name },
      });
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.headerContent}>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Access your saved AI-generated lessons and discover new content
        </Text>
      </View>
    </View>
  );

  const renderSearchBar = () => (
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
          onSubmitEditing={handleSearch}
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
      
      <TouchableOpacity
        style={[styles.filterButton, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/screens/lessons-search')}
      >
        <Ionicons name="options-outline" size={20} color={theme.onPrimary} />
      </TouchableOpacity>
    </View>
  );

  const renderCategories = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          onPress={() => router.push('/screens/lessons-categories')}
          accessibilityRole="link"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.sectionTitlePressable}
        >
          <Text style={[styles.sectionTitle, styles.clickableTitle, { color: theme.primary }]}> 
            Explore Categories
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} style={styles.sectionTitleChevron} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/screens/lessons-categories')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.sectionAction, { color: theme.primary }]}> 
            View All
          </Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onPress={() => handleCategoryPress(category)}
          />
        ))}
      </ScrollView>
    </View>
  );

  const renderFeaturedLessons = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/screens/lessons-search', params: { featured: 'true' } })}
          accessibilityRole="link"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.sectionTitlePressable}
        >
          <Text style={[styles.sectionTitle, styles.clickableTitle, { color: theme.primary }]}> 
            Featured Lessons
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} style={styles.sectionTitleChevron} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/screens/lessons-search',
            params: { featured: 'true' },
          })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.sectionAction, { color: theme.primary }]}> 
            View All
          </Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.lessonsContainer}
      >
        {featuredLessons.map((lesson, index) => (
          <LessonCard
            key={lesson.id || `featured-${index}`}
            lesson={lesson}
            onPress={() => handleLessonPress(lesson)}
            variant="featured"
          />
        ))}
      </ScrollView>
    </View>
  );

  const renderPopularLessons = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/screens/lessons-search', params: { sort: 'most_popular' } })}
          accessibilityRole="link"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.sectionTitlePressable}
        >
          <Text style={[styles.sectionTitle, styles.clickableTitle, { color: theme.primary }]}> 
            Popular This Week
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} style={styles.sectionTitleChevron} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/screens/lessons-search',
            params: { sort: 'most_popular' },
          })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.sectionAction, { color: theme.primary }]}> 
            View All
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.popularGrid}>
        {popularLessons.slice(0, 4).map((lesson, index) => (
          <LessonCard
            key={lesson.id || `popular-${index}`}
            lesson={lesson}
            onPress={() => handleLessonPress(lesson)}
            variant="compact"
            style={[
              styles.gridItem,
              index % 2 === 0 ? styles.gridItemLeft : styles.gridItemRight,
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderMyGeneratedLessons = () => {
    console.log('[LessonsHub] myGeneratedLessons:', myGeneratedLessons.length, 'featuredLessons:', featuredLessons.length);
    
    // Show available lessons prioritizing: myGenerated -> featured -> recent -> popular
    let displayLessons = myGeneratedLessons;
    let sectionLabel = "My AI-Generated Lessons";
    
    if (displayLessons.length === 0) {
      displayLessons = featuredLessons;
      console.log('[LessonsHub] Using featured lessons as fallback');
    }
    
    if (displayLessons.length === 0) {
      displayLessons = recentLessons;
      console.log('[LessonsHub] Using recent lessons as fallback');
    }
    
    if (displayLessons.length === 0) {
      displayLessons = popularLessons;
      console.log('[LessonsHub] Using popular lessons as fallback');
    }
    
    console.log('[LessonsHub] Final displayLessons count:', displayLessons.length);
    
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TouchableOpacity
            onPress={() => router.push('/screens/my-lessons')}
            accessibilityRole="link"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.sectionTitlePressable}
          >
            <Text style={[styles.sectionTitle, styles.clickableTitle, { color: theme.primary }]}>
              {sectionLabel}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.primary} style={styles.sectionTitleChevron} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/screens/ai-lesson-generator')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.sectionAction, { color: theme.primary }]}> 
              Generate New
            </Text>
          </TouchableOpacity>
        </View>
        {displayLessons.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.lessonsContainer}
          >
            {displayLessons.slice(0, 8).map((lesson, index) => (
              <LessonCard
                key={lesson.id || `display-${index}`}
                lesson={lesson}
                onPress={() => handleLessonPress(lesson)}
                variant="featured"
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptySection}>
            <Ionicons name="sparkles-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Lessons Available</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Create your first AI-powered lesson with our lesson generator
            </Text>
            <TouchableOpacity
              style={[styles.emptyAction, { backgroundColor: theme.primary }]}
              onPress={() => router.push('/screens/ai-lesson-generator')}
            >
              <Ionicons name="sparkles" size={20} color={theme.onPrimary} />
              <Text style={[styles.emptyActionText, { color: theme.onPrimary }]}>
                Generate Lesson
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderRecentLessons = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/screens/lessons-search', params: { sort: 'newest' } })}
          accessibilityRole="link"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.sectionTitlePressable}
        >
          <Text style={[styles.sectionTitle, styles.clickableTitle, { color: theme.primary }]}> 
            Recently Added
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} style={styles.sectionTitleChevron} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/screens/lessons-search',
            params: { sort: 'newest' },
          })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.sectionAction, { color: theme.primary }]}> 
            View All
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.recentList}>
        {recentLessons.slice(0, 6).map((lesson, index) => (
          <LessonCard
            key={lesson.id || `recent-${index}`}
            lesson={lesson}
            onPress={() => handleLessonPress(lesson)}
            variant="list"
            style={index < recentLessons.length - 1 ? styles.listItem : undefined}
          />
        ))}
      </View>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          onPress={() => router.push('/screens/ai-lesson-generator')}
          accessibilityRole="link"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.sectionTitlePressable}
        >
          <Text style={[styles.sectionTitle, styles.clickableTitle, { color: theme.primary }]}> 
            Quick Actions
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} style={styles.sectionTitleChevron} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={[styles.quickAction, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30', borderWidth: 1 }]}
          onPress={() => router.push('/screens/ai-lesson-generator')}
        >
          <Ionicons name="sparkles" size={24} color={theme.primary} />
          <Text style={[styles.quickActionText, { color: theme.primary }]}>
            Generate New Lesson
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.quickAction, { backgroundColor: theme.success + '15', borderColor: theme.success + '30', borderWidth: 1 }]}
          onPress={() => router.push('/screens/my-lessons')}
        >
          <Ionicons name="library" size={24} color={theme.success} />
          <Text style={[styles.quickActionText, { color: theme.success }]}>
            My Saved Lessons
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.quickAction, { backgroundColor: theme.accent + '15', borderColor: theme.accent + '30', borderWidth: 1 }]}
          onPress={() => router.push('/screens/lesson-plans')}
        >
          <Ionicons name="list-outline" size={24} color={theme.accent} />
          <Text style={[styles.quickActionText, { color: theme.accent }]}>
            Lesson Plans
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.quickAction, { backgroundColor: theme.warning + '15', borderColor: theme.warning + '30', borderWidth: 1 }]}
          onPress={() => router.push('/screens/bookmarked-lessons')}
        >
          <Ionicons name="bookmark-outline" size={24} color={theme.warning} />
          <Text style={[styles.quickActionText, { color: theme.warning }]}>
            Bookmarked
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {renderHeader()}
        {renderSearchBar()}
        {renderCategories()}
        {renderFeaturedLessons()}
        {renderPopularLessons()}
        {renderMyGeneratedLessons()}
        {renderRecentLessons()}
        {renderQuickActions()}
        
        {/* Bottom spacing for better scrolling */}
        <View style={{ height: 100 }} />
      </ScrollView>
    );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: screenWidth < 380 ? 20 : 22,
    fontWeight: '600',
  },
  sectionTitlePressable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitleChevron: {
    marginLeft: 6,
  },
  clickableTitle: {
    textDecorationLine: 'underline',
  },
  sectionAction: {
    fontSize: 16,
    fontWeight: '500',
  },
  categoriesContainer: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  lessonsContainer: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginHorizontal: -4,
  },
  gridItem: {
    width: (screenWidth - 40) / 2,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  gridItemLeft: {
    marginRight: 4,
  },
  gridItemRight: {
    marginLeft: 4,
  },
  recentList: {
    paddingHorizontal: 16,
  },
  listItem: {
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginHorizontal: -6,
  },
  quickAction: {
    width: (screenWidth - 44) / 2,
    marginHorizontal: 6,
    marginBottom: 12,
    padding: screenWidth < 380 ? 16 : 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: screenWidth < 380 ? 12 : 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: screenWidth < 380 ? 30 : 40,
    paddingHorizontal: screenWidth < 380 ? 16 : 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  emptyActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LessonsHub;