// Minimal ai-usage edge function to satisfy CORS and basic actions
// Deno Deploy style function using Supabase Edge Functions runtime

// deno-lint-ignore no-explicit-any
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function ok(data: any = {}): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function bad(msg: string, code = 400): Response {
  return new Response(JSON.stringify({ error: msg }), { status: code, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') return ok({ status: 'ai-usage function online' });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').toLowerCase();

    // Helper: resolve AI service ID for a given model string
    async function resolveAiServiceId(supabase: any, model: string): Promise<string | null> {
      try {
        // Try exact model_version match first
        if (model) {
          const { data: exact } = await supabase
            .from('ai_services')
            .select('id')
            .eq('model_version', model)
            .maybeSingle();
          if (exact?.id) return exact.id;
        }
        // Heuristic fallback by common model families
        const family = (model || '').toLowerCase();
        const familyKey = family.includes('sonnet') ? 'sonnet'
          : family.includes('haiku') ? 'haiku'
          : family.includes('opus') ? 'opus'
          : null;
        if (familyKey) {
          const { data: fam } = await supabase
            .from('ai_services')
            .select('id, name, model_version')
            .ilike('name', `%${familyKey}%`)
            .maybeSingle();
          if (fam?.id) return fam.id;
        }
        // Final fallback: pick any active/available service
        const { data: anySvc } = await supabase
          .from('ai_services')
          .select('id')
          .limit(1)
          .maybeSingle();
        return anySvc?.id || null;
      } catch {
        return null;
      }
    }

    // Log AI usage event to database
    if (action === 'log') {
      const event = body.event;
      if (!event) return bad('event data required for log action', 400);
      
      try {
        // Get user from JWT token
        const authHeader = req.headers.get('authorization');
        if (!authHeader) return bad('Authorization required', 401);
        
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        });
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return bad('Invalid authentication', 401);
        
        // Get user profile for preschool_id
        const { data: profile } = await supabase
          .from('users')
          .select('id, preschool_id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        
        if (!profile) return bad('User profile not found', 404);

        // Resolve a valid ai_service_id for this model
        const aiServiceId = await resolveAiServiceId(supabase, event.model);
        
        // Log to ai_usage_logs table (matching actual schema)
        const { error: logError } = await supabase
          .from('ai_usage_logs')
          .insert({
            user_id: user.id, // auth.users id
            preschool_id: profile.preschool_id,
            organization_id: profile.preschool_id, // In this schema org == preschool
            ai_service_id: aiServiceId || '00000000-0000-0000-0000-000000000000', // fallback to a dummy value but should resolve
            ai_model_used: event.model,
            service_type: event.feature,
            input_tokens: event.tokensIn || 0,
            output_tokens: event.tokensOut || 0,
            total_cost: (event.estCostCents || 0) / 100.0,
            status: 'success',
          });
        
        if (logError) {
          console.error('Failed to log usage:', logError);
          return ok({ success: false, error: 'Failed to log usage' });
        }
        
        return ok({ success: true });
        
      } catch (error) {
        console.error('Log action error:', error);
        return ok({ success: false, error: 'Log processing failed' });
      }
    }
    
    // Bulk increment usage (for syncing accumulated local usage)
    if (action === 'bulk_increment') {
      const { feature, count } = body;
      if (!feature || !count || count <= 0) {
        return bad('feature and positive count required for bulk_increment', 400);
      }
      
      try {
        // Get user from JWT token
        const authHeader = req.headers.get('authorization');
        if (!authHeader) return bad('Authorization required', 401);
        
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        });
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return bad('Invalid authentication', 401);
        
        // Get user profile for preschool_id
        const { data: profile } = await supabase
          .from('users')
          .select('id, preschool_id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        
        if (!profile) return bad('User profile not found', 404);

        // Resolve any service to use for bulk sync entries
        const aiServiceId = await resolveAiServiceId(supabase, 'bulk_sync');
        
        // Create bulk log entries (one for each count)
        const logEntries = [] as any[];
        for (let i = 0; i < count; i++) {
          logEntries.push({
            user_id: user.id, // auth.users id
            preschool_id: profile.preschool_id,
            organization_id: profile.preschool_id,
            ai_service_id: aiServiceId || '00000000-0000-0000-0000-000000000000',
            ai_model_used: 'bulk_sync',
            service_type: feature,
            input_tokens: 0,
            output_tokens: 0,
            total_cost: 0,
            status: 'success',
          });
        }
        
        // Insert all entries at once
        const { error: bulkError } = await supabase
          .from('ai_usage_logs')
          .insert(logEntries);
        
        if (bulkError) {
          console.error('Bulk increment failed:', bulkError);
          return ok({ success: false, error: 'Bulk increment failed' });
        }
        
        console.log(`Successfully bulk incremented ${count} ${feature} usage for user ${user.id}`);
        return ok({ success: true, synced_count: count });
        
      } catch (error) {
        console.error('Bulk increment error:', error);
        return ok({ success: false, error: 'Bulk increment processing failed' });
      }
    }

    if (action === 'org_limits') {
      // Return placeholder limits so UI can render
      return ok({ quotas: { lesson_generation: 1000, grading_assistance: 1000, homework_help: 1000 }, used: { lesson_generation: 0, grading_assistance: 0, homework_help: 0 } });
    }

    if (action === 'set_allocation') {
      // Accept and acknowledge allocations
      return ok({ success: true });
    }

    if (action === 'school_subscription_details') {
      const preschoolId = body.preschool_id;
      if (!preschoolId) return bad('preschool_id required', 400);
      
      // Return mock subscription details for now
      return ok({
        preschool_id: preschoolId,
        subscription_tier: 'enterprise',
        org_type: 'preschool',
        total_quotas: {
          lesson_generation: 1000,
          grading_assistance: 800,
          homework_help: 500
        },
        allocated_quotas: {
          lesson_generation: 300,
          grading_assistance: 200,
          homework_help: 150
        },
        available_quotas: {
          lesson_generation: 700,
          grading_assistance: 600,
          homework_help: 350
        },
        total_usage: {
          lesson_generation: 50,
          grading_assistance: 30,
          homework_help: 25
        },
        allow_teacher_self_allocation: false,
        default_teacher_quotas: {
          lesson_generation: 50,
          grading_assistance: 30,
          homework_help: 20
        },
        max_individual_quota: {
          lesson_generation: 200,
          grading_assistance: 150,
          homework_help: 100
        },
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: 'system'
      });
    }

    if (action === 'get_teacher_allocation') {
      const preschoolId = body.preschool_id;
      const userId = body.user_id;
      if (!preschoolId || !userId) return bad('preschool_id and user_id required', 400);

      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Try to find existing allocation for current billing period
        const { data: existing, error: selErr } = await supabase
          .from('teacher_ai_allocations')
          .select('*')
          .eq('preschool_id', preschoolId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();

        if (selErr) {
          console.error('Select error in get_teacher_allocation:', selErr);
        }

        if (existing) {
          return ok({ allocation: existing });
        }

        // Fetch user for defaults
        const { data: user, error: userErr } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, role')
          .eq('id', userId)
          .maybeSingle();

        if (userErr || !user) {
          console.error('User fetch error in get_teacher_allocation:', userErr);
          return ok({ allocation: null });
        }

        const fullName = `${user.first_name || user.email?.split('@')[0] || 'Teacher'} ${user.last_name || ''}`.trim();
        const role = user.role || 'teacher';

        // Default quotas
        const defaultQuotas = role === 'principal' || role === 'principal_admin'
          ? { claude_messages: 200, content_generation: 50, assessment_ai: 100 }
          : { claude_messages: 50, content_generation: 10, assessment_ai: 25 };

        // Create new allocation with service role (bypasses RLS)
        const { data: inserted, error: insErr } = await supabase
          .from('teacher_ai_allocations')
          .insert({
            preschool_id: preschoolId,
            user_id: userId,
            teacher_name: fullName,
            teacher_email: user.email,
            role,
            allocated_quotas: defaultQuotas,
            used_quotas: { claude_messages: 0, content_generation: 0, assessment_ai: 0 },
            allocated_by: userId,
            allocation_reason: 'Auto-created default allocation',
            is_active: true,
            is_suspended: false,
            auto_renew: true,
            priority_level: 'normal',
          })
          .select('*')
          .single();

        if (insErr) {
          console.error('Insert error in get_teacher_allocation:', insErr);
          return ok({ allocation: null });
        }

        return ok({ allocation: inserted });
      } catch (fnErr) {
        console.error('Function error in get_teacher_allocation:', fnErr);
        return ok({ allocation: null });
      }
    }

    if (action === 'teacher_allocations') {
      const preschoolId = body.preschool_id;
      if (!preschoolId) return bad('preschool_id required', 400);
      
      // For now, we'll need to fetch real teachers from the database
      // This is a temporary implementation until full AI system is ready
      const allocations = [];
      
      try {
        // Import Supabase client in the function
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Fetch teachers from the users table
        const { data: teachers, error } = await supabase
          .from('users')
          .select('id, auth_user_id, email, role, first_name, last_name')
          .eq('preschool_id', preschoolId)
          .eq('role', 'teacher');
        
        if (error) {
          console.error('Error fetching teachers:', error);
          return ok({ allocations: [] });
        }
        
        // Convert teachers to allocation format
        const teacherAllocations = (teachers || []).map((teacher, index) => ({
          id: `alloc-${teacher.id}`,
          preschool_id: preschoolId,
          user_id: teacher.auth_user_id || teacher.id,
          teacher_id: teacher.id,
          teacher_name: `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email?.split('@')[0] || 'Unknown Teacher',
          teacher_email: teacher.email,
          role: teacher.role,
          allocated_quotas: {
            lesson_generation: 50 + (index * 10),
            grading_assistance: 30 + (index * 5),
            homework_help: 20 + (index * 3)
          },
          used_quotas: {
            lesson_generation: Math.floor(Math.random() * 25),
            grading_assistance: Math.floor(Math.random() * 15),
            homework_help: Math.floor(Math.random() * 10)
          },
          remaining_quotas: {
            lesson_generation: 40 - Math.floor(Math.random() * 15),
            grading_assistance: 25 - Math.floor(Math.random() * 10),
            homework_help: 15 - Math.floor(Math.random() * 5)
          },
          allocated_by: 'principal',
          allocated_at: new Date().toISOString(),
          allocation_reason: 'Initial allocation',
          is_active: true,
          is_suspended: false,
          auto_renew: true,
          priority_level: 'normal' as const,
          updated_at: new Date().toISOString()
        }));
        
        return ok({ allocations: teacherAllocations });
        
      } catch (dbError) {
        console.error('Database error:', dbError);
        return ok({ allocations: [] });
      }
    }

    // Get current user's usage statistics (default action when no action specified)
    if (!action || action === 'get_usage') {
      try {
        // Get user from JWT token
        const authHeader = req.headers.get('authorization');
        if (!authHeader) return ok({ lesson_generation: 0, grading_assistance: 0, homework_help: 0 });
        
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        });
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return ok({ lesson_generation: 0, grading_assistance: 0, homework_help: 0 });
        
        // Get user profile
        const { data: profile } = await supabase
          .from('users')
          .select('id, preschool_id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        
        if (!profile) return ok({ lesson_generation: 0, grading_assistance: 0, homework_help: 0 });
        
        // Get current month's usage from ai_usage_logs
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { data: usageLogs, error: usageError } = await supabase
          .from('ai_usage_logs')
          .select('service_type')
          .eq('user_id', user.id) // Use auth user id to match what we insert
          .gte('created_at', startOfMonth.toISOString());
        
        if (usageError) {
          console.error('Usage query error:', usageError);
          return ok({ lesson_generation: 0, grading_assistance: 0, homework_help: 0 });
        }
        
        // Count usage by feature
        const usageCounts = {
          lesson_generation: 0,
          grading_assistance: 0,
          homework_help: 0,
        };
        
        (usageLogs || []).forEach((log) => {
          if (log.service_type in usageCounts) {
            usageCounts[log.service_type as keyof typeof usageCounts]++;
          }
        });
        
        return ok(usageCounts);
        
      } catch (error) {
        console.error('Get usage error:', error);
        return ok({ lesson_generation: 0, grading_assistance: 0, homework_help: 0 });
      }
    }
    
    // Default response
    return ok({ ok: true });
  } catch (e) {
    return bad((e as Error)?.message || 'Unexpected error', 500);
  }
});
