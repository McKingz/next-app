/**
 * ProactiveInsightsService
 * 
 * Generates AI-powered insights, predictions, and personalized suggestions
 * for parents based on their child's performance and CAPS curriculum alignment.
 * 
 * Features:
 * - Performance analysis and trends
 * - Predictive alerts (homework, assessments, struggles)
 * - Personalized learning suggestions
 * - CAPS-aligned interactive activities
 * - Progress predictions and recommendations
 */

import { supabase } from '@/lib/supabase';

export interface StudentPerformanceData {
  student_id: string;
  student_name: string;
  grade: string;
  recent_grades?: Array<{ subject: string; grade: string; date: string }>;
  attendance_rate?: number;
  homework_completion_rate?: number;
  strengths?: string[];
  struggles?: string[];
  recent_assessments?: Array<{ name: string; score: number; max_score: number; date: string }>;
}

export interface ProactiveInsight {
  id: string;
  type: 'strength' | 'concern' | 'prediction' | 'suggestion' | 'celebration';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action_items?: Array<{ title: string; description: string }>;
  caps_topics?: string[];
  created_at: string;
  expires_at?: string;
}

export interface InteractiveLesson {
  id: string;
  title: string;
  description: string;
  grade: string;
  subject: string;
  caps_topic: string;
  caps_topics?: string[];
  estimated_duration: string;
  duration_minutes: number;
  difficulty: string;
  materials_needed: string[];
  instructions: string[];
  learning_outcomes: string[];
  parent_tips: string[];
}

export interface PredictiveAlert {
  id: string;
  alert_type: 'homework_due' | 'assessment_coming' | 'struggling_subject' | 'missed_concept' | 'celebration';
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  message: string;
  recommended_actions: string[];
  related_resources?: Array<{ title: string; type: string; url: string }>;
  created_at: string;
}

export class ProactiveInsightsService {
  private preschoolId: string;

  constructor(preschoolId: string) {
    this.preschoolId = preschoolId;
  }

  /**
   * Generate personalized proactive insights for a student
   */
  async generateProactiveInsights(
    studentId: string
  ): Promise<ProactiveInsight[]> {
    try {
      // Fetch student performance data
      const performanceData = await this.getStudentPerformanceData(studentId, this.preschoolId);

      if (!performanceData) {
        return [];
      }

      // Generate insights using AI
      const insights: ProactiveInsight[] = [];

      // 1. Strength insights
      if (performanceData.strengths && performanceData.strengths.length > 0) {
        insights.push({
          id: `strength-${Date.now()}`,
          type: 'celebration',
          priority: 'medium',
          title: `${performanceData.student_name} is excelling!`,
          description: `Your child shows strong performance in ${performanceData.strengths.join(', ')}. Keep encouraging these areas!`,
          action_items: [
            {
              title: 'Challenge them further',
              description: 'Explore advanced activities in these subjects',
            },
          ],
          created_at: new Date().toISOString(),
        });
      }

      // 2. Concern insights
      if (performanceData.struggles && performanceData.struggles.length > 0) {
        insights.push({
          id: `concern-${Date.now()}`,
          type: 'concern',
          priority: 'high',
          title: 'Areas needing attention',
          description: `${performanceData.student_name} may need extra support in ${performanceData.struggles.join(', ')}.`,
          action_items: [
            {
              title: 'Practice together',
              description: 'Spend 15 minutes daily on these topics',
            },
            {
              title: 'Talk to the teacher',
              description: 'Schedule a meeting to discuss support strategies',
            },
          ],
          caps_topics: performanceData.struggles,
          created_at: new Date().toISOString(),
        });
      }

      // 3. Homework completion insight
      if (performanceData.homework_completion_rate !== undefined && performanceData.homework_completion_rate < 70) {
        insights.push({
          id: `homework-${Date.now()}`,
          type: 'prediction',
          priority: 'high',
          title: 'Homework completion needs improvement',
          description: `Current completion rate: ${performanceData.homework_completion_rate}%. Consistent homework helps reinforce learning.`,
          action_items: [
            {
              title: 'Set a homework routine',
              description: 'Establish a fixed time and quiet space for homework',
            },
            {
              title: 'Break tasks into smaller steps',
              description: 'Help your child tackle homework in manageable chunks',
            },
          ],
          created_at: new Date().toISOString(),
        });
      }

      // 4. Attendance insight
      if (performanceData.attendance_rate !== undefined && performanceData.attendance_rate < 90) {
        insights.push({
          id: `attendance-${Date.now()}`,
          type: 'concern',
          priority: 'high',
          title: 'Attendance affects learning',
          description: `Attendance rate: ${performanceData.attendance_rate}%. Regular attendance is crucial for academic success.`,
          action_items: [
            {
              title: 'Review attendance patterns',
              description: 'Identify any barriers to regular attendance',
            },
          ],
          created_at: new Date().toISOString(),
        });
      }

      return insights;
    } catch (error) {
      console.error('[ProactiveInsightsService] Failed to generate insights:', error);
      return [];
    }
  }

  /**
   * Get CAPS-aligned interactive lessons for a student
   */
  async getInteractiveLessons(
    studentId: string,
    limit: number = 5
  ): Promise<InteractiveLesson[]> {
    try {
      // First get student grade
      const { data: student } = await supabase
        .from('students')
        .select('grade')
        .eq('id', studentId)
        .eq('preschool_id', this.preschoolId)
        .single();

      if (!student) {
        return this.getDefaultInteractiveLessons('Grade R');
      }

      const studentGrade = student.grade;

      // Fetch CAPS topics for the grade
      let query = supabase
        .from('caps_documents')
        .select('topic, subject, keywords, learning_outcomes')
        .eq('grade', studentGrade)
        .eq('document_type', 'curriculum');

      const { data, error } = await query.limit(limit);

      if (error || !data) {
        return this.getDefaultInteractiveLessons(studentGrade);
      }

      // Convert CAPS topics to interactive lessons
      const lessons: InteractiveLesson[] = data.map((doc, index) => ({
        id: `lesson-${index}`,
        title: `${doc.topic} Activity`,
        description: `Hands-on activity to explore ${doc.topic} concepts`,
        grade: studentGrade,
        subject: doc.subject,
        caps_topic: doc.topic,
        caps_topics: [doc.topic],
        estimated_duration: '20 min',
        duration_minutes: 20,
        difficulty: 'Intermediate',
        materials_needed: ['Paper', 'Pencils', 'Colored markers'],
        instructions: [
          `Introduce the topic: ${doc.topic}`,
          'Show real-world examples',
          'Practice together with hands-on activities',
          'Review and celebrate progress',
        ],
        learning_outcomes: doc.learning_outcomes || [`Understand ${doc.topic} concepts`],
        parent_tips: [
          'Make it fun and engaging',
          'Praise effort, not just results',
          'Connect to everyday experiences',
        ],
      }));

      return lessons;
    } catch (error) {
      console.error('[ProactiveInsightsService] Failed to fetch lessons:', error);
      return this.getDefaultInteractiveLessons(studentGrade);
    }
  }

  /**
   * Generate predictive alerts
   */
  async generatePredictiveAlerts(
    studentId: string,
    preschoolId: string
  ): Promise<PredictiveAlert[]> {
    try {
      const alerts: PredictiveAlert[] = [];

      // Check upcoming assessments
      const { data: assessments } = await supabase
        .from('assessments')
        .select('name, due_date, subject')
        .eq('preschool_id', preschoolId)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(3);

      if (assessments && assessments.length > 0) {
        assessments.forEach((assessment) => {
          const daysUntil = Math.ceil(
            (new Date(assessment.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          alerts.push({
            id: `assessment-${assessment.name}`,
            alert_type: 'assessment_coming',
            severity: daysUntil <= 3 ? 'urgent' : 'info',
            title: `${assessment.subject} Assessment in ${daysUntil} days`,
            message: `${assessment.name} is coming up. Help your child prepare!`,
            recommended_actions: [
              'Review past work together',
              'Create a study schedule',
              'Practice with similar questions',
            ],
            created_at: new Date().toISOString(),
          });
        });
      }

      // Check pending homework
      const { data: homework } = await supabase
        .from('homework')
        .select('title, due_date, subject')
        .eq('student_id', studentId)
        .eq('status', 'pending')
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(3);

      if (homework && homework.length > 0) {
        homework.forEach((hw) => {
          const daysUntil = Math.ceil(
            (new Date(hw.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          alerts.push({
            id: `homework-${hw.title}`,
            alert_type: 'homework_due',
            severity: daysUntil <= 1 ? 'urgent' : 'warning',
            title: `${hw.subject} Homework Due ${daysUntil === 0 ? 'Today' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`}`,
            message: hw.title,
            recommended_actions: [
              'Set aside time today',
              'Check if your child needs help',
              'Review the assignment together',
            ],
            created_at: new Date().toISOString(),
          });
        });
      }

      return alerts;
    } catch (error) {
      console.error('[ProactiveInsightsService] Failed to generate alerts:', error);
      return [];
    }
  }

  /**
   * Get student performance data
   */
  private async getStudentPerformanceData(
    studentId: string,
    preschoolId: string
  ): Promise<StudentPerformanceData | null> {
    try {
      // Fetch student basic info
      const { data: student } = await supabase
        .from('students')
        .select('first_name, last_name, grade')
        .eq('id', studentId)
        .eq('preschool_id', preschoolId)
        .single();

      if (!student) {
        return null;
      }

      // Fetch recent progress reports
      const { data: reports } = await supabase
        .from('progress_reports')
        .select('subjects_performance, strengths, areas_for_improvement, attendance_summary')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(1);

      const latestReport = reports?.[0];

      // Calculate attendance rate
      const attendance_rate = latestReport?.attendance_summary?.percentage || 95;

      // Fetch homework completion
      const { data: homeworkStats } = await supabase
        .from('homework')
        .select('status')
        .eq('student_id', studentId);

      const completed = homeworkStats?.filter((hw) => hw.status === 'completed').length || 0;
      const total = homeworkStats?.length || 1;
      const homework_completion_rate = Math.round((completed / total) * 100);

      return {
        student_id: studentId,
        student_name: `${student.first_name} ${student.last_name}`,
        grade: student.grade,
        attendance_rate,
        homework_completion_rate,
        strengths: latestReport?.strengths ? [latestReport.strengths] : undefined,
        struggles: latestReport?.areas_for_improvement ? [latestReport.areas_for_improvement] : undefined,
      };
    } catch (error) {
      console.error('[ProactiveInsightsService] Failed to fetch performance data:', error);
      return null;
    }
  }

  /**
   * Get default interactive lessons (fallback)
   */
  private getDefaultInteractiveLessons(grade: string): InteractiveLesson[] {
    return [
      {
        id: 'default-1',
        title: 'Counting Fun with Objects',
        description: 'Practice counting using everyday items at home',
        grade,
        subject: 'Mathematics',
        caps_topic: 'Numbers and Counting',
        caps_topics: ['Numbers and Counting', 'Basic Math'],
        estimated_duration: '15 min',
        duration_minutes: 15,
        difficulty: 'Beginner',
        materials_needed: ['10 small objects (toys, buttons, blocks)'],
        instructions: [
          'Gather 10 small objects',
          'Count them together slowly',
          'Ask your child to count them',
          'Mix them up and count again',
          'Try counting backwards!',
        ],
        learning_outcomes: ['Count objects up to 10', 'Recognize number patterns'],
        parent_tips: ['Make it playful', 'Use objects they love', 'Celebrate every attempt'],
      },
      {
        id: 'default-2',
        title: 'Letter Sound Adventure',
        description: 'Explore letter sounds through a home scavenger hunt',
        grade,
        subject: 'Language',
        caps_topic: 'Phonics and Letter Recognition',
        caps_topics: ['Phonics', 'Letter Recognition'],
        estimated_duration: '20 min',
        duration_minutes: 20,
        difficulty: 'Beginner',
        materials_needed: ['Paper', 'Pencil', 'Items around the house'],
        instructions: [
          'Pick a letter (start with their name)',
          'Find objects starting with that letter',
          'Write the letter together',
          'Practice the sound',
          'Draw pictures of items found',
        ],
        learning_outcomes: ['Recognize letter sounds', 'Connect sounds to objects'],
        parent_tips: ['Go at their pace', 'Make silly sounds together', 'Praise their discoveries'],
      },
    ];
  }
}

// Export class only, consumers should instantiate with preschoolId
export default ProactiveInsightsService;
