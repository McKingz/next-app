import { assertSupabase } from '../supabase'

export class LessonGeneratorService {
  static async saveGeneratedLesson(params: {
    lesson: any
    teacherId: string
    preschoolId: string
    ageGroupId: string
    categoryId: string
    template?: { duration: number; complexity: 'simple' | 'moderate' | 'complex' }
    isPublished?: boolean
  }): Promise<{ success: boolean; lessonId?: string; error?: string }> {
    try {
      const objectivesArray: string[] = Array.isArray(params?.lesson?.assessmentQuestions)
        ? params.lesson.assessmentQuestions
        : []
      const allMaterials: string = Array.isArray(params?.lesson?.activities)
        ? Array.from(new Set(params.lesson.activities.flatMap((a: any) => a?.materials || []))).join(', ')
        : ''

      const difficultyLevel: string | null = params.template?.complexity
        ? (params.template?.complexity === 'simple' ? 'beginner' : params.template?.complexity === 'moderate' ? 'intermediate' : 'advanced')
        : null

      const contentStr = typeof params.lesson?.content === 'string'
        ? params.lesson.content
        : JSON.stringify(params.lesson?.content ?? '')

      const { data: lessonData, error: lessonError } = await assertSupabase()
        .from('lessons')
        .insert({
          title: params.lesson.title,
          description: params.lesson?.description || null,
          content: contentStr,
          category_id: params.categoryId,
          duration_minutes: params.template?.duration || 30,
          objectives: objectivesArray.length ? objectivesArray : null,
          materials_needed: allMaterials || null,
          preschool_id: params.preschoolId,
          teacher_id: params.teacherId,
          is_public: params.isPublished === true,
          is_ai_generated: true,
          difficulty_level: difficultyLevel,
        } as any)
        .select('id')
        .single()

      if (lessonError) throw lessonError

      if (Array.isArray(params?.lesson?.activities) && params.lesson.activities.length > 0) {
        const activities = params.lesson.activities.map((activity: any) => ({
          lesson_id: lessonData.id,
          title: activity.title,
          description: activity.description || null,
          activity_type: 'interactive',
          instructions: activity.instructions || null,
          estimated_duration: Number(activity.estimatedTime || 0) || null,
          materials_needed: Array.isArray(activity.materials) ? activity.materials.join(', ') : (activity.materials || null),
          difficulty_level: null,
          is_active: true,
        }))
        const { error: activitiesError } = await assertSupabase()
          .from('activities')
          .insert(activities as any)
        if (activitiesError) throw activitiesError
      }

      return { success: true, lessonId: lessonData.id }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to save lesson' }
    }
  }
}
