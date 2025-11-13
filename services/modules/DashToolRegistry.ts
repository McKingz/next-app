/**
 * DashToolRegistry
 *
 * Registers and executes AI tools/functions available to Dash.
 * Extracted from AgentTools.ts as part of Phase 4.5 modularization.
 */

// Avoid static imports that create require cycles; use dynamic imports inside executors instead
import { EducationalPDFService } from '@/lib/services/EducationalPDFService';
import { logger } from '@/lib/logger';

export interface AgentTool {
  name: string;
  description: string;
  parameters: any; // JSON Schema
  risk: 'low' | 'medium' | 'high';
  requiresConfirmation?: boolean;
  execute: (args: any, context?: any) => Promise<any>;
}

export class DashToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  // Register a new tool
  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
    logger.debug(`[DashToolRegistry] Registered tool: ${tool.name}`);
  }

  // Get tool specifications for LLM
  getToolSpecs(): Array<{
    name: string;
    description: string;
    input_schema: any;
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  // Get a specific tool
  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  // Execute a tool
  async execute(
    toolName: string,
    args: any,
    context?: any
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool ${toolName} not found` };
    }

    try {
      const result = await tool.execute(args, context);
      return { success: true, result };
    } catch (error) {
      logger.error(`[DashToolRegistry] Tool ${toolName} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Register default tools
  private registerDefaultTools(): void {

    // Navigation tool - DISABLED: Method doesn't exist in refactored architecture
    // TODO: Implement navigation via expo-router directly
    // this.register({
    //   name: 'navigate_to_screen',
    //   ...
    // });

    // Open documents/curriculum resources directly
    this.register({
      name: 'open_document',
      description: 'Directly open CAPS curriculum documents, lesson resources, or other educational materials. Use this instead of giving instructions on how to navigate.',
      parameters: {
        type: 'object',
        properties: {
          document_type: {
            type: 'string',
            enum: ['caps_curriculum', 'lesson_plan', 'worksheet', 'assessment', 'resource'],
            description: 'Type of document to open'
          },
          subject: {
            type: 'string',
            description: 'Subject area (e.g., Mathematics, English, Physical Sciences)'
          },
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "Grade 10", "Grade R")'
          },
          search_query: {
            type: 'string',
            description: 'Specific search term or document title'
          }
        },
        required: ['document_type']
      },
      risk: 'low',
      execute: async (args) => {
        try {
          const { router } = await import('expo-router');
          
          // Build route based on document type
          let route = '/screens/curriculum';
          const params: any = {};
          
          if (args.document_type === 'caps_curriculum') {
            route = '/screens/curriculum';
            if (args.subject) params.subject = args.subject;
            if (args.grade) params.grade = args.grade;
            if (args.search_query) params.search = args.search_query;
          } else if (args.document_type === 'lesson_plan') {
            route = '/screens/lessons';
            if (args.subject) params.subject = args.subject;
          } else if (args.document_type === 'worksheet') {
            route = '/screens/worksheets';
          } else if (args.document_type === 'assessment') {
            route = '/screens/assessments';
          }
          
          // Navigate to the screen
          router.push({ pathname: route, params });
          
          return {
            success: true,
            opened: true,
            route,
            message: `Opening ${args.document_type}${args.subject ? ` for ${args.subject}` : ''}${args.grade ? ` ${args.grade}` : ''}`
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to open document'
          };
        }
      }
    });

    // LEGACY TOOLS DISABLED - Methods don't exist in refactored architecture
    // To re-enable: Implement methods in new modular services
    
    /* DISABLED
    // Lesson generator tool
    this.register({
      name: 'open_lesson_generator',
      description: 'Open the AI lesson generator with pre-filled parameters based on context',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          gradeLevel: { type: 'string' },
          topic: { type: 'string' },
          duration: { type: 'number', description: 'Duration in minutes' },
          objectives: { type: 'string' },
          curriculum: { type: 'string' }
        }
      },
      risk: 'low',
      execute: async (args, context) => {
        const userInput = context?.userInput || '';
        const aiResponse = context?.aiResponse || '';
        const module = await import('../DashAIAssistant');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash = DashClass?.getInstance?.();
        if (!dash) return { opened: false, error: 'Dash not available' };
        dash.openLessonGeneratorFromContext(userInput, aiResponse);
        return { opened: true };
      }
    });

    // Worksheet generation tool
    this.register({
      name: 'generate_worksheet',
      description: 'Generate educational worksheets (math, reading, or activity)',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['math', 'reading', 'activity'],
            description: 'Type of worksheet to generate'
          },
          ageGroup: {
            type: 'string',
            enum: ['3-4 years', '4-5 years', '5-6 years', '6-7 years']
          },
          difficulty: {
            type: 'string',
            enum: ['Easy', 'Medium', 'Hard']
          },
          topic: { type: 'string' },
          problemCount: { type: 'number' }
        },
        required: ['type', 'ageGroup']
      },
      risk: 'medium',
      execute: async (args) => {
        const module = await import('../DashAIAssistant');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash = DashClass?.getInstance?.();
        if (!dash) return { success: false, error: 'Dash not available' };
        return await dash.generateWorksheetAutomatically(args);
      }
    });

    // Task creation tool
    this.register({
      name: 'create_task',
      description: 'Create an automated task or workflow',
      parameters: {
        type: 'object',
        properties: {
          templateId: {
            type: 'string',
            description: 'Task template ID (e.g., weekly_grade_report, lesson_plan_sequence)'
          },
          customParams: {
            type: 'object',
            description: 'Custom parameters for the task'
          }
        },
        required: ['templateId']
      },
      risk: 'medium',
      execute: async (args) => {
        const module = await import('../DashAIAssistant');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash = DashClass?.getInstance?.();
        if (!dash) return { success: false, error: 'Dash not available' };
        return await dash.createAutomatedTask(args.templateId, args.customParams);
      }
    });

    // PDF export tool
    this.register({
      name: 'export_pdf',
      description: 'Export content as a PDF document',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['title', 'content']
      },
      risk: 'low',
      execute: async (args) => {
        const module = await import('../DashAIAssistant');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash = DashClass?.getInstance?.();
        if (!dash) return { success: false, error: 'Dash not available' };
        return await dash.exportTextAsPDFForDownload(args.title, args.content);
      }
    });

    // Message composition tool
    this.register({
      name: 'compose_message',
      description: 'Open message composer with pre-filled content',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' },
          recipient: { type: 'string', description: 'parent or teacher' }
        }
      },
      risk: 'low',
      execute: async (args) => {
        const module = await import('../DashAIAssistant');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash = DashClass?.getInstance?.();
        if (!dash) return { success: false, error: 'Dash not available' };
        dash.openTeacherMessageComposer(args.subject, args.body);
        return { opened: true };
      }
    });
    */
    
    // PDF export tool (enabled)
    this.register({
      name: 'export_pdf',
      description: 'Export provided title and markdown/text content as a PDF and return a link',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Document title' },
          content: { type: 'string', description: 'Document body (markdown supported)' }
        },
        required: ['title', 'content']
      },
      risk: 'low',
      execute: async (args) => {
        try {
          const { getDashPDFGenerator } = await import('@/services/DashPDFGenerator');
          const supabase = (await import('@/lib/supabase')).assertSupabase();

          const generator = getDashPDFGenerator();
          const result = await generator.generateFromStructuredData({
            type: 'general',
            title: String(args.title || 'Document'),
            sections: [
              { id: 'main', title: 'Content', markdown: String(args.content || '') }
            ],
          });

          if (!result.success) {
            return { success: false, error: result.error || 'PDF generation failed' };
          }

          let publicUrl: string | undefined;
          if (result.storagePath) {
            try {
              const { data } = supabase.storage
                .from('generated-pdfs')
                .getPublicUrl(result.storagePath);
              publicUrl = data?.publicUrl || undefined;
            } catch {}
          }

          // Post a friendly assistant message into the current Dash Chat conversation
          try {
            const { DashAIAssistant } = await import('@/services/dash-ai/DashAICompat');
            const dash = DashAIAssistant.getInstance();
            const convId = dash.getCurrentConversationId?.();
            const link = publicUrl || result.uri;
            if (convId && link) {
              const msg = {
                id: `pdf_${Date.now()}`,
                type: 'assistant',
                content: `Your PDF is ready: [Open PDF](${link})`,
                timestamp: Date.now(),
                metadata: {
                  suggested_actions: ['export_pdf'],
                  dashboard_action: { type: 'export_pdf', title: args.title, content: args.content },
                  tool_results: { tool: 'export_pdf', filename: result.filename, storagePath: result.storagePath, publicUrl: publicUrl }
                }
              } as any;
              await dash.addMessageToConversation(convId, msg);
            }
          } catch (postErr) {
            // Non-fatal if posting fails
            console.warn('[export_pdf] Failed to post chat message:', postErr);
          }

          return {
            success: true,
            uri: result.uri,
            filename: result.filename,
            storagePath: result.storagePath,
            publicUrl,
            message: 'PDF generated successfully',
          };
        } catch (e: any) {
          return { success: false, error: e?.message || 'PDF export failed' };
        }
      }
    });

    // Email sending tool (HIGH RISK - requires explicit confirmation)
    this.register({
      name: 'send_email',
      description: 'Send an email to one or more recipients. REQUIRES explicit user confirmation. Only principals and teachers can send emails.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address (or comma-separated addresses)'
          },
          subject: {
            type: 'string',
            description: 'Email subject line'
          },
          body: {
            type: 'string',
            description: 'Email body content (HTML supported)'
          },
          reply_to: {
            type: 'string',
            description: 'Optional reply-to email address'
          },
          is_html: {
            type: 'boolean',
            description: 'Whether body contains HTML (default: true)'
          }
        },
        required: ['to', 'subject', 'body']
      },
      risk: 'high',
      requiresConfirmation: true,
      execute: async (args) => {
        try {
          const supabase = (await import('@/lib/supabase')).assertSupabase();
          
          // Call send-email Edge Function
          const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
              to: args.to.includes(',') ? args.to.split(',').map(e => e.trim()) : args.to,
              subject: args.subject,
              body: args.body,
              reply_to: args.reply_to,
              is_html: args.is_html !== false,
              confirmed: true // Tool execution implies user confirmed
            }
          });
          
          if (error) {
            logger.error('[send_email] Edge Function error:', error);
            return { 
              success: false, 
              error: error.message || 'Failed to send email' 
            };
          }
          
          if (!data.success) {
            return {
              success: false,
              error: data.error || 'Email sending failed',
              rate_limit: data.rate_limit
            };
          }
          
          return {
            success: true,
            message_id: data.message_id,
            message: `Email sent successfully to ${args.to}`,
            rate_limit: data.rate_limit,
            warning: data.warning // For test mode
          };
        } catch (error) {
          logger.error('[send_email] Tool execution error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    // Context analysis tool
    this.register({
      name: 'get_screen_context',
      description: 'Get information about the current screen and available actions',
      parameters: {
        type: 'object',
        properties: {}
      },
      risk: 'low',
      execute: async () => {
        const module = await import('../DashAIAssistant');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash = DashClass?.getInstance?.();
        if (!dash) return { success: false, error: 'Dash not available' };
        const ctx =
          dash && typeof (dash as any).getCurrentScreenContext === 'function'
            ? (dash as any).getCurrentScreenContext()
            : { screen: 'unknown', capabilities: [], suggestions: [] };
        return ctx;
      }
    });

    // Task status tool
    this.register({
      name: 'get_active_tasks',
      description: 'Get list of active tasks and their status',
      parameters: {
        type: 'object',
        properties: {}
      },
      risk: 'low',
      execute: async () => {
        const module = await import('../DashAIAssistant');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash = DashClass?.getInstance?.();
        if (!dash) return { success: false, error: 'Dash not available' };
        return dash.getActiveTasks();
      }
    });

    // ========================================
    // NEW: Essential Data Access Tools
    // ========================================

    // Get member/student list
    this.register({
      name: 'get_member_list',
      description: 'Get list of members (students/employees/athletes) with optional filters by group',
      parameters: {
        type: 'object',
        properties: {
          group_id: {
            type: 'string',
            description: 'Filter by specific group/class/team ID'
          },
          include_inactive: {
            type: 'boolean',
            description: 'Include inactive members (default: false)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 50)'
          }
        }
      },
      risk: 'low',
      execute: async (args, context) => {
        try {
          const supabase = (await import('@/lib/supabase')).assertSupabase();
          const profile = await (await import('@/lib/sessionManager')).getCurrentProfile();
          
          if (!profile) {
            return { success: false, error: 'User not authenticated' };
          }

          // Use organization_id (Phase 6D compatible)
          const orgId = (profile as any).organization_id || (profile as any).preschool_id;
          
          if (!orgId) {
            return { success: false, error: 'No organization found for user' };
          }

          let query = supabase
            .from('students')
            .select('id, first_name, last_name, date_of_birth, classroom_id, status')
            .eq('preschool_id', orgId);

          if (args.group_id) {
            query = query.eq('classroom_id', args.group_id);
          }

          if (!args.include_inactive) {
            query = query.eq('status', 'active');
          }

          query = query.limit(args.limit || 50);

          const { data, error } = await query;

          if (error) {
            return { success: false, error: error.message };
          }

          return {
            success: true,
            count: data?.length || 0,
            members: data || [],
            organization_id: orgId
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    // Get member progress/grades
    this.register({
      name: 'get_member_progress',
      description: 'Get detailed progress and performance data for a specific member',
      parameters: {
        type: 'object',
        properties: {
          member_id: {
            type: 'string',
            description: 'ID of the member to get progress for'
          },
          subject: {
            type: 'string',
            description: 'Filter by specific subject (optional)'
          },
          date_range_days: {
            type: 'number',
            description: 'Number of days to look back (default: 30)'
          }
        },
        required: ['member_id']
      },
      risk: 'low',
      execute: async (args) => {
        try {
          const supabase = (await import('@/lib/supabase')).assertSupabase();
          
          // Get student info
          const { data: student, error: studentError } = await supabase
            .from('students')
            .select('id, first_name, last_name, classroom_id')
            .eq('id', args.member_id)
            .single();

          if (studentError || !student) {
            return { success: false, error: 'Member not found' };
          }

          // Get recent grades
          const daysBack = args.date_range_days || 30;
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - daysBack);

          let gradesQuery = supabase
            .from('grades')
            .select('subject, score, date_recorded, assignment_name')
            .eq('student_id', args.member_id)
            .gte('date_recorded', startDate.toISOString())
            .order('date_recorded', { ascending: false })
            .limit(20);

          if (args.subject) {
            gradesQuery = gradesQuery.eq('subject', args.subject);
          }

          const { data: grades, error: gradesError } = await gradesQuery;

          // Calculate average
          const avgScore = grades && grades.length > 0
            ? grades.reduce((sum, g) => sum + (g.score || 0), 0) / grades.length
            : null;

          return {
            success: true,
            member: {
              id: student.id,
              name: `${student.first_name} ${student.last_name}`
            },
            progress: {
              average_score: avgScore ? Math.round(avgScore * 10) / 10 : null,
              total_assessments: grades?.length || 0,
              recent_grades: grades || [],
              period_days: daysBack
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    // Get schedule/calendar
    this.register({
      name: 'get_schedule',
      description: 'Get schedule or calendar events for a date range',
      parameters: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: 'Start date (ISO format or "today", "tomorrow")'
          },
          days: {
            type: 'number',
            description: 'Number of days to show (default: 7)'
          }
        }
      },
      risk: 'low',
      execute: async (args) => {
        try {
          const supabase = (await import('@/lib/supabase')).assertSupabase();
          const profile = await (await import('@/lib/sessionManager')).getCurrentProfile();
          
          if (!profile) {
            return { success: false, error: 'User not authenticated' };
          }

          const orgId = (profile as any).organization_id || (profile as any).preschool_id;

          // Parse start date
          let startDate = new Date();
          if (args.start_date === 'tomorrow') {
            startDate.setDate(startDate.getDate() + 1);
          } else if (args.start_date && args.start_date !== 'today') {
            startDate = new Date(args.start_date);
          }
          startDate.setHours(0, 0, 0, 0);

          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + (args.days || 7));

          const { data: events, error } = await supabase
            .from('calendar_events')
            .select('id, title, description, event_date, event_type, location')
            .eq('organization_id', orgId)
            .gte('event_date', startDate.toISOString())
            .lte('event_date', endDate.toISOString())
            .order('event_date', { ascending: true })
            .limit(50);

          if (error) {
            return { success: false, error: error.message };
          }

          return {
            success: true,
            period: {
              start: startDate.toISOString().split('T')[0],
              end: endDate.toISOString().split('T')[0],
              days: args.days || 7
            },
            events: events || [],
            count: events?.length || 0
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    // Get assignments
    this.register({
      name: 'get_assignments',
      description: 'Get list of assignments with optional filters',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'submitted', 'graded', 'all'],
            description: 'Filter by assignment status (default: all)'
          },
          subject: {
            type: 'string',
            description: 'Filter by subject'
          },
          days_ahead: {
            type: 'number',
            description: 'Number of days to look ahead (default: 30)'
          }
        }
      },
      risk: 'low',
      execute: async (args) => {
        try {
          const supabase = (await import('@/lib/supabase')).assertSupabase();
          const profile = await (await import('@/lib/sessionManager')).getCurrentProfile();
          
          if (!profile) {
            return { success: false, error: 'User not authenticated' };
          }

          const orgId = (profile as any).organization_id || (profile as any).preschool_id;
          const userRole = (profile as any).role;

          const endDate = new Date();
          endDate.setDate(endDate.getDate() + (args.days_ahead || 30));

          let query = supabase
            .from('assignments')
            .select('id, title, description, subject, due_date, status, points_possible')
            .eq('school_id', orgId)
            .lte('due_date', endDate.toISOString())
            .order('due_date', { ascending: true })
            .limit(50);

          if (args.status && args.status !== 'all') {
            query = query.eq('status', args.status);
          }

          if (args.subject) {
            query = query.eq('subject', args.subject);
          }

          const { data: assignments, error } = await query;

          if (error) {
            return { success: false, error: error.message };
          }

          return {
            success: true,
            assignments: assignments || [],
            count: assignments?.length || 0,
            filters: {
              status: args.status || 'all',
              subject: args.subject,
              days_ahead: args.days_ahead || 30
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    // Get organization statistics
    this.register({
      name: 'get_organization_stats',
      description: 'Get comprehensive statistics about the organization (student counts, teacher counts, class counts, etc.)',
      parameters: {
        type: 'object',
        properties: {
          include_inactive: {
            type: 'boolean',
            description: 'Include inactive members (default: false)'
          }
        }
      },
      risk: 'low',
      execute: async (args) => {
        try {
          const supabase = (await import('@/lib/supabase')).assertSupabase();
          const profile = await (await import('@/lib/sessionManager')).getCurrentProfile();
          
          if (!profile) {
            return { success: false, error: 'User not authenticated' };
          }

          const orgId = (profile as any).organization_id || (profile as any).preschool_id;
          
          if (!orgId) {
            return { success: false, error: 'No organization found for user' };
          }

          // Get organization name
          const { data: org } = await supabase
            .from('preschools')
            .select('name, city, province')
            .eq('id', orgId)
            .single();

          // Count students
          let studentsQuery = supabase
            .from('students')
            .select('id, status', { count: 'exact', head: true })
            .eq('preschool_id', orgId);
          
          if (!args.include_inactive) {
            studentsQuery = studentsQuery.eq('status', 'active');
          }
          
          const { count: studentCount } = await studentsQuery;

          // Count teachers
          const { count: teacherCount } = await supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('preschool_id', orgId)
            .eq('role', 'teacher');

          // Count classes/classrooms
          const { count: classCount } = await supabase
            .from('classrooms')
            .select('id', { count: 'exact', head: true })
            .eq('preschool_id', orgId);

          // Get active students by status for more detail
          const { data: studentsByStatus } = await supabase
            .from('students')
            .select('status')
            .eq('preschool_id', orgId);

          const statusBreakdown = studentsByStatus?.reduce((acc: any, s: any) => {
            acc[s.status] = (acc[s.status] || 0) + 1;
            return acc;
          }, {});

          return {
            success: true,
            organization: {
              id: orgId,
              name: org?.name || 'Your Organization',
              location: org ? `${org.city}, ${org.province}` : null
            },
            statistics: {
              total_students: studentCount || 0,
              active_students: statusBreakdown?.active || 0,
              total_teachers: teacherCount || 0,
              total_classes: classCount || 0,
              student_status_breakdown: statusBreakdown || {}
            },
            summary: `${org?.name || 'Your organization'} has ${studentCount || 0} ${args.include_inactive ? 'total' : 'active'} students, ${teacherCount || 0} teachers, and ${classCount || 0} classes.`
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    // ========================================
    // NOTE: CAPS tools moved below to avoid duplication
    // See lines 1154+ for CAPS curriculum tools
    // ========================================

    // Analyze class performance
    this.register({
      name: 'analyze_class_performance',
      description: 'Analyze overall class or group performance with insights',
      parameters: {
        type: 'object',
        properties: {
          group_id: {
            type: 'string',
            description: 'ID of the class/group to analyze'
          },
          subject: {
            type: 'string',
            description: 'Filter by specific subject (optional)'
          },
          days_back: {
            type: 'number',
            description: 'Number of days to analyze (default: 30)'
          }
        }
      },
      risk: 'low',
      execute: async (args) => {
        try {
          const supabase = (await import('@/lib/supabase')).assertSupabase();
          const profile = await (await import('@/lib/sessionManager')).getCurrentProfile();
          
          if (!profile) {
            return { success: false, error: 'User not authenticated' };
          }

          const orgId = (profile as any).organization_id || (profile as any).preschool_id;

          // Get class info if group_id provided
          let className = 'All Classes';
          if (args.group_id) {
            const { data: classroom } = await supabase
              .from('classrooms')
              .select('name')
              .eq('id', args.group_id)
              .single();
            if (classroom) {
              className = classroom.name;
            }
          }

          // Get students in group
          let studentsQuery = supabase
            .from('students')
            .select('id, first_name, last_name')
            .eq('preschool_id', orgId)
            .eq('status', 'active');

          if (args.group_id) {
            studentsQuery = studentsQuery.eq('classroom_id', args.group_id);
          }

          const { data: students } = await studentsQuery;

          if (!students || students.length === 0) {
            return { success: false, error: 'No students found in group' };
          }

          // Get grades for analysis
          const daysBack = args.days_back || 30;
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - daysBack);

          const studentIds = students.map(s => s.id);

          let gradesQuery = supabase
            .from('grades')
            .select('student_id, subject, score, date_recorded')
            .in('student_id', studentIds)
            .gte('date_recorded', startDate.toISOString());

          if (args.subject) {
            gradesQuery = gradesQuery.eq('subject', args.subject);
          }

          const { data: grades } = await gradesQuery;

          // Calculate statistics
          const totalGrades = grades?.length || 0;
          const avgScore = grades && grades.length > 0
            ? grades.reduce((sum, g) => sum + (g.score || 0), 0) / grades.length
            : 0;

          // Find struggling students (below 60%)
          const studentScores = new Map<string, number[]>();
          grades?.forEach(g => {
            if (!studentScores.has(g.student_id)) {
              studentScores.set(g.student_id, []);
            }
            studentScores.get(g.student_id)?.push(g.score || 0);
          });

          const strugglingStudents = [];
          for (const [studentId, scores] of studentScores) {
            const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            if (avg < 60) {
              const student = students.find(s => s.id === studentId);
              if (student) {
                strugglingStudents.push({
                  id: studentId,
                  name: `${student.first_name} ${student.last_name}`,
                  average: Math.round(avg * 10) / 10
                });
              }
            }
          }

          return {
            success: true,
            group: {
              id: args.group_id,
              name: className,
              student_count: students.length
            },
            performance: {
              average_score: Math.round(avgScore * 10) / 10,
              total_assessments: totalGrades,
              period_days: daysBack,
              subject: args.subject || 'all subjects'
            },
            insights: {
              struggling_students: strugglingStudents,
              needs_attention: strugglingStudents.length > 0
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    });

    // ========================================
    // CAPS Curriculum Tools (South African CAPS Database)
    // ========================================

    // Search CAPS curriculum documents
    this.register({
      name: 'search_caps_curriculum',
      description: 'Search South African CAPS curriculum documents by topic, grade, or subject. Use this when teachers ask about curriculum requirements, learning outcomes, or official curriculum guidelines.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (topic, learning outcome, concept)'
          },
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "R-3", "4-6", "7-9", "10-12", or specific like "10")'
          },
          subject: {
            type: 'string',
            description: 'Subject name (e.g., Mathematics, English, Physical Sciences, Life Sciences)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 5)'
          }
        },
        required: ['query']
      },
      risk: 'low',
      execute: async (args) => {
        try {
          const CAPSService = await import('../DashCAPSKnowledge');
          const results = await CAPSService.searchCurriculum(args.query, {
            grade: args.grade,
            subject: args.subject,
            limit: args.limit || 5
          });

          if (results.length === 0) {
            return {
              success: true,
              found: false,
              message: `No CAPS documents found for "${args.query}"${args.grade ? ` in grade ${args.grade}` : ''}${args.subject ? ` for ${args.subject}` : ''}`
            };
          }

          return {
            success: true,
            found: true,
            count: results.length,
            documents: results.map(r => ({
              id: r.document.id,
              title: r.document.title,
              subject: r.document.subject,
              grade: r.document.grade,
              document_type: r.document.document_type,
              file_url: r.document.file_url,
              excerpt: r.excerpt || 'Preview not available',
              relevance: r.relevance_score
            }))
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to search CAPS curriculum'
          };
        }
      }
    });

    // Get CAPS documents for specific grade and subject
    this.register({
      name: 'get_caps_documents',
      description: 'Get official CAPS curriculum documents for a specific grade and subject. Returns the official Department of Basic Education curriculum documents.',
      parameters: {
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "R-3", "4-6", "7-9", "10-12")'
          },
          subject: {
            type: 'string',
            description: 'Subject name (e.g., Mathematics, English HL, Afrikaans, Physical Sciences)'
          }
        },
        required: ['grade', 'subject']
      },
      risk: 'low',
      execute: async (args) => {
        try {
          const CAPSService = await import('../DashCAPSKnowledge');
          const documents = await CAPSService.getDocumentsByGradeAndSubject(
            args.grade,
            args.subject
          );

          if (documents.length === 0) {
            return {
              success: true,
              found: false,
              message: `No CAPS documents found for ${args.subject} in grade ${args.grade}`
            };
          }

          return {
            success: true,
            found: true,
            count: documents.length,
            documents: documents.map(doc => ({
              id: doc.id,
              title: doc.title,
              subject: doc.subject,
              grade: doc.grade,
              document_type: doc.document_type,
              file_url: doc.file_url,
              year: doc.year,
              source: 'Department of Basic Education'
            }))
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get CAPS documents'
          };
        }
      }
    });

    // Get available CAPS subjects for a grade
    this.register({
      name: 'get_caps_subjects',
      description: 'Get list of available subjects in the CAPS curriculum database for a specific grade level.',
      parameters: {
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            description: 'Grade level (e.g., "R-3", "4-6", "7-9", "10-12")'
          }
        },
        required: ['grade']
      },
      risk: 'low',
      execute: async (args) => {
        try {
          const CAPSService = await import('../DashCAPSKnowledge');
          const subjects = await CAPSService.getSubjectsByGrade(args.grade);

          return {
            success: true,
            grade: args.grade,
            count: subjects.length,
            subjects: subjects
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get subjects'
          };
        }
      }
    });
  }

  // Get tools by risk level
  getToolsByRisk(riskLevel: 'low' | 'medium' | 'high'): AgentTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.risk === riskLevel);
  }

  // Get tool names for autocomplete
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  dispose(): void {
    this.tools.clear();
  }
}

// Singleton instance for current architecture
export const ToolRegistry = new DashToolRegistry();
