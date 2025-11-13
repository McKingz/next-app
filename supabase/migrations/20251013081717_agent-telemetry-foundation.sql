-- ============================================
-- AI Agent Telemetry Foundation
-- ============================================
-- Provides event tracking, feedback collection, and task execution history
-- for the enhanced Dash AI Assistant with strict RLS policies.
--
-- Tables:
-- - ai_events: Event tracking for all agent decisions and actions
-- - ai_feedback: User feedback on tasks and decisions
-- - ai_task_runs: Execution history for automated tasks
--
-- All tables enforce tenant isolation via preschool_id and RLS policies.
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: ai_events
-- Purpose: Track all agent decisions, actions, and behaviors
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT ai_events_event_type_check CHECK (
        event_type IN (
            'ai.agent.decision_made',
            'ai.agent.task_started',
            'ai.agent.task_completed',
            'ai.agent.task_failed',
            'ai.agent.proactive_offer_shown',
            'ai.agent.proactive_offer_accepted',
            'ai.agent.proactive_offer_dismissed',
            'ai.memory.write',
            'ai.memory.read',
            'ai.memory.prune',
            'ai.permissions.missing',
            'ai.autonomy.escalation',
            'ai.context.snapshot',
            'ai.insight.generated',
            'ai.workflow.branch',
            'ai.workflow.retry',
            'ai.error.recovery'
        )
    )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_events_preschool_created 
    ON public.ai_events(preschool_id, created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_ai_events_user_created 
    ON public.ai_events(user_id, created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_ai_events_type_created 
    ON public.ai_events(event_type, created_at DESC);

-- GIN index for JSONB payload queries
CREATE INDEX IF NOT EXISTS idx_ai_events_payload_gin 
    ON public.ai_events USING gin(payload);

-- Enable RLS
ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access events for their preschool
CREATE POLICY "Users can view their preschool's AI events"
    ON public.ai_events FOR SELECT
    USING (
        preschool_id IN (
            SELECT preschool_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert AI events for their preschool"
    ON public.ai_events FOR INSERT
    WITH CHECK (
        preschool_id IN (
            SELECT preschool_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- ============================================
-- TABLE: ai_feedback
-- Purpose: Collect user feedback on tasks and decisions
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id text,
    decision_id text,
    rating smallint CHECK (rating BETWEEN 1 AND 5),
    comment text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- At least one of task_id or decision_id must be provided
    CONSTRAINT ai_feedback_reference_check CHECK (
        task_id IS NOT NULL OR decision_id IS NOT NULL
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_feedback_preschool_created 
    ON public.ai_feedback(preschool_id, created_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_ai_feedback_task_id 
    ON public.ai_feedback(task_id) WHERE task_id IS NOT NULL;
    
CREATE INDEX IF NOT EXISTS idx_ai_feedback_decision_id 
    ON public.ai_feedback(decision_id) WHERE decision_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view feedback for their preschool"
    ON public.ai_feedback FOR SELECT
    USING (
        preschool_id IN (
            SELECT preschool_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can submit feedback for their preschool"
    ON public.ai_feedback FOR INSERT
    WITH CHECK (
        preschool_id IN (
            SELECT preschool_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- ============================================
-- TABLE: ai_task_runs
-- Purpose: Execution history for automated tasks and workflows
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_task_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id text NOT NULL,
    status text NOT NULL,
    steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    error text,
    metrics jsonb DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT ai_task_runs_status_check CHECK (
        status IN (
            'pending',
            'running',
            'completed',
            'failed',
            'cancelled',
            'paused'
        )
    ),
    CONSTRAINT ai_task_runs_finished_after_started CHECK (
        finished_at IS NULL OR finished_at >= started_at
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_task_runs_preschool_started 
    ON public.ai_task_runs(preschool_id, started_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_ai_task_runs_task_id_started 
    ON public.ai_task_runs(task_id, started_at DESC);
    
CREATE INDEX IF NOT EXISTS idx_ai_task_runs_status 
    ON public.ai_task_runs(status) WHERE status IN ('running', 'pending');

-- GIN index for JSONB columns
CREATE INDEX IF NOT EXISTS idx_ai_task_runs_steps_gin 
    ON public.ai_task_runs USING gin(steps);
    
CREATE INDEX IF NOT EXISTS idx_ai_task_runs_metrics_gin 
    ON public.ai_task_runs USING gin(metrics);

-- Enable RLS
ALTER TABLE public.ai_task_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view task runs for their preschool"
    ON public.ai_task_runs FOR SELECT
    USING (
        preschool_id IN (
            SELECT preschool_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert task runs for their preschool"
    ON public.ai_task_runs FOR INSERT
    WITH CHECK (
        preschool_id IN (
            SELECT preschool_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
        AND user_id = auth.uid()
    );

CREATE POLICY "Users can update their task runs"
    ON public.ai_task_runs FOR UPDATE
    USING (
        preschool_id IN (
            SELECT preschool_id 
            FROM public.profiles 
            WHERE id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.ai_events IS 
    'Event tracking for AI agent decisions, actions, and behaviors with tenant isolation';
    
COMMENT ON TABLE public.ai_feedback IS 
    'User feedback collection for AI tasks and decisions to support learning';
    
COMMENT ON TABLE public.ai_task_runs IS 
    'Execution history for automated tasks and workflows with detailed step tracking';

COMMENT ON COLUMN public.ai_events.event_type IS 
    'Type of event being tracked (e.g., decision_made, task_started)';
    
COMMENT ON COLUMN public.ai_events.payload IS 
    'JSONB payload containing event-specific data (decision rationale, task details, etc.)';
    
COMMENT ON COLUMN public.ai_task_runs.steps IS 
    'JSONB array of step execution details including rationales and outcomes';
    
COMMENT ON COLUMN public.ai_task_runs.metrics IS 
    'JSONB object containing performance metrics (duration, retries, confidence, etc.)';