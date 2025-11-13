-- ============================================
-- Fix AI Conversations for Independent Parents
-- ============================================
-- Makes preschool_id optional and updates RLS policies
-- to support both organization-linked and independent users

-- 1. Make preschool_id optional
ALTER TABLE public.ai_conversations 
  ALTER COLUMN preschool_id DROP NOT NULL;

-- 2. Drop old RLS policies that required preschool_id
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can insert conversations for their preschool" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.ai_conversations;

-- 3. Create new simplified RLS policies (no preschool requirement)
CREATE POLICY "Users can view their own conversations"
  ON public.ai_conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own conversations"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own conversations"
  ON public.ai_conversations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own conversations"
  ON public.ai_conversations FOR DELETE
  USING (user_id = auth.uid());

-- 4. Superadmin can still view all (for monitoring)
CREATE POLICY "Superadmin can view all conversations"
  ON public.ai_conversations FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'superadmin'
    )
  );

-- 5. Add comment
COMMENT ON COLUMN public.ai_conversations.preschool_id IS 'Optional - NULL for independent parents, UUID for organization-linked users';
