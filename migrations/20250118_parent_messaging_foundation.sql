-- Migration: Parent Messaging Foundation
-- Creates tables for parent-teacher messaging with proper RLS policies
-- Follows WARP.md rules: migrations only, no resets, proper tenant isolation

-- Message Threads Table
CREATE TABLE IF NOT EXISTS message_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  preschool_id UUID NOT NULL REFERENCES preschools (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('parent-teacher', 'parent-principal', 'general')),
  student_id UUID REFERENCES students (id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Message Participants Table
CREATE TABLE IF NOT EXISTS message_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES message_threads (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('parent', 'teacher', 'principal', 'admin')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  is_muted BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (thread_id, user_id)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES message_threads (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'system')),
  created_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_threads_preschool_id ON message_threads (preschool_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_student_id ON message_threads (student_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message_at ON message_threads (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_participants_user_id ON message_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_message_participants_thread_id ON message_participants (thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id_created_at ON messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);

-- RLS Policies

-- Message Threads: Users can see threads they participate in within their preschool
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_threads_select_policy ON message_threads
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM message_participants AS mp
    WHERE
      mp.thread_id = message_threads.id
      AND mp.user_id = auth.uid()
  )
);

CREATE POLICY message_threads_insert_policy ON message_threads
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE
      p.id = auth.uid()
      AND p.preschool_id = message_threads.preschool_id
      AND p.role IN ('parent', 'teacher', 'principal', 'admin')
  )
);

CREATE POLICY message_threads_update_policy ON message_threads
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM message_participants AS mp
    WHERE
      mp.thread_id = message_threads.id
      AND mp.user_id = auth.uid()
  )
);

-- Message Participants: Users can see participants in threads they're part of
ALTER TABLE message_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_participants_select_policy ON message_participants
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM message_participants AS mp2
    WHERE
      mp2.thread_id = message_participants.thread_id
      AND mp2.user_id = auth.uid()
  )
);

CREATE POLICY message_participants_insert_policy ON message_participants
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM message_participants AS mp
    WHERE
      mp.thread_id = message_participants.thread_id
      AND mp.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM message_threads AS mt
    WHERE
      mt.id = message_participants.thread_id
      AND mt.created_by = auth.uid()
  )
);

-- Messages: Users can see messages in threads they participate in
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_policy ON messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM message_participants AS mp
    WHERE
      mp.thread_id = messages.thread_id
      AND mp.user_id = auth.uid()
  )
);

CREATE POLICY messages_insert_policy ON messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM message_participants AS mp
    WHERE
      mp.thread_id = messages.thread_id
      AND mp.user_id = auth.uid()
  )
);

CREATE POLICY messages_update_policy ON messages
FOR UPDATE USING (
  sender_id = auth.uid()
  AND deleted_at IS NULL
);

-- Triggers to maintain last_message_at
CREATE OR REPLACE FUNCTION update_thread_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE message_threads 
    SET 
        last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thread_last_message_at ON messages;
CREATE TRIGGER trigger_update_thread_last_message_at
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_thread_last_message_at();

-- Function to get or create a parent-teacher thread for a student
CREATE OR REPLACE FUNCTION get_or_create_parent_teacher_thread(
  p_student_id UUID,
  p_parent_id UUID
)
RETURNS UUID AS $$
DECLARE
    thread_id UUID;
    student_record RECORD;
    teacher_id UUID;
BEGIN
    -- Get student info
    SELECT s.preschool_id, s.class_id, c.teacher_id
    INTO student_record
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    WHERE s.id = p_student_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found';
    END IF;
    
    teacher_id := student_record.teacher_id;
    
    -- Try to find existing thread
    SELECT mt.id INTO thread_id
    FROM message_threads mt
    JOIN message_participants mp1 ON mt.id = mp1.thread_id AND mp1.user_id = p_parent_id AND mp1.role = 'parent'
    JOIN message_participants mp2 ON mt.id = mp2.thread_id AND mp2.user_id = teacher_id AND mp2.role = 'teacher'
    WHERE mt.student_id = p_student_id
    AND mt.type = 'parent-teacher'
    LIMIT 1;
    
    -- If no existing thread, create one
    IF thread_id IS NULL THEN
        -- Create thread
        INSERT INTO message_threads (preschool_id, type, student_id, subject, created_by)
        VALUES (
            student_record.preschool_id,
            'parent-teacher',
            p_student_id,
            'Student Discussion',
            p_parent_id
        )
        RETURNING id INTO thread_id;
        
        -- Add parent as participant
        INSERT INTO message_participants (thread_id, user_id, role)
        VALUES (thread_id, p_parent_id, 'parent');
        
        -- Add teacher as participant (if teacher exists)
        IF teacher_id IS NOT NULL THEN
            INSERT INTO message_participants (thread_id, user_id, role)
            VALUES (thread_id, teacher_id, 'teacher');
        END IF;
    END IF;
    
    RETURN thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_or_create_parent_teacher_thread TO authenticated;
GRANT SELECT, INSERT, UPDATE ON message_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON message_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;
