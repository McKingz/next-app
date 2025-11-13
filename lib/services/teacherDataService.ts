import { assertSupabase } from '../supabase'

export class TeacherDataService {
  static async assignLesson(
    teacherUserId: string,
    params: {
      lessonId: string
      classId?: string
      studentIds?: string[]
      title: string
      description?: string
      dueDateOffsetDays?: number
      estimatedTimeMinutes?: number
      isRequired?: boolean
      difficultyLevel?: 'easy' | 'medium' | 'hard'
      materialsNeeded?: string[] | string
    }
  ): Promise<{ success: boolean; assignment_id?: string; inserted_submissions?: number; error?: string }> {
    try {
      const { data: teacherProfile, error: teacherError } = await assertSupabase()
        .from('users')
        .select('id, preschool_id')
        .eq('auth_user_id', teacherUserId)
        .maybeSingle()

      if (teacherError || !teacherProfile) {
        return { success: false, error: 'Teacher not found' }
      }

      const title = params.title || 'Lesson Assignment'
      const dueOffset = typeof params.dueDateOffsetDays === 'number' ? params.dueDateOffsetDays : 3
      const difficulty = params.difficultyLevel === 'easy' ? 1 : params.difficultyLevel === 'hard' ? 3 : 2
      const materials = Array.isArray(params.materialsNeeded) ? params.materialsNeeded.join(', ') : (params.materialsNeeded || null)

      const { data: assignment, error: aErr } = await assertSupabase()
        .from('homework_assignments')
        .insert({
          title,
          description: params.description || null,
          instructions: params.description || null,
          teacher_id: teacherProfile.id,
          preschool_id: teacherProfile.preschool_id,
          class_id: params.classId || null,
          due_date_offset_days: dueOffset,
          estimated_time_minutes: params.estimatedTimeMinutes ?? null,
          materials_needed: materials,
          difficulty_level: difficulty,
          is_required: params.isRequired ?? true,
          lesson_id: params.lessonId,
          is_active: true,
        } as any)
        .select('id')
        .single()

      if (aErr || !assignment) {
        return { success: false, error: aErr?.message || 'Failed to create assignment' }
      }

      let targets: string[] = []
      if (params.classId) {
        const { data: classStudents, error: csErr } = await assertSupabase()
          .from('students')
          .select('id')
          .eq('class_id', params.classId)
          .eq('is_active', true)
        if (csErr) return { success: false, error: csErr.message }
        targets = (classStudents || []).map(s => s.id)
      } else if (Array.isArray(params.studentIds) && params.studentIds.length > 0) {
        targets = params.studentIds
      } else {
        return { success: false, error: 'No class or students selected' }
      }

      if (targets.length === 0) {
        return { success: false, error: 'No active students found' }
      }

      const rows = targets.map((sid) => ({
        homework_assignment_id: assignment.id,
        student_id: sid,
        submission_text: null,
        attachment_urls: [],
        submitted_at: null,
        status: 'assigned',
      }))

      const { error: insErr } = await assertSupabase().from('homework_submissions').insert(rows as any)
      if (insErr) {
        return { success: false, error: insErr.message }
      }

      return { success: true, assignment_id: assignment.id, inserted_submissions: rows.length }
    } catch (e: any) {
      return { success: false, error: e?.message || 'Unexpected error' }
    }
  }
}
