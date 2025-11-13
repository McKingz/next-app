-- =============================================
-- EduDash Pro: Content Moderation System
-- Version: 1.0.0
-- Date: 2025-09-19
-- Purpose: Create comprehensive content moderation tables and functions
-- WARP.md Compliance: Migration-only, production-safe, forward-only
-- =============================================

BEGIN;

-- ============================================================================
-- TABLE: CONTENT_REPORTS
-- Purpose: Track user reports of inappropriate content
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  content_type VARCHAR(50) NOT NULL CHECK (
    content_type IN ('lesson', 'homework', 'message', 'comment', 'announcement', 'activity', 'assessment')
  ),
  content_id UUID NOT NULL, -- References the actual content (lessons, messages, etc.)
  content_title TEXT,
  content_excerpt TEXT,
  report_reason VARCHAR(100) NOT NULL,
  report_details TEXT,
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  school_id UUID REFERENCES public.preschools (id) ON DELETE SET NULL,
  author_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  auto_flagged BOOLEAN DEFAULT FALSE,

  -- Add indexes for performance
  CONSTRAINT content_reports_unique UNIQUE (reporter_id, content_type, content_id, report_reason)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports (status);
CREATE INDEX IF NOT EXISTS idx_content_reports_severity ON public.content_reports (severity);
CREATE INDEX IF NOT EXISTS idx_content_reports_school ON public.content_reports (school_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_author ON public.content_reports (author_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_created ON public.content_reports (created_at);

-- ============================================================================
-- TABLE: MODERATION_QUEUE
-- Purpose: Queue of items requiring moderation review
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL CHECK (
    content_type IN ('lesson', 'homework', 'message', 'comment', 'announcement', 'activity', 'assessment')
  ),
  content_id UUID NOT NULL,
  content_title TEXT NOT NULL,
  content_body TEXT,
  author_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  school_id UUID REFERENCES public.preschools (id) ON DELETE SET NULL,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5), -- 1 = highest priority
  flags TEXT [] DEFAULT '{}', -- Array of flag reasons
  report_count INTEGER DEFAULT 0,
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'escalated')),
  auto_flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  flagged_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON public.moderation_queue (status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_priority ON public.moderation_queue (priority);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_severity ON public.moderation_queue (severity);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_school ON public.moderation_queue (school_id);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_flagged ON public.moderation_queue (flagged_at);

-- ============================================================================
-- TABLE: MODERATION_ACTIONS
-- Purpose: Log of all moderation actions taken
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id UUID REFERENCES public.moderation_queue (id) ON DELETE CASCADE,
  moderator_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL CHECK (
    action IN ('approve', 'reject', 'flag', 'escalate', 'warn_author', 'suspend_user')
  ),
  reason TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Ensure we track the chain of actions
  previous_status VARCHAR(20),
  new_status VARCHAR(20)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_moderation_actions_queue ON public.moderation_actions (queue_item_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_moderator ON public.moderation_actions (moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_created ON public.moderation_actions (created_at);

-- ============================================================================
-- RPC FUNCTION: GET_MODERATION_ITEMS
-- Purpose: Get all items in moderation queue with filtering
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_moderation_items(
  p_status VARCHAR(20) DEFAULT NULL,
  p_severity VARCHAR(20) DEFAULT NULL,
  p_content_type VARCHAR(50) DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_items JSONB;
BEGIN
  -- Check if current user is superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = v_current_user_id 
    AND role = 'superadmin'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Superadmin access required');
  END IF;
  
  -- Get moderation queue items with author and school info
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', mq.id,
      'content_type', mq.content_type,
      'content_id', mq.content_id,
      'title', mq.content_title,
      'content', COALESCE(SUBSTRING(mq.content_body FROM 1 FOR 500), ''),
      'author_id', mq.author_id,
      'author_name', COALESCE(u.first_name || ' ' || u.last_name, u.first_name, 'Unknown Author'),
      'author_email', au.email,
      'school_id', mq.school_id,
      'school_name', COALESCE(p.name, 'Unknown School'),
      'status', mq.status,
      'flags', mq.flags,
      'report_count', mq.report_count,
      'severity', mq.severity,
      'priority', mq.priority,
      'auto_flagged', mq.auto_flagged,
      'created_at', mq.created_at,
      'flagged_at', mq.flagged_at,
      'reviewed_by', mq.reviewed_by,
      'reviewed_at', mq.reviewed_at,
      'review_notes', mq.review_notes
    )
  ) INTO v_items
  FROM public.moderation_queue mq
  LEFT JOIN public.users u ON mq.author_id = u.id
  LEFT JOIN auth.users au ON mq.author_id = au.id
  LEFT JOIN public.preschools p ON mq.school_id = p.id
  WHERE 
    (p_status IS NULL OR mq.status = p_status) AND
    (p_severity IS NULL OR mq.severity = p_severity) AND
    (p_content_type IS NULL OR mq.content_type = p_content_type)
  ORDER BY 
    mq.priority ASC,
    CASE mq.severity
      WHEN 'critical' THEN 4
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 1
    END DESC,
    mq.flagged_at DESC
  LIMIT p_limit;
  
  RETURN COALESCE(v_items, '[]'::jsonb);
END;
$$;

-- ============================================================================
-- RPC FUNCTION: MODERATE_CONTENT
-- Purpose: Take moderation action on content
-- ============================================================================

CREATE OR REPLACE FUNCTION public.moderate_content(
  p_queue_item_id UUID,
  p_action VARCHAR(30),
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_queue_item RECORD;
  v_new_status VARCHAR(20);
  v_result JSONB;
BEGIN
  -- Check if current user is superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = v_current_user_id 
    AND role = 'superadmin'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Superadmin access required');
  END IF;
  
  -- Get the queue item
  SELECT * INTO v_queue_item
  FROM public.moderation_queue
  WHERE id = p_queue_item_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Queue item not found');
  END IF;
  
  -- Determine new status based on action
  CASE p_action
    WHEN 'approve' THEN v_new_status := 'approved';
    WHEN 'reject' THEN v_new_status := 'rejected';
    WHEN 'escalate' THEN v_new_status := 'escalated';
    ELSE v_new_status := v_queue_item.status;
  END CASE;
  
  -- Update the queue item
  UPDATE public.moderation_queue
  SET 
    status = v_new_status,
    reviewed_by = v_current_user_id,
    reviewed_at = NOW(),
    review_notes = p_notes,
    updated_at = NOW()
  WHERE id = p_queue_item_id;
  
  -- Log the moderation action
  INSERT INTO public.moderation_actions (
    queue_item_id,
    moderator_id,
    action,
    reason,
    details,
    previous_status,
    new_status
  ) VALUES (
    p_queue_item_id,
    v_current_user_id,
    p_action,
    p_notes,
    json_build_object(
      'content_type', v_queue_item.content_type,
      'content_title', v_queue_item.content_title,
      'author_id', v_queue_item.author_id,
      'school_id', v_queue_item.school_id
    ),
    v_queue_item.status,
    v_new_status
  );
  
  -- Create notification for content author if rejected
  IF p_action = 'reject' AND v_queue_item.author_id IS NOT NULL THEN
    PERFORM create_system_notification(
      v_queue_item.author_id,
      'Content Moderation Update',
      'Your ' || v_queue_item.content_type || ' "' || v_queue_item.content_title || '" has been reviewed and requires attention.',
      'content_moderation',
      json_build_object(
        'action', p_action,
        'content_type', v_queue_item.content_type,
        'content_title', v_queue_item.content_title,
        'review_notes', p_notes
      )
    );
  END IF;
  
  -- Build result
  v_result := json_build_object(
    'success', TRUE,
    'queue_item_id', p_queue_item_id,
    'action', p_action,
    'new_status', v_new_status,
    'message', 'Content moderation action completed successfully'
  );
  
  RETURN v_result;
END;
$$;

-- ============================================================================
-- RPC FUNCTION: GET_MODERATION_STATS
-- Purpose: Get moderation statistics for dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_moderation_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_id UUID := auth.uid();
  v_stats JSONB;
  v_pending_count INTEGER;
  v_flagged_count INTEGER;
  v_critical_count INTEGER;
  v_total_reports INTEGER;
  v_resolved_today INTEGER;
BEGIN
  -- Check if current user is superadmin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = v_current_user_id 
    AND role = 'superadmin'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Superadmin access required');
  END IF;
  
  -- Get counts
  SELECT COUNT(*) INTO v_pending_count
  FROM public.moderation_queue
  WHERE status = 'pending';
  
  SELECT COUNT(*) INTO v_flagged_count
  FROM public.moderation_queue
  WHERE status IN ('pending', 'reviewing') AND auto_flagged = TRUE;
  
  SELECT COUNT(*) INTO v_critical_count
  FROM public.moderation_queue
  WHERE severity = 'critical' AND status IN ('pending', 'reviewing');
  
  SELECT COUNT(*) INTO v_total_reports
  FROM public.content_reports
  WHERE status = 'pending';
  
  SELECT COUNT(*) INTO v_resolved_today
  FROM public.moderation_queue
  WHERE DATE(reviewed_at) = CURRENT_DATE
  AND status IN ('approved', 'rejected');
  
  v_stats := json_build_object(
    'pending_items', v_pending_count,
    'auto_flagged_items', v_flagged_count,
    'critical_items', v_critical_count,
    'total_reports', v_total_reports,
    'resolved_today', v_resolved_today
  );
  
  RETURN v_stats;
END;
$$;

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_moderation_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_content TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_moderation_stats TO authenticated;

-- Set up RLS policies for content_reports
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view all reports" ON public.content_reports
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.users
  WHERE
    id = auth.uid()
    AND role = 'superadmin'
));

CREATE POLICY "Users can create reports" ON public.content_reports
FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

-- Set up RLS policies for moderation_queue
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage moderation queue" ON public.moderation_queue
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.users
  WHERE
    id = auth.uid()
    AND role = 'superadmin'
));

-- Set up RLS policies for moderation_actions
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view moderation actions" ON public.moderation_actions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.users
  WHERE
    id = auth.uid()
    AND role = 'superadmin'
));

CREATE POLICY "Superadmins can create moderation actions" ON public.moderation_actions
FOR INSERT TO authenticated
WITH CHECK (moderator_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.users
  WHERE
    id = auth.uid()
    AND role = 'superadmin'
));

-- ============================================================================
-- LOG MIGRATION COMPLETION
-- ============================================================================

INSERT INTO public.config_kv (key, value, description, is_public)
VALUES (
  'content_moderation_system_20250919231545',
  json_build_object(
    'version', '1.0.0',
    'completed_at', now()::TEXT,
    'tables_created', json_build_array(
      'content_reports',
      'moderation_queue',
      'moderation_actions'
    ),
    'functions_created', json_build_array(
      'get_moderation_items',
      'moderate_content',
      'get_moderation_stats'
    ),
    'migration_file', '20250919231545_content_moderation_system.sql'
  ),
  'Content moderation system completion log',
  FALSE
) ON CONFLICT (key) DO UPDATE SET
  value = excluded.value,
  updated_at = now();

SELECT 'CONTENT MODERATION SYSTEM COMPLETED' AS status;

COMMIT;
