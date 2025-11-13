-- =============================================
-- POP Uploads Migration
-- Supports both Proof of Payment and Picture of Progress
-- =============================================

-- Create POP uploads table
CREATE TABLE public.pop_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Core fields
  student_id UUID NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  preschool_id UUID NOT NULL REFERENCES public.preschools (id) ON DELETE CASCADE,

  -- Upload type and metadata
  upload_type VARCHAR(20) NOT NULL CHECK (upload_type IN ('proof_of_payment', 'picture_of_progress')),
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- File storage
  file_path TEXT NOT NULL, -- Path in Supabase Storage
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(100) NOT NULL, -- MIME type

  -- Proof of Payment specific fields
  payment_amount DECIMAL(10, 2), -- Only for proof_of_payment
  payment_method VARCHAR(50), -- cash, bank_transfer, card, etc.
  payment_date DATE, -- When payment was made
  payment_reference VARCHAR(100), -- Bank reference, receipt number, etc.

  -- Picture of Progress specific fields
  subject VARCHAR(100), -- Math, English, Art, etc. Only for picture_of_progress
  achievement_level VARCHAR(50), -- excellent, good, needs_improvement, etc.
  learning_area TEXT, -- Specific learning area or skill demonstrated

  -- Approval workflow
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  reviewed_by UUID REFERENCES auth.users (id), -- Teacher/Principal who reviewed
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT, -- Feedback from reviewer

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_payment_fields CHECK (
    (upload_type = 'proof_of_payment' AND payment_amount IS NOT NULL AND payment_date IS NOT NULL)
    OR (upload_type = 'picture_of_progress' AND subject IS NOT NULL)
  ),
  CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 50000000), -- 50MB max
  CONSTRAINT valid_amount CHECK (payment_amount IS NULL OR payment_amount > 0)
);

-- Create indexes for performance
CREATE INDEX idx_pop_uploads_student_id ON public.pop_uploads (student_id);
CREATE INDEX idx_pop_uploads_preschool_id ON public.pop_uploads (preschool_id);
CREATE INDEX idx_pop_uploads_uploaded_by ON public.pop_uploads (uploaded_by);
CREATE INDEX idx_pop_uploads_type_status ON public.pop_uploads (upload_type, status);
CREATE INDEX idx_pop_uploads_created_at ON public.pop_uploads (created_at DESC);
CREATE INDEX idx_pop_uploads_payment_date ON public.pop_uploads (payment_date) WHERE upload_type = 'proof_of_payment';

-- Create updated_at trigger
CREATE TRIGGER update_pop_uploads_updated_at
BEFORE UPDATE ON public.pop_uploads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

ALTER TABLE public.pop_uploads ENABLE ROW LEVEL SECURITY;

-- Parents can insert POP uploads for their own children
CREATE POLICY "Parents can create POP uploads for their children"
ON public.pop_uploads FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students AS s
    WHERE
      s.parent_id = auth.uid()
      AND s.id = s.student_id
      AND s.is_active = TRUE
  )
);

-- Parents can view their own uploads
CREATE POLICY "Parents can view their own POP uploads"
ON public.pop_uploads FOR SELECT
USING (uploaded_by = auth.uid());

-- Parents can update their own pending uploads
CREATE POLICY "Parents can update their own pending uploads"
ON public.pop_uploads FOR UPDATE
USING (uploaded_by = auth.uid() AND status = 'pending')
WITH CHECK (uploaded_by = auth.uid());

-- Teachers can view uploads for their students
CREATE POLICY "Teachers can view POP uploads for their students"
ON public.pop_uploads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'teacher'
  )
  AND student_id IN (
    SELECT s.id FROM public.students AS s
    INNER JOIN public.classes AS c ON s.class_id = c.id
    WHERE c.teacher_id = auth.uid()
  )
);

-- Teachers can update upload status for their students
CREATE POLICY "Teachers can review POP uploads for their students"
ON public.pop_uploads FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'teacher'
  )
  AND student_id IN (
    SELECT s.id FROM public.students AS s
    INNER JOIN public.classes AS c ON s.class_id = c.id
    WHERE c.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'teacher'
  )
  AND student_id IN (
    SELECT s.id FROM public.students AS s
    INNER JOIN public.classes AS c ON s.class_id = c.id
    WHERE c.teacher_id = auth.uid()
  )
);

-- Principals can view and review all uploads in their preschool
CREATE POLICY "Principals can view all POP uploads in their preschool"
ON public.pop_uploads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'principal'
      AND u.preschool_id = pop_uploads.preschool_id
  )
);

CREATE POLICY "Principals can review all POP uploads in their preschool"
ON public.pop_uploads FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'principal'
      AND u.preschool_id = pop_uploads.preschool_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'principal'
      AND u.preschool_id = pop_uploads.preschool_id
  )
);

-- Superadmins can do everything
CREATE POLICY "Superadmins have full access to POP uploads"
ON public.pop_uploads FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'superadmin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE
      u.id = auth.uid()
      AND u.role = 'superadmin'
  )
);

-- =============================================
-- Utility Functions
-- =============================================

-- Function to get POP upload statistics for dashboard
CREATE OR REPLACE FUNCTION get_pop_upload_stats(
  target_student_id UUID DEFAULT NULL, target_preschool_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    user_role TEXT;
BEGIN
    -- Get user role
    SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
    
    -- Build stats based on role and parameters
    WITH stats AS (
        SELECT 
            upload_type,
            status,
            COUNT(*) as count,
            COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_count
        FROM public.pop_uploads
        WHERE 
            (target_student_id IS NULL OR student_id = target_student_id) AND
            (target_preschool_id IS NULL OR preschool_id = target_preschool_id) AND
            (
                -- Apply RLS-like filtering
                (user_role = 'parent' AND uploaded_by = auth.uid()) OR
                (user_role IN ('teacher', 'principal', 'superadmin'))
            )
        GROUP BY upload_type, status
    )
    SELECT json_build_object(
        'proof_of_payment', json_build_object(
            'pending', COALESCE((SELECT count FROM stats WHERE upload_type = 'proof_of_payment' AND status = 'pending'), 0),
            'approved', COALESCE((SELECT count FROM stats WHERE upload_type = 'proof_of_payment' AND status = 'approved'), 0),
            'rejected', COALESCE((SELECT count FROM stats WHERE upload_type = 'proof_of_payment' AND status = 'rejected'), 0),
            'recent', COALESCE((SELECT SUM(recent_count) FROM stats WHERE upload_type = 'proof_of_payment'), 0)
        ),
        'picture_of_progress', json_build_object(
            'pending', COALESCE((SELECT count FROM stats WHERE upload_type = 'picture_of_progress' AND status = 'pending'), 0),
            'approved', COALESCE((SELECT count FROM stats WHERE upload_type = 'picture_of_progress' AND status = 'approved'), 0),
            'rejected', COALESCE((SELECT count FROM stats WHERE upload_type = 'picture_of_progress' AND status = 'rejected'), 0),
            'recent', COALESCE((SELECT SUM(recent_count) FROM stats WHERE upload_type = 'picture_of_progress'), 0)
        ),
        'total_pending', COALESCE((SELECT SUM(count) FROM stats WHERE status = 'pending'), 0),
        'total_recent', COALESCE((SELECT SUM(recent_count) FROM stats), 0)
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Function to get recent POP uploads for a student (parent view)
CREATE OR REPLACE FUNCTION get_student_pop_uploads(target_student_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  upload_type VARCHAR(20),
  title VARCHAR(255),
  description TEXT,
  file_path TEXT,
  file_name VARCHAR(255),
  status VARCHAR(20),
  payment_amount DECIMAL(10, 2),
  payment_method VARCHAR(50),
  payment_date DATE,
  subject VARCHAR(100),
  achievement_level VARCHAR(50),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  reviewer_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pu.id,
        pu.upload_type,
        pu.title,
        pu.description,
        pu.file_path,
        pu.file_name,
        pu.status,
        pu.payment_amount,
        pu.payment_method,
        pu.payment_date,
        pu.subject,
        pu.achievement_level,
        pu.reviewed_by,
        pu.reviewed_at,
        pu.review_notes,
        pu.created_at,
        CASE 
            WHEN pu.reviewed_by IS NOT NULL THEN 
                (up_reviewer.first_name || ' ' || up_reviewer.last_name)
            ELSE NULL
        END as reviewer_name
    FROM public.pop_uploads pu
    LEFT JOIN public.users up_reviewer ON pu.reviewed_by = up_reviewer.id
    WHERE pu.student_id = target_student_id
    AND (
        -- Parent can see their own uploads
        pu.uploaded_by = auth.uid() OR
        -- Teachers/principals can see uploads for their students
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('teacher', 'principal', 'superadmin')
        )
    )
    ORDER BY pu.created_at DESC
    LIMIT limit_count;
END;
$$;
