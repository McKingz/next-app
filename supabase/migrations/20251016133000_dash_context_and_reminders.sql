-- ============================================
-- Dash Context + Reminders Schema
-- ============================================
-- Provides per-user context storage and reminders with strict RLS.
-- Depends on existing public.preschools and auth.users tables and profiles(preschool_id).
-- ============================================

-- dash_user_contexts: lightweight per-user context (language, timezone, traits)
CREATE TABLE IF NOT EXISTS public.dash_user_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  preferred_language text,
  timezone text,
  traits jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dash_user_contexts_preschool ON public.dash_user_contexts(preschool_id);

ALTER TABLE public.dash_user_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own context"
  ON public.dash_user_contexts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert their own context"
  ON public.dash_user_contexts FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND preschool_id IN (
      SELECT preschool_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own context"
  ON public.dash_user_contexts FOR UPDATE
  USING (user_id = auth.uid());

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public._touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dash_user_contexts_updated ON public.dash_user_contexts;
CREATE TRIGGER trg_dash_user_contexts_updated
  BEFORE UPDATE ON public.dash_user_contexts
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- dash_agent_instances: track active Dash agent sessions per user
CREATE TABLE IF NOT EXISTS public.dash_agent_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_active timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dash_agent_instances_user ON public.dash_agent_instances(user_id, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_dash_agent_instances_preschool ON public.dash_agent_instances(preschool_id, last_active DESC);

ALTER TABLE public.dash_agent_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their agent instances"
  ON public.dash_agent_instances FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their agent instances"
  ON public.dash_agent_instances FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND preschool_id IN (
      SELECT preschool_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their agent instances"
  ON public.dash_agent_instances FOR UPDATE
  USING (user_id = auth.uid());

-- dash_conversation_facts: structured facts extracted from conversations
CREATE TABLE IF NOT EXISTS public.dash_conversation_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  language text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dash_conversation_facts_user ON public.dash_conversation_facts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dash_conversation_facts_preschool ON public.dash_conversation_facts(preschool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dash_conversation_facts_key ON public.dash_conversation_facts(key);
CREATE INDEX IF NOT EXISTS idx_dash_conversation_facts_value_gin ON public.dash_conversation_facts USING gin(value);

ALTER TABLE public.dash_conversation_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversation facts"
  ON public.dash_conversation_facts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their conversation facts"
  ON public.dash_conversation_facts FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND preschool_id IN (
      SELECT preschool_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- dash_reminders: scheduled reminders requested by users
CREATE TABLE IF NOT EXISTS public.dash_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  triggered_at timestamptz,
  
  CONSTRAINT dash_reminders_status_check CHECK (status IN ('active','triggered','dismissed','snoozed')),
  CONSTRAINT dash_reminders_future_check CHECK (schedule_at > now() - interval '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_dash_reminders_due_active
  ON public.dash_reminders (schedule_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_dash_reminders_user_status
  ON public.dash_reminders (user_id, status);

ALTER TABLE public.dash_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their reminders"
  ON public.dash_reminders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their reminders"
  ON public.dash_reminders FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND preschool_id IN (
      SELECT preschool_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their reminders"
  ON public.dash_reminders FOR UPDATE
  USING (user_id = auth.uid());
