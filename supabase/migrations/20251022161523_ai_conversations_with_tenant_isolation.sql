-- ============================================
-- AI Conversations with Tenant Isolation
-- ============================================
-- Stores Dash AI conversation history in Supabase with proper multi-tenant RLS.
-- Migrates from AsyncStorage-only approach to server-backed storage.
-- ============================================

-- ai_conversations: store full conversation history with tenant isolation
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preschool_id uuid NOT NULL REFERENCES public.preschools(id) ON DELETE CASCADE,
  conversation_id text NOT NULL UNIQUE,
  title text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT ai_conversations_messages_is_array CHECK (jsonb_typeof(messages) = 'array')
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated 
  ON public.ai_conversations(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_preschool_updated 
  ON public.ai_conversations(preschool_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_conversation_id 
  ON public.ai_conversations(conversation_id);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own conversations in their preschool
CREATE POLICY "Users can view their own conversations"
  ON public.ai_conversations FOR SELECT
  USING (
    user_id = auth.uid() AND 
    preschool_id IN (
      SELECT preschool_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can insert conversations for their preschool only
CREATE POLICY "Users can insert conversations for their preschool"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND 
    preschool_id IN (
      SELECT preschool_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own conversations in their preschool
CREATE POLICY "Users can update their own conversations"
  ON public.ai_conversations FOR UPDATE
  USING (
    user_id = auth.uid() AND 
    preschool_id IN (
      SELECT preschool_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can delete their own conversations in their preschool
CREATE POLICY "Users can delete their own conversations"
  ON public.ai_conversations FOR DELETE
  USING (
    user_id = auth.uid() AND 
    preschool_id IN (
      SELECT preschool_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Update trigger for updated_at
DROP TRIGGER IF EXISTS trg_ai_conversations_updated ON public.ai_conversations;
CREATE TRIGGER trg_ai_conversations_updated
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- Comment for documentation
COMMENT ON TABLE public.ai_conversations IS 'Stores Dash AI conversation history with multi-tenant RLS isolation. Replaces AsyncStorage-only approach.';
COMMENT ON COLUMN public.ai_conversations.messages IS 'JSONB array of messages with structure: {id, type, content, timestamp, meta}';
COMMENT ON COLUMN public.ai_conversations.conversation_id IS 'Client-generated conversation ID (e.g., dash_conv_timestamp_random)';