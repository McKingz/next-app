import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

// Create Supabase client with service role for bypassing RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface ProgressComputationRequest {
  student_id?: string
  preschool_id?: string
  subject?: string
  date_range?: {
    start: string
    end: string
  }
  computation_type: 'daily' | 'weekly' | 'monthly' | 'on_demand'
}

interface StudentProgressData {
  student_id: string
  student_name: string
  preschool_id: string
  homework_submissions: any[]
  ai_assessments: any[]
  attendance_records?: any[]
  baseline_scores?: any[]
  current_period: {
    start: Date
    end: Date
  }
}

interface ProgressMetrics {
  student_id: string
  subject: string
  baseline_score: number
  current_score: number
  progress_index: number
  submission_rate: number
  on_time_rate: number
  engagement_score: number
  improvement_areas: string[]
  strengths: string[]
}

interface ProgressInsight {
  student_id: string
  period_start: Date
  period_end: Date
  ai_summary: string
  recommendations: string[]
  key_metrics: {
    overall_progress: number
    submission_rate: number
    engagement_level: 'low' | 'medium' | 'high'
    areas_of_concern: string[]
  }
}

/**
 * Get students for progress computation
 */
async function getStudentsForComputation(request: ProgressComputationRequest): Promise<string[]> {
  let query = supabase
    .from('students')
    .select('id')
    .eq('is_active', true)

  if (request.student_id) {
    query = query.eq('id', request.student_id)
  }

  if (request.preschool_id) {
    query = query.eq('preschool_id', request.preschool_id)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to get students: ${error.message}`)
  }

  return data.map(s => s.id)
}

/**
 * Get comprehensive student progress data
 */
async function getStudentProgressData(studentId: string, dateRange?: { start: string, end: string }): Promise<StudentProgressData> {
  const endDate = dateRange?.end ? new Date(dateRange.end) : new Date()
  const startDate = dateRange?.start ? new Date(dateRange.start) : new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000)) // 30 days ago

  // Get student info
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(`
      id,
      first_name,
      last_name,
      preschool_id,
      class_id,
      classes (
        name,
        grade_level
      )
    `)
    .eq('id', studentId)
    .single()

  if (studentError) {
    throw new Error(`Student not found: ${studentError.message}`)
  }

  // Get homework submissions in date range
  const { data: submissions, error: submissionsError } = await supabase
    .from('homework_submissions')
    .select(`
      *,
      homework_assignments (
        title,
        subject,
        due_date,
        total_points,
        difficulty_level
      )
    `)
    .eq('student_id', studentId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true })

  if (submissionsError) {
    console.error('Error fetching submissions:', submissionsError)
  }

  // Get AI assessments from homework submissions
  const aiAssessments = submissions?.filter(s => s.ai_feedback || s.score !== null) || []

  // Get baseline scores if available
  const { data: baselineScores, error: baselineError } = await supabase
    .from('student_progress_metrics')
    .select('*')
    .eq('student_id', studentId)
    .lte('metric_date', startDate.toISOString().split('T')[0])
    .order('metric_date', { ascending: false })
    .limit(5)

  if (baselineError) {
    console.error('Error fetching baseline scores:', baselineError)
  }

  return {
    student_id: studentId,
    student_name: `${student.first_name} ${student.last_name}`,
    preschool_id: student.preschool_id,
    homework_submissions: submissions || [],
    ai_assessments: aiAssessments,
    baseline_scores: baselineScores || [],
    current_period: {
      start: startDate,
      end: endDate
    }
  }
}

/**
 * Calculate progress metrics for a subject
 */
function calculateSubjectMetrics(studentData: StudentProgressData, subject: string): ProgressMetrics {
  const subjectSubmissions = studentData.homework_submissions.filter(s => 
    s.homework_assignments?.subject === subject
  )

  // Calculate baseline score (average of first 3 submissions or previous baseline)
  const baselineFromPrevious = studentData.baseline_scores.find(b => b.subject === subject)?.current_score || 0
  const earlySubmissions = subjectSubmissions.slice(0, 3)
  const baselineFromEarly = earlySubmissions.length > 0 
    ? earlySubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / earlySubmissions.length
    : 0
  const baselineScore = baselineFromPrevious || baselineFromEarly

  // Calculate current score (average of recent submissions)
  const recentSubmissions = subjectSubmissions.slice(-5) // Last 5 submissions
  const currentScore = recentSubmissions.length > 0
    ? recentSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / recentSubmissions.length
    : baselineScore

  // Calculate progress index (normalized improvement)
  const progressIndex = baselineScore > 0 
    ? ((currentScore - baselineScore) / baselineScore) * 100
    : 0

  // Calculate submission rate
  const totalAssignments = subjectSubmissions.length // This should ideally compare against all assignments given
  const submittedAssignments = subjectSubmissions.filter(s => s.status === 'submitted' || s.status === 'graded').length
  const submissionRate = totalAssignments > 0 ? (submittedAssignments / totalAssignments) * 100 : 0

  // Calculate on-time submission rate
  const onTimeSubmissions = subjectSubmissions.filter(s => {
    if (!s.homework_assignments?.due_date || !s.submitted_at) return false
    return new Date(s.submitted_at) <= new Date(s.homework_assignments.due_date)
  }).length
  const onTimeRate = submittedAssignments > 0 ? (onTimeSubmissions / submittedAssignments) * 100 : 0

  // Simple engagement score based on various factors
  const engagementFactors = [
    Math.min(submissionRate / 100, 1) * 30, // Submission consistency
    Math.min(onTimeRate / 100, 1) * 25,     // Timeliness
    Math.min(Math.abs(progressIndex) / 50, 1) * 25, // Progress magnitude
    (subjectSubmissions.filter(s => s.submitted_offline).length / Math.max(subjectSubmissions.length, 1)) * 20 // Offline engagement
  ]
  const engagementScore = engagementFactors.reduce((sum, factor) => sum + factor, 0)

  // Identify improvement areas and strengths
  const improvementAreas: string[] = []
  const strengths: string[] = []

  if (submissionRate < 80) improvementAreas.push('assignment_completion')
  if (onTimeRate < 70) improvementAreas.push('timeliness')
  if (progressIndex < -10) improvementAreas.push('academic_performance')
  if (engagementScore < 60) improvementAreas.push('engagement')

  if (submissionRate >= 90) strengths.push('consistent_submission')
  if (onTimeRate >= 85) strengths.push('punctual_submission')
  if (progressIndex >= 15) strengths.push('academic_improvement')
  if (engagementScore >= 80) strengths.push('high_engagement')

  return {
    student_id: studentData.student_id,
    subject,
    baseline_score: baselineScore,
    current_score: currentScore,
    progress_index: progressIndex,
    submission_rate: submissionRate,
    on_time_rate: onTimeRate,
    engagement_score: engagementScore,
    improvement_areas: improvementAreas,
    strengths: strengths
  }
}

/**
 * Generate AI insights using OpenAI
 */
async function generateAIInsights(studentData: StudentProgressData, metrics: ProgressMetrics[]): Promise<ProgressInsight> {
  if (!OPENAI_API_KEY) {
    // Generate a basic insight without AI
    const overallProgress = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.progress_index, 0) / metrics.length
      : 0

    const overallSubmissionRate = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.submission_rate, 0) / metrics.length
      : 0

    const engagementLevel = overallSubmissionRate >= 80 ? 'high' : overallSubmissionRate >= 60 ? 'medium' : 'low'
    const allImprovementAreas = [...new Set(metrics.flatMap(m => m.improvement_areas))]

    return {
      student_id: studentData.student_id,
      period_start: studentData.current_period.start,
      period_end: studentData.current_period.end,
      ai_summary: `${studentData.student_name} has shown ${overallProgress >= 0 ? 'positive' : 'concerning'} progress during this period. Their overall submission rate is ${overallSubmissionRate.toFixed(1)}% with ${engagementLevel} engagement levels.`,
      recommendations: [
        overallSubmissionRate < 80 ? 'Encourage more consistent homework completion' : 'Continue current engagement practices',
        metrics.some(m => m.on_time_rate < 70) ? 'Work on time management and deadline awareness' : 'Maintain excellent punctuality',
        overallProgress < 0 ? 'Consider additional academic support in struggling subjects' : 'Build on current academic strengths'
      ].filter(Boolean),
      key_metrics: {
        overall_progress: overallProgress,
        submission_rate: overallSubmissionRate,
        engagement_level: engagementLevel as 'low' | 'medium' | 'high',
        areas_of_concern: allImprovementAreas
      }
    }
  }

  // Prepare data for AI analysis
  const prompt = `Analyze the following student progress data and provide educational insights:

Student: ${studentData.student_name}
Period: ${studentData.current_period.start.toDateString()} to ${studentData.current_period.end.toDateString()}

Subject Metrics:
${metrics.map(m => `
- ${m.subject}: 
  * Progress Index: ${m.progress_index.toFixed(1)}%
  * Submission Rate: ${m.submission_rate.toFixed(1)}%
  * On-time Rate: ${m.on_time_rate.toFixed(1)}%
  * Engagement Score: ${m.engagement_score.toFixed(1)}%
  * Strengths: ${m.strengths.join(', ') || 'None identified'}
  * Areas for Improvement: ${m.improvement_areas.join(', ') || 'None identified'}
`).join('')}

Recent Submissions Summary:
- Total submissions: ${studentData.homework_submissions.length}
- Offline submissions: ${studentData.homework_submissions.filter(s => s.submitted_offline).length}
- Average score: ${studentData.ai_assessments.length > 0 ? (studentData.ai_assessments.reduce((sum, s) => sum + (s.score || 0), 0) / studentData.ai_assessments.length).toFixed(1) : 'N/A'}

Please provide:
1. A concise summary of the student's progress (2-3 sentences)
2. 3-4 specific, actionable recommendations for parents and teachers
3. Key insights about learning patterns or behaviors

Keep the language supportive and constructive, appropriate for parents and teachers of preschool children.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an experienced early childhood education specialist providing progress insights for preschool students. Focus on developmental appropriateness, positive reinforcement, and practical guidance for parents and teachers.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const result = await response.json()
    const aiResponse = result.choices[0]?.message?.content || ''

    // Parse the response to extract summary and recommendations
    const lines = aiResponse.split('\n').filter(line => line.trim())
    let summary = ''
    const recommendations: string[] = []

    let currentSection = ''
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine.toLowerCase().includes('summary') || trimmedLine.toLowerCase().includes('progress')) {
        currentSection = 'summary'
      } else if (trimmedLine.toLowerCase().includes('recommendation') || trimmedLine.toLowerCase().includes('suggest')) {
        currentSection = 'recommendations'
      } else if (trimmedLine && !trimmedLine.match(/^\d+\./)) {
        if (currentSection === 'summary' && !summary) {
          summary = trimmedLine
        } else if (currentSection === 'recommendations') {
          recommendations.push(trimmedLine.replace(/^[-*•]\s*/, ''))
        }
      }
    }

    if (!summary) {
      summary = lines.find(line => line.length > 50) || `${studentData.student_name} is making progress in their learning journey.`
    }

    const overallProgress = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.progress_index, 0) / metrics.length
      : 0

    const overallSubmissionRate = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.submission_rate, 0) / metrics.length
      : 0

    const engagementLevel = overallSubmissionRate >= 80 ? 'high' : overallSubmissionRate >= 60 ? 'medium' : 'low'
    const allImprovementAreas = [...new Set(metrics.flatMap(m => m.improvement_areas))]

    return {
      student_id: studentData.student_id,
      period_start: studentData.current_period.start,
      period_end: studentData.current_period.end,
      ai_summary: summary,
      recommendations: recommendations.slice(0, 4),
      key_metrics: {
        overall_progress: overallProgress,
        submission_rate: overallSubmissionRate,
        engagement_level: engagementLevel as 'low' | 'medium' | 'high',
        areas_of_concern: allImprovementAreas
      }
    }

  } catch (error) {
    console.error('Error generating AI insights:', error)
    
    // Fallback to basic insights
    return await generateAIInsights(studentData, metrics) // This will use the non-AI path
  }
}

/**
 * Save progress metrics to database
 */
async function saveProgressMetrics(metrics: ProgressMetrics[], date: Date): Promise<void> {
  const metricDate = date.toISOString().split('T')[0]

  for (const metric of metrics) {
    // Upsert metric (update if exists, insert if not)
    const { error } = await supabase
      .from('student_progress_metrics')
      .upsert({
        student_id: metric.student_id,
        metric_date: metricDate,
        subject: metric.subject,
        baseline_score: metric.baseline_score,
        current_score: metric.current_score,
        progress_index: metric.progress_index
      }, {
        onConflict: 'student_id,metric_date,subject'
      })

    if (error) {
      console.error('Error saving progress metric:', error)
    }
  }
}

/**
 * Save progress insights to database
 */
async function saveProgressInsights(insights: ProgressInsight[]): Promise<void> {
  for (const insight of insights) {
    const { error } = await supabase
      .from('student_progress_insights')
      .upsert({
        student_id: insight.student_id,
        period_start: insight.period_start.toISOString().split('T')[0],
        period_end: insight.period_end.toISOString().split('T')[0],
        ai_summary: insight.ai_summary,
        recommendations: insight.recommendations.join('\n'),
        key_metrics: insight.key_metrics
      }, {
        onConflict: 'student_id,period_start,period_end'
      })

    if (error) {
      console.error('Error saving progress insight:', error)
    }
  }
}

/**
 * Track computation event
 */
async function trackComputationEvent(studentIds: string[], computationType: string): Promise<void> {
  try {
    // Get unique preschool IDs from students
    const { data: students } = await supabase
      .from('students')
      .select('id, preschool_id')
      .in('id', studentIds)

    const preschoolIds = [...new Set(students?.map(s => s.preschool_id) || [])]

    for (const preschoolId of preschoolIds) {
      await supabase
        .from('parent_engagement_events')
        .insert({
          preschool_id: preschoolId,
          parent_id: null, // System event
          event_type: 'progress_metrics_computed',
          metadata: {
            computation_type: computationType,
            student_count: studentIds.length,
            computed_at: new Date().toISOString()
          }
        })
    }
  } catch (error) {
    console.error('Error tracking computation event:', error)
  }
}

/**
 * Main progress computation handler
 */
async function computeProgressMetrics(request: Request): Promise<Response> {
  try {
    const computationRequest: ProgressComputationRequest = await request.json()
    console.log('Processing progress computation request:', computationRequest)

    // Get students to compute progress for
    const studentIds = await getStudentsForComputation(computationRequest)

    if (studentIds.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No students found for computation',
        students_processed: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`Computing progress for ${studentIds.length} students`)

    const allMetrics: ProgressMetrics[] = []
    const allInsights: ProgressInsight[] = []
    const subjects = ['literacy', 'numeracy', 'life_skills', 'creative_arts', 'physical_development']

    // Process each student
    for (const studentId of studentIds) {
      try {
        const studentData = await getStudentProgressData(studentId, computationRequest.date_range)
        
        // Calculate metrics for each subject
        const studentMetrics: ProgressMetrics[] = []
        
        if (computationRequest.subject) {
          // Compute for specific subject only
          const metrics = calculateSubjectMetrics(studentData, computationRequest.subject)
          studentMetrics.push(metrics)
        } else {
          // Compute for all subjects
          for (const subject of subjects) {
            const metrics = calculateSubjectMetrics(studentData, subject)
            studentMetrics.push(metrics)
          }
        }

        allMetrics.push(...studentMetrics)

        // Generate AI insights for this student
        const insight = await generateAIInsights(studentData, studentMetrics)
        allInsights.push(insight)

        console.log(`Processed student ${studentId}: ${studentMetrics.length} metrics computed`)

      } catch (error) {
        console.error(`Error processing student ${studentId}:`, error)
        // Continue with other students
      }
    }

    // Save all metrics and insights to database
    const computationDate = new Date()
    await saveProgressMetrics(allMetrics, computationDate)
    await saveProgressInsights(allInsights)

    // Track the computation event
    await trackComputationEvent(studentIds, computationRequest.computation_type)

    console.log(`Progress computation completed: ${allMetrics.length} metrics, ${allInsights.length} insights`)

    return new Response(JSON.stringify({
      success: true,
      students_processed: studentIds.length,
      metrics_computed: allMetrics.length,
      insights_generated: allInsights.length,
      computation_type: computationRequest.computation_type,
      computed_at: computationDate.toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error computing progress metrics:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to compute progress metrics',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Handle scheduled computation (daily cron job)
 */
async function handleScheduledComputation(request: Request): Promise<Response> {
  try {
    console.log('Running scheduled daily progress computation')

    const computationRequest: ProgressComputationRequest = {
      computation_type: 'daily',
      date_range: {
        start: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString(), // Last 7 days
        end: new Date().toISOString()
      }
    }

    return await computeProgressMetrics(new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(computationRequest)
    }))

  } catch (error) {
    console.error('Error in scheduled computation:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to run scheduled computation',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Main request handler
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url)
  
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Handle different endpoints
  if (url.pathname.includes('scheduled')) {
    return await handleScheduledComputation(request)
  } else {
    return await computeProgressMetrics(request)
  }
}

// Serve the function
serve(handleRequest)