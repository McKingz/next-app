/**
 * Principal Hub API - Supabase Edge Function
 * 
 * Provides REST API endpoints for Principal Hub dashboard
 * Handles school metrics, teacher data, financial summaries, and more
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

interface DatabaseError extends Error {
  code?: string;
  details?: string;
  hint?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Extract JWT token from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Invalid authentication token')
    }

    // Verify user is a principal
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, preschool_id')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile || profile.role !== 'principal') {
      throw new Error('Access denied: Principal role required')
    }

    const preschoolId = profile.preschool_id
    const url = new URL(req.url)
    const endpoint = url.pathname.split('/').pop()

    console.log(`Principal Hub API: ${endpoint} for preschool ${preschoolId}`)

    switch (endpoint) {
      case 'school-stats':
        return await getSchoolStats(supabase, preschoolId)
      
      case 'teachers':
        return await getTeachers(supabase, preschoolId)
      
      case 'financial-summary':
        return await getFinancialSummary(supabase, preschoolId)
      
      case 'capacity-metrics':
        return await getCapacityMetrics(supabase, preschoolId)
      
      case 'enrollment-pipeline':
        return await getEnrollmentPipeline(supabase, preschoolId)
      
      case 'recent-activities':
        return await getRecentActivities(supabase, preschoolId)
      
      case 'create-announcement':
        return await createAnnouncement(supabase, preschoolId, user.id, req)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid endpoint' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

  } catch (error) {
    const dbError = error as DatabaseError
    console.error('Principal Hub API Error:', dbError)
    
    return new Response(
      JSON.stringify({ 
        error: dbError.message || 'Internal server error',
        code: dbError.code,
        details: dbError.details
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/**
 * Get comprehensive school statistics
 */
async function getSchoolStats(supabase: any, preschoolId: string) {
  try {
    // Get total students count
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('preschool_id', preschoolId)

    // Get total staff count
    const { count: staffCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('preschool_id', preschoolId)
      .in('role', ['teacher', 'assistant', 'admin'])

    // Get total classes count
    const { count: classCount } = await supabase
      .from('classes')
      .select('*', { count: 'exact', head: true })
      .eq('preschool_id', preschoolId)

    // Get pending enrollment applications
    const { count: pendingApplications } = await supabase
      .from('enrollment_applications')
      .select('*', { count: 'exact', head: true })
      .eq('preschool_id', preschoolId)
      .eq('status', 'pending')

    // Get monthly revenue (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { data: revenueData } = await supabase
      .from('payments')
      .select('amount')
      .eq('preschool_id', preschoolId)
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo.toISOString())

    const monthlyRevenue = revenueData?.reduce((sum: number, payment: any) => 
      sum + (payment.amount || 0), 0) || 0

    // Get attendance rate (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { count: totalAttendanceRecords } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .eq('preschool_id', preschoolId)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])

    const { count: presentRecords } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true })
      .eq('preschool_id', preschoolId)
      .eq('status', 'present')
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])

    const attendanceRate = totalAttendanceRecords > 0 
      ? Math.round((presentRecords / totalAttendanceRecords) * 100) 
      : 0

    const stats = {
      students: {
        total: studentCount || 0,
        trend: 'up' // Could be calculated from historical data
      },
      staff: {
        total: staffCount || 0,
        trend: 'stable'
      },
      classes: {
        total: classCount || 0,
        trend: 'stable'
      },
      pendingApplications: {
        total: pendingApplications || 0,
        trend: 'up'
      },
      monthlyRevenue: {
        total: monthlyRevenue,
        trend: 'up'
      },
      attendanceRate: {
        percentage: attendanceRate,
        trend: attendanceRate > 90 ? 'excellent' : attendanceRate > 80 ? 'good' : 'needs_attention'
      },
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(stats),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    throw error
  }
}

/**
 * Get teachers with calculated performance metrics
 */
async function getTeachers(supabase: any, preschoolId: string) {
  try {
    // Get teachers with their classes and student counts
    const { data: teachers, error } = await supabase
      .from('teachers')
      .select(`
        id,
        user_id,
        email,
        first_name,
        last_name,
        phone,
        subject_specialization,
        created_at
      `)
      .eq('preschool_id', preschoolId)
      .eq('is_active', true)

    if (error) throw error

    // Get classes for each teacher separately
    const teachersWithClasses = await Promise.all(
      (teachers || []).map(async (teacher: any) => {
        const { data: classes } = await supabase
          .from('classes')
          .select(`
            id,
            name,
            students:student_classes(
              student_id
            )
          `)
          .eq('teacher_id', teacher.user_id)
          .eq('preschool_id', preschoolId)

        return {
          ...teacher,
          classes: classes || []
        }
      })
    )

    const teachersWithMetrics = teachersWithClasses?.map((teacher: any) => {
      const classesAssigned = teacher.classes?.length || 0
      const studentsCount = teacher.classes?.reduce((total: number, cls: any) => 
        total + (cls.students?.length || 0), 0) || 0

      // Calculate performance status (simplified)
      let status = 'good'
      let performanceIndicator = 'Meeting expectations'

      if (studentsCount > 25) {
        status = 'needs_attention'
        performanceIndicator = 'High student load'
      } else if (studentsCount > 15 && classesAssigned <= 2) {
        status = 'excellent'
        performanceIndicator = 'Excellent student engagement'
      } else if (classesAssigned === 0) {
        status = 'needs_attention'
        performanceIndicator = 'No classes assigned'
      }

      return {
        id: teacher.id,
        email: teacher.email,
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        full_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim(),
        phone: teacher.phone,
        subject_specialization: teacher.subject_specialization,
        hire_date: teacher.created_at,
        classes_assigned: classesAssigned,
        students_count: studentsCount,
        status,
        performance_indicator: performanceIndicator
      }
    }) || []

    return new Response(
      JSON.stringify(teachersWithMetrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    throw error
  }
}

/**
 * Get financial summary including revenue, expenses, and profit
 */
async function getFinancialSummary(supabase: any, preschoolId: string) {
  try {
    const now = new Date()
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // Current month revenue
    const { data: currentRevenue } = await supabase
      .from('payments')
      .select('amount')
      .eq('preschool_id', preschoolId)
      .eq('status', 'completed')
      .gte('created_at', currentMonth.toISOString())

    const monthlyRevenue = currentRevenue?.reduce((sum: number, payment: any) => 
      sum + (payment.amount || 0), 0) || 0

    // Last month revenue for comparison
    const { data: lastMonthRevenue } = await supabase
      .from('payments')
      .select('amount')
      .eq('preschool_id', preschoolId)
      .eq('status', 'completed')
      .gte('created_at', lastMonth.toISOString())
      .lt('created_at', currentMonth.toISOString())

    const previousMonthRevenue = lastMonthRevenue?.reduce((sum: number, payment: any) => 
      sum + (payment.amount || 0), 0) || 0

    // Calculate expenses (simplified - could be enhanced with expense tracking)
    const estimatedExpenses = monthlyRevenue * 0.7 // Assume 70% expenses

    const netProfit = monthlyRevenue - estimatedExpenses

    // Calculate growth
    const revenueGrowth = previousMonthRevenue > 0 
      ? ((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : 0

    const summary = {
      monthlyRevenue,
      previousMonthRevenue,
      estimatedExpenses,
      netProfit,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      profitMargin: monthlyRevenue > 0 ? Math.round((netProfit / monthlyRevenue) * 100) : 0,
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    throw error
  }
}

/**
 * Get school capacity and enrollment metrics
 */
async function getCapacityMetrics(supabase: any, preschoolId: string) {
  try {
    // Get school capacity from preschools table
    const { data: preschool } = await supabase
      .from('preschools')
      .select('capacity')
      .eq('id', preschoolId)
      .single()

    const capacity = preschool?.capacity || 100

    // Get current enrollment
    const { count: currentEnrollment } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('preschool_id', preschoolId)
      .eq('status', 'active')

    const utilizationPercentage = Math.round((currentEnrollment / capacity) * 100)

    // Get enrollment by age group
    const { data: enrollmentByAge } = await supabase
      .from('students')
      .select('date_of_birth')
      .eq('preschool_id', preschoolId)
      .eq('status', 'active')

    const ageGroups = {
      toddlers: 0, // 1-2 years
      preschool: 0, // 3-4 years
      prekindergarten: 0 // 5+ years
    }

    const currentDate = new Date()
    enrollmentByAge?.forEach((student: any) => {
      if (student.date_of_birth) {
        const age = currentDate.getFullYear() - new Date(student.date_of_birth).getFullYear()
        if (age <= 2) ageGroups.toddlers++
        else if (age <= 4) ageGroups.preschool++
        else ageGroups.prekindergarten++
      }
    })

    const metrics = {
      capacity,
      current_enrollment: currentEnrollment || 0,
      available_spots: capacity - (currentEnrollment || 0),
      utilization_percentage: utilizationPercentage,
      enrollment_by_age: ageGroups,
      status: utilizationPercentage > 95 ? 'full' : utilizationPercentage > 85 ? 'high' : 'available',
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(metrics),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    throw error
  }
}

/**
 * Get enrollment pipeline and application status
 */
async function getEnrollmentPipeline(supabase: any, preschoolId: string) {
  try {
    const { data: applications } = await supabase
      .from('enrollment_applications')
      .select('status, created_at, child_age, preferred_start_date')
      .eq('preschool_id', preschoolId)
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days

    const pipeline = {
      pending: 0,
      approved: 0,
      rejected: 0,
      waitlisted: 0,
      total: applications?.length || 0
    }

    applications?.forEach((app: any) => {
      if (pipeline.hasOwnProperty(app.status)) {
        pipeline[app.status as keyof typeof pipeline]++
      }
    })

    return new Response(
      JSON.stringify(pipeline),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    throw error
  }
}

/**
 * Get recent activities and events
 */
async function getRecentActivities(supabase: any, preschoolId: string) {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Get recent enrollments
    const { data: recentEnrollments } = await supabase
      .from('students')
      .select('first_name, last_name, created_at')
      .eq('preschool_id', preschoolId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    // Get recent applications
    const { data: recentApplications } = await supabase
      .from('enrollment_applications')
      .select('child_name, status, created_at')
      .eq('preschool_id', preschoolId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    const activities = [
      ...(recentEnrollments?.map((student: any) => ({
        type: 'enrollment',
        title: `${student.first_name} ${student.last_name} enrolled`,
        timestamp: student.created_at,
        icon: 'person-add'
      })) || []),
      ...(recentApplications?.map((app: any) => ({
        type: 'application',
        title: `New application: ${app.child_name}`,
        timestamp: app.created_at,
        status: app.status,
        icon: 'document-text'
      })) || [])
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return new Response(
      JSON.stringify(activities),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    throw error
  }
}

/**
 * Create school announcement
 */
async function createAnnouncement(supabase: any, preschoolId: string, userId: string, req: Request) {
  try {
    const { message, audience, priority = 'normal' } = await req.json()

    if (!message || !message.trim()) {
      throw new Error('Announcement message is required')
    }

    if (!audience || !Array.isArray(audience) || audience.length === 0) {
      throw new Error('Announcement audience is required')
    }

    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        preschool_id: preschoolId,
        created_by: userId,
        title: message.slice(0, 100), // First 100 chars as title
        content: message,
        audience: audience,
        priority,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({ 
        success: true, 
        announcement,
        message: 'Announcement created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    throw error
  }
}

// Export for testing
export { serve }
