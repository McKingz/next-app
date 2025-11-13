// ClassPlacementService
// Suggest and/or assign classes to students automatically based on grade level and load
// Phase 6: Updated to use organization-first parameters

import { assertSupabase } from '@/lib/supabase';

export interface ClassSuggestion {
  classId: string;
  className?: string;
  gradeLevel?: string | null;
  reason: string;
  candidates: Array<{ id: string; name: string; grade_level?: string | null; student_count: number }>;
}

export class ClassPlacementService {
  /**
   * Suggest a class in the given organization for the provided grade level.
   * Picks the class with the fewest currently assigned students.
   * @param organizationId - Organization/school identifier
   * @param gradeLevel - Target grade level
   */
  static async suggestClassForGrade(organizationId: string, gradeLevel: string): Promise<ClassSuggestion | null> {
    const client = assertSupabase();

    // 1) Fetch classes for this organization/grade
    const { data: classes, error: clsErr } = await client
      .from('classes')
      .select('id, name, grade_level')
      .eq('preschool_id', organizationId) // Database field still named preschool_id
      .eq('is_active', true)
      .eq('grade_level', gradeLevel);

    if (clsErr) {
      console.warn('suggestClassForGrade: classes query failed', clsErr);
    }

    let classList = classes || [];

    // Fallback: If none match grade level, pick any active classes in the organization
    if (!classList.length) {
      const { data: anyClasses } = await client
        .from('classes')
        .select('id, name, grade_level')
        .eq('preschool_id', organizationId) // Database field still named preschool_id
        .eq('is_active', true)
        .limit(10);
      classList = anyClasses || [];
    }

    if (!classList.length) return null;

    // 2) Count students per class (simple loop; acceptable for small N)
    const candidates: Array<{ id: string; name: string; grade_level?: string | null; student_count: number }> = [];
    for (const cls of classList) {
      const { count } = await client
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', cls.id)
        .eq('is_active', true);
      candidates.push({ id: cls.id, name: cls.name, grade_level: (cls as any).grade_level, student_count: count || 0 });
    }

    // 3) Choose the class with the fewest students
    candidates.sort((a, b) => a.student_count - b.student_count);
    const best = candidates[0];

    return {
      classId: best.id,
      className: best.name,
      gradeLevel,
      reason: `Selected least-loaded class for grade ${gradeLevel} (current size ${best.student_count})`,
      candidates,
    };
  }

  /**
   * Suggest a class for a student by DOB (age heuristic) or provided grade.
   * If gradeLevel is not provided, a simple DOB->grade heuristic is applied.
   * @param params.organizationId - Organization/school identifier
   * @param params.dateOfBirth - Student's date of birth (optional)
   * @param params.gradeLevel - Target grade level (optional)
   */
  static async suggestClassForStudent(params: {
    organizationId: string;
    dateOfBirth?: string | null;
    gradeLevel?: string | null;
  }): Promise<ClassSuggestion | null> {
    const { organizationId, dateOfBirth, gradeLevel } = params;

    let targetGrade = gradeLevel || null;
    if (!targetGrade && dateOfBirth) {
      try {
        const dob = new Date(dateOfBirth);
        const ageYears = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        // Heuristic: <6 => pre_k, else foundation
        targetGrade = ageYears < 6 ? 'pre_k' : 'foundation';
      } catch { /* Intentional: non-fatal */ }
    }

    if (!targetGrade) {
      // Last resort: any active class in the organization
      const client = assertSupabase();
      const { data: anyClasses } = await client
        .from('classes')
        .select('id, name, grade_level')
        .eq('preschool_id', organizationId) // Database field still named preschool_id
        .eq('is_active', true)
        .limit(10);
      if (!anyClasses || !anyClasses.length) return null;

      // Count and pick least-loaded
      const candidates: Array<{ id: string; name: string; grade_level?: string | null; student_count: number }> = [];
      for (const cls of anyClasses) {
        const { count } = await client
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', cls.id)
          .eq('is_active', true);
        candidates.push({ id: cls.id, name: cls.name, grade_level: (cls as any).grade_level, student_count: count || 0 });
      }
      candidates.sort((a, b) => a.student_count - b.student_count);
      const best = candidates[0];
      return {
        classId: best.id,
        className: best.name,
        gradeLevel: (best as any).grade_level || null,
        reason: `Selected least-loaded class (no grade info provided)` ,
        candidates,
      };
    }

    return this.suggestClassForGrade(organizationId, targetGrade);
  }

  /**
   * Auto-assigns a student to a suggested class (updates students.class_id).
   * Returns the suggestion applied, or null if none could be made.
   * @param studentId - Student identifier
   * @param opts.organizationId - Organization/school identifier (optional, will be fetched if missing)
   * @param opts.gradeLevel - Target grade level (optional)
   */
  static async autoAssignStudent(studentId: string, opts?: { organizationId?: string; gradeLevel?: string | null }): Promise<ClassSuggestion | null> {
    const client = assertSupabase();

    // Fetch student for organization/grade context if missing
    let organizationId = opts?.organizationId || null;
    let gradeLevel = opts?.gradeLevel || null;

    try {
      const { data: student } = await client
        .from('students')
        .select('id, preschool_id, date_of_birth')
        .eq('id', studentId)
        .single();
      if (student) {
        organizationId = organizationId || student.preschool_id; // Database field still named preschool_id
      }
    } catch { /* Intentional: non-fatal */ }

    if (!organizationId) return null;

    const suggestion = await this.suggestClassForStudent({ organizationId, gradeLevel });
    if (!suggestion) return null;

    // Apply update
    await client
      .from('students')
      .update({ class_id: suggestion.classId })
      .eq('id', studentId);

    return suggestion;
  }
}

export default ClassPlacementService;
