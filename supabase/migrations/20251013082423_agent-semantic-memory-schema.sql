-- ============================================
-- AI Agent Semantic Memory Schema
-- ============================================
-- Provides semantic memory storage with vector embeddings,
-- context snapshots, insights, and autonomy settings.
--
-- Tables:
-- - ai_memories: Semantic memory with vector embeddings
-- - ai_context_snapshots: Historical context data
-- - ai_insights: Aggregated insights and recommendations
-- - ai_autonomy_settings: Per-user autonomy configuration
--
-- All tables enforce tenant isolation via preschool_id and RLS policies.
-- ============================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- TABLE: ai_memories
-- Purpose: Store semantic memories with vector embeddings
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  text_embedding vector(1536),
  importance smallint NOT NULL DEFAULT 1,
  recency_score float8 NOT NULL DEFAULT 0,
  accessed_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT ai_memories_memory_type_check CHECK (
    memory_type IN (
      'preference',
      'fact',
      'context',
      'skill',
      'goal',
      'interaction',
      'relationship',
      'pattern',
      'insight',
      'episodic',
      'working',
      'semantic'
    )
  ),
  CONSTRAINT ai_memories_importance_check CHECK (
    importance BETWEEN 1 AND 10
  ),
  CONSTRAINT ai_memories_recency_score_check CHECK (
    recency_score >= 0
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_memories_preschool_created
  ON public.ai_memories(preschool_id, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_ai_memories_user_created
  ON public.ai_memories(user_id, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_ai_memories_type
  ON public.ai_memories(memory_type);
  
CREATE INDEX IF NOT EXISTS idx_ai_memories_importance
  ON public.ai_memories(importance DESC) WHERE importance >= 7;

-- IVFFlat index for vector similarity search
-- Uses cosine distance for semantic similarity
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding_ivfflat
  ON public.ai_memories
  USING ivfflat (text_embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE text_embedding IS NOT NULL;

-- GIN index for JSONB content queries
CREATE INDEX IF NOT EXISTS idx_ai_memories_content_gin
  ON public.ai_memories USING gin(content);

-- Enable RLS
ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access memories for their preschool
CREATE POLICY "Users can view their preschool's AI memories"
  ON public.ai_memories FOR SELECT
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert AI memories for their preschool"
  ON public.ai_memories FOR INSERT
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own AI memories"
  ON public.ai_memories FOR UPDATE
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can delete their own AI memories"
  ON public.ai_memories FOR DELETE
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- ============================================
-- TABLE: ai_context_snapshots
-- Purpose: Store historical context for cross-session continuity
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_context_snapshots_preschool_created
  ON public.ai_context_snapshots(preschool_id, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_ai_context_snapshots_user_created
  ON public.ai_context_snapshots(user_id, created_at DESC);

-- GIN index for JSONB snapshot queries
CREATE INDEX IF NOT EXISTS idx_ai_context_snapshots_snapshot_gin
  ON public.ai_context_snapshots USING gin(snapshot);

-- Enable RLS
ALTER TABLE public.ai_context_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their preschool's context snapshots"
  ON public.ai_context_snapshots FOR SELECT
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert context snapshots for their preschool"
  ON public.ai_context_snapshots FOR INSERT
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- ============================================
-- TABLE: ai_insights
-- Purpose: Aggregated insights and recommendations
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  confidence float8 NOT NULL DEFAULT 0.5,
  priority text NOT NULL DEFAULT 'medium',
  category text,
  data_sources jsonb DEFAULT '[]'::jsonb,
  actionable boolean NOT NULL DEFAULT false,
  suggested_actions jsonb DEFAULT '[]'::jsonb,
  impact_estimate jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  actioned_at timestamptz,
  
  -- Constraints
  CONSTRAINT ai_insights_insight_type_check CHECK (
    insight_type IN (
      'pattern',
      'recommendation',
      'prediction',
      'alert',
      'opportunity'
    )
  ),
  CONSTRAINT ai_insights_priority_check CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  ),
  CONSTRAINT ai_insights_confidence_check CHECK (
    confidence BETWEEN 0 AND 1
  ),
  CONSTRAINT ai_insights_status_check CHECK (
    status IN ('active', 'dismissed', 'actioned', 'expired')
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_insights_preschool_created
  ON public.ai_insights(preschool_id, created_at DESC);
  
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_status
  ON public.ai_insights(user_id, status) WHERE status = 'active';
  
CREATE INDEX IF NOT EXISTS idx_ai_insights_priority
  ON public.ai_insights(priority, created_at DESC) 
  WHERE status = 'active' AND priority IN ('high', 'urgent');
  
CREATE INDEX IF NOT EXISTS idx_ai_insights_actionable
  ON public.ai_insights(actionable, created_at DESC) 
  WHERE actionable = true AND status = 'active';

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_ai_insights_data_sources_gin
  ON public.ai_insights USING gin(data_sources);
  
CREATE INDEX IF NOT EXISTS idx_ai_insights_suggested_actions_gin
  ON public.ai_insights USING gin(suggested_actions);

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their preschool's AI insights"
  ON public.ai_insights FOR SELECT
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert AI insights for their preschool"
  ON public.ai_insights FOR INSERT
  WITH CHECK (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own AI insights"
  ON public.ai_insights FOR UPDATE
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- ============================================
-- TABLE: ai_autonomy_settings
-- Purpose: Per-user autonomy and behavior configuration
-- ============================================
CREATE TABLE IF NOT EXISTS public.ai_autonomy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  autonomy_level text NOT NULL DEFAULT 'assistant',
  risk_caps jsonb DEFAULT '{"high": false, "medium": true, "low": true}'::jsonb,
  quiet_hours jsonb DEFAULT '{"enabled": false, "start": "22:00", "end": "07:00"}'::jsonb,
  proactive_suggestions_enabled boolean NOT NULL DEFAULT true,
  auto_execute_low_risk boolean NOT NULL DEFAULT false,
  notification_preferences jsonb DEFAULT '{"in_app": true, "push": false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT ai_autonomy_settings_level_check CHECK (
    autonomy_level IN ('observer', 'assistant', 'partner', 'autonomous')
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_autonomy_settings_user
  ON public.ai_autonomy_settings(user_id);
  
CREATE INDEX IF NOT EXISTS idx_ai_autonomy_settings_preschool
  ON public.ai_autonomy_settings(preschool_id);

-- Enable RLS
ALTER TABLE public.ai_autonomy_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own autonomy settings"
  ON public.ai_autonomy_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own autonomy settings"
  ON public.ai_autonomy_settings FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own autonomy settings"
  ON public.ai_autonomy_settings FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to update recency scores based on access patterns
CREATE OR REPLACE FUNCTION update_memory_recency_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate recency score: newer memories and frequently accessed ones get higher scores
  NEW.recency_score := 1.0 / (1.0 + EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 86400.0)
                     + (NEW.accessed_count * 0.1);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update recency scores
CREATE TRIGGER trigger_update_memory_recency
  BEFORE UPDATE ON public.ai_memories
  FOR EACH ROW
  WHEN (OLD.accessed_count IS DISTINCT FROM NEW.accessed_count)
  EXECUTE FUNCTION update_memory_recency_score();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ai_autonomy_settings
CREATE TRIGGER trigger_ai_autonomy_settings_updated_at
  BEFORE UPDATE ON public.ai_autonomy_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.ai_memories IS 
  'Semantic memory storage with vector embeddings for intelligent context retrieval';
  
COMMENT ON TABLE public.ai_context_snapshots IS 
  'Historical context snapshots for cross-session continuity and state restoration';
  
COMMENT ON TABLE public.ai_insights IS 
  'Aggregated insights, recommendations, and proactive opportunities';
  
COMMENT ON TABLE public.ai_autonomy_settings IS 
  'Per-user configuration for AI agent autonomy level and behavior';

COMMENT ON COLUMN public.ai_memories.text_embedding IS 
  'Vector(1536) embedding from text-embedding-3-small for semantic similarity search';
  
COMMENT ON COLUMN public.ai_memories.importance IS 
  'Importance score from 1-10, used for memory consolidation and pruning';
  
COMMENT ON COLUMN public.ai_memories.recency_score IS 
  'Computed score combining recency and access frequency for retrieval ranking';
  
COMMENT ON COLUMN public.ai_insights.confidence IS 
  'Confidence level (0-1) in the insight based on data quality and patterns';
  
COMMENT ON COLUMN public.ai_autonomy_settings.autonomy_level IS 
  'Autonomy level: observer (passive), assistant (suggestive), partner (proactive), autonomous (independent)';