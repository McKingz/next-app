/**
 * Lessons Service
 * 
 * Handles all lesson-related API calls, data fetching, and management
 * for the comprehensive lessons hub system.
 */

import { assertSupabase } from '@/lib/supabase';
import { getCurrentSession } from '@/lib/sessionManager';
import {
  Lesson,
  LessonCategory,
  LessonSkillLevel,
  LessonTag,
  LessonProgress,
  LessonReview,
  LessonPlan,
  LessonSearchFilters,
  LessonSearchResult,
  LessonSortOption,
  LessonAnalytics,
  DEFAULT_LESSON_CATEGORIES,
  DEFAULT_SKILL_LEVELS,
  COMMON_LESSON_TAGS,
} from '@/types/lessons';

/**
 * LessonsService interface for dependency injection
 */
export interface ILessonsService {
  getCategories(): Promise<LessonCategory[]>;
  getSkillLevels(): Promise<LessonSkillLevel[]>;
  getTags(): Promise<LessonTag[]>;
  searchLessons(query?: string, filters?: LessonSearchFilters, sortBy?: LessonSortOption, page?: number, pageSize?: number): Promise<LessonSearchResult>;
  getLessonById(lessonId: string): Promise<Lesson | null>;
  dispose(): void;
}

export class LessonsService implements ILessonsService {
  private supabase = assertSupabase();

  /**
   * Get all lesson categories
   */
  async getCategories(): Promise<LessonCategory[]> {
    try {
      const { data, error } = await this.supabase
        .from('lesson_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        // Return default categories as fallback
        return DEFAULT_LESSON_CATEGORIES;
      }

      return data || DEFAULT_LESSON_CATEGORIES;
    } catch (error) {
      console.error('Error in getCategories:', error);
      return DEFAULT_LESSON_CATEGORIES;
    }
  }

  /**
   * Get all skill levels
   */
  async getSkillLevels(): Promise<LessonSkillLevel[]> {
    // lesson_skill_levels table doesn't exist - using defaults
    console.log('[LessonsService] Using default skill levels - lesson_skill_levels table not found');
    return DEFAULT_SKILL_LEVELS;
  }

  /**
   * Get all lesson tags
   */
  async getTags(): Promise<LessonTag[]> {
    try {
      const { data, error } = await this.supabase
        .from('lesson_tags')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching tags:', error);
        return COMMON_LESSON_TAGS;
      }

      return data || COMMON_LESSON_TAGS;
    } catch (error) {
      console.error('Error in getTags:', error);
      return COMMON_LESSON_TAGS;
    }
  }

  /**
   * Search lessons with filters and pagination
   * Updated for preschool database schema
   */
  async searchLessons(
    query: string = '',
    filters: LessonSearchFilters = {},
    sortBy: LessonSortOption = 'newest',
    page: number = 1,
    pageSize: number = 20
  ): Promise<LessonSearchResult> {
    try {
      console.log('[LessonsService] Searching lessons with query:', query);
      
      let queryBuilder = this.supabase
        .from('lessons')
        .select('*')
        .neq('status', 'draft'); // Show active and archived lessons

      // Apply text search on available fields
      if (query.trim()) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      }

      // Apply filters based on actual schema
      if (filters.category_ids?.length) {
        // Map category IDs to subjects
        const subjects = this.mapCategoryIdsToSubjects(filters.category_ids);
        if (subjects.length > 0) {
          queryBuilder = queryBuilder.in('subject', subjects);
        }
      }

      // Filter by age group if provided
      if (filters.age_range) {
        // Map age range to preschool age_group values
        const ageGroups = this.mapAgeRangeToAgeGroups(filters.age_range);
        if (ageGroups.length > 0) {
          queryBuilder = queryBuilder.in('age_group', ageGroups);
        }
      }

      // Apply duration filter
      if (filters.duration_range) {
        if (filters.duration_range.min_duration) {
          queryBuilder = queryBuilder.gte('duration_minutes', filters.duration_range.min_duration);
        }
        if (filters.duration_range.max_duration) {
          queryBuilder = queryBuilder.lte('duration_minutes', filters.duration_range.max_duration);
        }
      }

      // Apply sorting based on available fields
      switch (sortBy) {
        case 'newest':
          queryBuilder = queryBuilder.order('created_at', { ascending: false });
          break;
        case 'oldest':
          queryBuilder = queryBuilder.order('created_at', { ascending: true });
          break;
        case 'alphabetical':
          queryBuilder = queryBuilder.order('title', { ascending: true });
          break;
        case 'duration_short':
          queryBuilder = queryBuilder.order('duration_minutes', { ascending: true });
          break;
        case 'duration_long':
          queryBuilder = queryBuilder.order('duration_minutes', { ascending: false });
          break;
        default:
          queryBuilder = queryBuilder.order('created_at', { ascending: false });
          break;
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      queryBuilder = queryBuilder.range(from, to);

      const { data, error, count } = await queryBuilder;

      if (error) {
        console.error('Error searching lessons:', error);
        return this.getEmptySearchResult(page, pageSize);
      }

      console.log(`[LessonsService] Found ${data?.length || 0} lessons`);

      // Transform data to match expected format
      const transformedLessons = (data || []).map(lesson => this.transformDbLessonToLesson(lesson));

      return {
        lessons: transformedLessons,
        total_count: count || 0,
        page,
        page_size: pageSize,
        total_pages: Math.ceil((count || 0) / pageSize),
        facets: await this.getFacets(filters),
      };
    } catch (error) {
      console.error('Error in searchLessons:', error);
      return this.getEmptySearchResult(page, pageSize);
    }
  }

  /**
   * Get lesson by ID with full details
   */
  async getLessonById(lessonId: string): Promise<Lesson | null> {
    try {
      console.log('[LessonsService] Fetching lesson by ID:', lessonId);
      
      const { data, error } = await this.supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (error) {
        console.error('Error fetching lesson:', error);
        return null;
      }

      if (!data) {
        console.log('[LessonsService] No lesson found with ID:', lessonId);
        return null;
      }

      console.log('[LessonsService] Found lesson:', data.title);
      return this.transformDbLessonToLesson(data);
    } catch (error) {
      console.error('Error in getLessonById:', error);
      return null;
    }
  }

  /**
   * Get featured lessons (active lessons from preschool schema)
   */
  async getFeaturedLessons(limit: number = 10): Promise<Lesson[]> {
    try {
      console.log('[LessonsService] Fetching featured lessons...');
      
      const { data, error } = await this.supabase
        .from('lessons')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching featured lessons:', error);
        return [];
      }

      console.log(`[LessonsService] Found ${data?.length || 0} featured lessons`);
      return (data || []).map(lesson => this.transformDbLessonToLesson(lesson));
    } catch (error) {
      console.error('Error in getFeaturedLessons:', error);
      return [];
    }
  }

  /**
   * Get popular lessons (recent active lessons)
   */
  async getPopularLessons(limit: number = 10): Promise<Lesson[]> {
    try {
      console.log('[LessonsService] Fetching popular lessons...');
      
      const { data, error } = await this.supabase
        .from('lessons')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching popular lessons:', error);
        return [];
      }

      console.log(`[LessonsService] Found ${data?.length || 0} popular lessons`);
      return (data || []).map(lesson => this.transformDbLessonToLesson(lesson));
    } catch (error) {
      console.error('Error in getPopularLessons:', error);
      return [];
    }
  }

  /**
   * Get lessons by category
   */
  async getLessonsByCategory(categoryId: string, limit: number = 20): Promise<Lesson[]> {
    try {
      console.log(`[LessonsService] Fetching lessons for category: ${categoryId}`);
      
      // Map categoryId to subject for preschool schema
      const subjects = this.mapCategoryIdsToSubjects([categoryId]);
      if (subjects.length === 0) {
        console.log('[LessonsService] No matching subjects found for category');
        return [];
      }

      const { data, error } = await this.supabase
        .from('lessons')
        .select('*')
        .eq('status', 'active')
        .in('subject', subjects)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching lessons by category:', error);
        return [];
      }

      console.log(`[LessonsService] Found ${data?.length || 0} lessons for category`);
      return (data || []).map(lesson => this.transformDbLessonToLesson(lesson));
    } catch (error) {
      console.error('Error in getLessonsByCategory:', error);
      return [];
    }
  }

  /**
   * Get user's lesson progress
   */
  async getUserLessonProgress(lessonId: string): Promise<LessonProgress | null> {
    try {
      const session = await getCurrentSession();
      if (!session) return null;

      const { data, error } = await this.supabase
        .from('lesson_progress')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('user_id', session.user_id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching lesson progress:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserLessonProgress:', error);
      return null;
    }
  }

  /**
   * Update lesson progress
   */
  async updateLessonProgress(
    lessonId: string,
    progress: Partial<LessonProgress>
  ): Promise<LessonProgress | null> {
    try {
      const session = await getCurrentSession();
      if (!session) return null;

      const existingProgress = await this.getUserLessonProgress(lessonId);

      const progressData = {
        lesson_id: lessonId,
        user_id: session.user_id,
        ...progress,
        last_accessed_at: new Date().toISOString(),
      };

      let data, error;
      
      if (existingProgress) {
        ({ data, error } = await this.supabase
          .from('lesson_progress')
          .update(progressData)
          .eq('id', existingProgress.id)
          .select()
          .single());
      } else {
        progressData.started_at = new Date().toISOString();
        ({ data, error } = await this.supabase
          .from('lesson_progress')
          .insert(progressData)
          .select()
          .single());
      }

      if (error) {
        console.error('Error updating lesson progress:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateLessonProgress:', error);
      return null;
    }
  }

  /**
   * Get lesson reviews
   */
  async getLessonReviews(
    lessonId: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ reviews: LessonReview[]; total_count: number }> {
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await this.supabase
        .from('lesson_reviews')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching lesson reviews:', error);
        return { reviews: [], total_count: 0 };
      }

      return {
        reviews: data || [],
        total_count: count || 0,
      };
    } catch (error) {
      console.error('Error in getLessonReviews:', error);
      return { reviews: [], total_count: 0 };
    }
  }

  /**
   * Add lesson review
   */
  async addLessonReview(
    lessonId: string,
    rating: number,
    reviewText: string
  ): Promise<LessonReview | null> {
    try {
      const session = await getCurrentSession();
      if (!session) return null;

      const reviewData = {
        lesson_id: lessonId,
        user_id: session.user_id,
        rating,
        review_text: reviewText,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('lesson_reviews')
        .insert(reviewData)
        .select()
        .single();

      if (error) {
        console.error('Error adding lesson review:', error);
        return null;
      }

      // Update lesson rating
      await this.updateLessonRating(lessonId);

      return data;
    } catch (error) {
      console.error('Error in addLessonReview:', error);
      return null;
    }
  }

  /**
   * Bookmark/unbookmark lesson
   */
  async toggleLessonBookmark(lessonId: string): Promise<boolean> {
    try {
      const session = await getCurrentSession();
      if (!session) return false;

      const existingProgress = await this.getUserLessonProgress(lessonId);
      const isBookmarked = !!existingProgress?.bookmarked_at;

      await this.updateLessonProgress(lessonId, {
        bookmarked_at: isBookmarked ? undefined : new Date().toISOString(),
      });

      return !isBookmarked;
    } catch (error) {
      console.error('Error in toggleLessonBookmark:', error);
      return false;
    }
  }

  /**
   * Get user's bookmarked lessons
   */
  async getUserBookmarkedLessons(): Promise<Lesson[]> {
    try {
      const session = await getCurrentSession();
      if (!session) return [];

      const { data, error } = await this.supabase
        .from('lesson_progress')
        .select(`
          lesson:lessons(*)
        `)
        .eq('user_id', session.user_id)
        .not('bookmarked_at', 'is', null)
        .order('bookmarked_at', { ascending: false });

      if (error) {
        console.error('Error fetching bookmarked lessons:', error);
        return [];
      }

      const lessons: Lesson[] = [];
      (data || []).forEach((item: any) => {
        if (item.lesson) {
          const transformedLesson = this.transformDbLessonToLesson(item.lesson);
          lessons.push(transformedLesson);
        }
      });
      return lessons;
    } catch (error) {
      console.error('Error in getUserBookmarkedLessons:', error);
      return [];
    }
  }

  /**
   * Get user's lesson progress history
   */
  async getUserLessonHistory(): Promise<Lesson[]> {
    try {
      const session = await getCurrentSession();
      if (!session) return [];

      const { data, error } = await this.supabase
        .from('lesson_progress')
        .select(`
          lesson:lessons(*),
          progress_percentage,
          status,
          last_accessed_at
        `)
        .eq('user_id', session.user_id)
        .order('last_accessed_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching lesson history:', error);
        return [];
      }

      const lessons: Lesson[] = [];
      (data || []).forEach((item: any) => {
        if (item.lesson) {
          const transformedLesson = this.transformDbLessonToLesson(item.lesson);
          const lessonWithProgress = {
            ...transformedLesson,
            user_progress: {
              progress_percentage: item.progress_percentage,
              status: item.status,
              last_accessed_at: item.last_accessed_at,
            },
          };
          lessons.push(lessonWithProgress);
        }
      });
      return lessons;
    } catch (error) {
      console.error('Error in getUserLessonHistory:', error);
      return [];
    }
  }

  /**
   * Get teacher's lessons (from preschool schema)
   * Modified to show AI-generated lessons from the current preschool
   */
  async getTeacherGeneratedLessons(): Promise<Lesson[]> {
    try {
      console.log('[LessonsService] Fetching teacher generated lessons...');
      const session = await getCurrentSession();
      if (!session) {
        console.log('[LessonsService] No session found');
        return [];
      }

      // First try to get lessons created by the current teacher
      let query = this.supabase
        .from('lessons')
        .select('*')
        .eq('is_ai_generated', true)
        .order('created_at', { ascending: false })
        .limit(50);

      // Try filtering by teacher_id first
      const { data: userLessons, error: userError } = await query
        .eq('teacher_id', session.user_id);

      // If no lessons found for current teacher, get all AI-generated lessons
      if ((!userLessons || userLessons.length === 0) && !userError) {
        console.log('[LessonsService] No lessons for current teacher, fetching all AI-generated lessons');
        const { data: allAILessons, error: allError } = await this.supabase
          .from('lessons')
          .select('*')
          .eq('is_ai_generated', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (allError) {
          console.error('Error fetching AI lessons:', allError);
          return [];
        }

        console.log(`[LessonsService] Found ${allAILessons?.length || 0} AI-generated lessons`);
        return (allAILessons || []).map(lesson => this.transformDbLessonToLesson(lesson));
      }

      if (userError) {
        console.error('Error fetching user lessons:', userError);
        return [];
      }

      console.log(`[LessonsService] Found ${userLessons?.length || 0} teacher lessons`);
      return (userLessons || []).map(lesson => this.transformDbLessonToLesson(lesson));
    } catch (error) {
      console.error('Error in getTeacherGeneratedLessons:', error);
      return [];
    }
  }

  /**
   * Get lesson analytics (for educators)
   */
  async getLessonAnalytics(lessonId: string): Promise<LessonAnalytics | null> {
    try {
      // This would typically be a database function or complex query
      // For now, return mock analytics
      return {
        lesson_id: lessonId,
        total_views: 0,
        total_starts: 0,
        total_completions: 0,
        completion_rate: 0,
        average_rating: 0,
        average_duration: 0,
        popular_exit_points: [],
        common_difficulties: [],
      };
    } catch (error) {
      console.error('Error in getLessonAnalytics:', error);
      return null;
    }
  }

  // Private helper methods

  /**
   * Transform database lesson to UI lesson format
   */
  private transformDbLessonToLesson(dbLesson: any): Lesson {
    const category = this.getSubjectCategory(dbLesson.subject);
    const skillLevel = DEFAULT_SKILL_LEVELS[0] || { id: 'beginner', name: 'Beginner', level: 1, description: 'Beginner level', order: 1, color: '#4CAF50' };
    
    return {
      id: dbLesson.id,
      title: dbLesson.title,
      description: dbLesson.description || 'No description provided',
      short_description: dbLesson.description?.substring(0, 100) + '...' || 'Preschool lesson',
      category: category,
      category_id: category.id,
      estimated_duration: dbLesson.duration_minutes || 30,
      difficulty_rating: this.mapAgeGroupToDifficulty(dbLesson.age_group),
      age_range: this.parseAgeGroup(dbLesson.age_group),
      language: 'en',
      is_featured: dbLesson.status === 'active',
      is_premium: false,
      status: dbLesson.status === 'active' ? 'published' : 'draft',
      created_at: dbLesson.created_at,
      updated_at: dbLesson.updated_at,
      rating: 4.5, // Default rating
      completion_count: 0,
      tags: [dbLesson.subject],
      skill_level: skillLevel,
      skill_level_id: skillLevel.id,
      prerequisites: [],
      author_id: dbLesson.teacher_id || 'system',
      author_name: 'Teacher',
      organization_id: dbLesson.preschool_id || null,
      version: '1.0',
      review_count: 0,
      bookmark_count: 0,
      visibility: 'public',
      thumbnail_url: undefined,
      learning_objectives: dbLesson.objectives || [],
      steps: [],
      resources: [],
      assessments: []
    };
  }

  /**
   * Map category IDs to database subjects
   */
  private mapCategoryIdsToSubjects(categoryIds: string[]): string[] {
    const categoryMap: Record<string, string> = {
      'stem': 'science',
      'math': 'mathematics', 
      'science': 'science',
      'literacy': 'literacy',
      'art': 'art',
      'music': 'music',
      'physical': 'physical',
    };
    
    return categoryIds.map(id => categoryMap[id] || 'general').filter(Boolean);
  }

  /**
   * Map age range to preschool age groups
   */
  private mapAgeRangeToAgeGroups(ageRange: { min_age?: number; max_age?: number }): string[] {
    const groups: string[] = [];
    if (ageRange.min_age && ageRange.min_age <= 4) groups.push('3-4');
    if (ageRange.max_age && ageRange.max_age >= 4) groups.push('4-5');
    if (ageRange.max_age && ageRange.max_age >= 5) groups.push('5-6');
    if (groups.length === 0) groups.push('3-6');
    return groups;
  }

  /**
   * Get category from subject
   */
  private getSubjectCategory(subject: string) {
    const subjectCategoryMap: Record<string, any> = {
      'mathematics': { id: 'math', name: 'Mathematics', icon: 'calculator' },
      'science': { id: 'science', name: 'Science', icon: 'flask' },
      'literacy': { id: 'literacy', name: 'Literacy', icon: 'book' },
      'art': { id: 'art', name: 'Art & Creativity', icon: 'color-palette' },
      'music': { id: 'music', name: 'Music', icon: 'musical-notes' },
      'physical': { id: 'physical', name: 'Physical', icon: 'fitness' },
      'general': { id: 'general', name: 'General', icon: 'school' },
    };
    
    return subjectCategoryMap[subject] || subjectCategoryMap['general'];
  }

  /**
   * Parse age group to age range
   */
  private parseAgeGroup(ageGroup: string): { min_age: number; max_age: number } {
    switch (ageGroup) {
      case '3-4': return { min_age: 3, max_age: 4 };
      case '4-5': return { min_age: 4, max_age: 5 };
      case '5-6': return { min_age: 5, max_age: 6 };
      case '3-6':
      default: return { min_age: 3, max_age: 6 };
    }
  }

  /**
   * Map age group to difficulty rating
   */
  private mapAgeGroupToDifficulty(ageGroup: string): number {
    switch (ageGroup) {
      case '3-4': return 1;
      case '4-5': return 2;
      case '5-6': return 3;
      case '3-6':
      default: return 2;
    }
  }

  /**
   * Get simple facets for filtering UI with proper count structure
   */
  private getSimpleFacets() {
    return {
      categories: DEFAULT_LESSON_CATEGORIES.map(cat => ({
        id: cat.id,
        name: cat.name,
        count: 0 // Will be populated by actual search if needed
      })),
      skill_levels: DEFAULT_SKILL_LEVELS.map(level => ({
        id: level.id,
        name: level.name,
        count: 0
      })),
      tags: COMMON_LESSON_TAGS.map(tag => ({
        id: tag.id,
        name: tag.name,
        count: 0
      })),
      age_ranges: [
        { range: '3-4 years', count: 0 },
        { range: '4-5 years', count: 0 },
        { range: '5-6 years', count: 0 },
        { range: '3-6 years', count: 0 },
      ],
      durations: [
        { range: '15-30 minutes', count: 0 },
        { range: '30-45 minutes', count: 0 },
        { range: '45-60 minutes', count: 0 },
      ],
      difficulties: [
        { level: 1, count: 0 },
        { level: 2, count: 0 },
        { level: 3, count: 0 },
      ],
    };
  }

  private async getFacets(filters: LessonSearchFilters) {
    try {
      // For now, return simple facets with zero counts
      // In a full implementation, this would query the database for actual counts
      return this.getSimpleFacets();
    } catch (error) {
      console.error('Error getting facets:', error);
      return this.getSimpleFacets();
    }
  }

  private getEmptySearchResult(page: number, pageSize: number): LessonSearchResult {
    return {
      lessons: [],
      total_count: 0,
      page,
      page_size: pageSize,
      total_pages: 0,
      facets: this.getSimpleFacets(),
    };
  }

  private async updateLessonRating(lessonId: string): Promise<void> {
    try {
      // This would typically be a database function to recalculate the average rating
      // For now, just log the operation
      console.log('Updating lesson rating for lesson:', lessonId);
    } catch (error) {
      console.error('Error updating lesson rating:', error);
    }
  }

  /**
   * Dispose method for cleanup
   */
  dispose(): void {
    // Cleanup if needed (e.g., cancel pending requests)
  }
}

// Backward compatibility: Export singleton instance
// TODO: Remove once all call sites migrated to DI
import { container, TOKENS } from '../lib/di/providers/default';
const LessonsServiceInstance = (() => {
  try {
    return container.resolve(TOKENS.lessons);
  } catch {
    // Fallback during initialization
    return new LessonsService();
  }
})();

export default LessonsServiceInstance;
