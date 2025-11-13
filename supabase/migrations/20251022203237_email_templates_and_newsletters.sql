-- Email Templates and Newsletters System
-- Supports progress reports, newsletters, event reminders with rich HTML templates

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('progress_report', 'newsletter', 'event_reminder', 'invoice', 'welcome', 'custom')),
  subject_template TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  
  -- Template variables (JSON array of variable names)
  variables JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  is_system_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(preschool_id, name, template_type)
);

CREATE INDEX idx_email_templates_preschool ON email_templates(preschool_id);
CREATE INDEX idx_email_templates_type ON email_templates(template_type);

-- Email Logs Table (enhanced version - check if exists first)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs') THEN
    CREATE TABLE email_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID,
      preschool_id UUID REFERENCES preschools(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced', 'test_mode', 'queued')),
      
      message_id TEXT,
      error_message TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      
      -- Analytics
      opened_at TIMESTAMPTZ,
      clicked_at TIMESTAMPTZ,
      bounced_at TIMESTAMPTZ,
      
      created_at TIMESTAMPTZ DEFAULT now()
    );
    
    CREATE INDEX idx_email_logs_preschool ON email_logs(preschool_id);
    CREATE INDEX idx_email_logs_recipient ON email_logs(recipient);
    CREATE INDEX idx_email_logs_status ON email_logs(status);
    CREATE INDEX idx_email_logs_created ON email_logs(created_at DESC);
  END IF;
END $$;

-- Newsletters Table
CREATE TABLE IF NOT EXISTS newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  content_text TEXT,
  
  -- Scheduling
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  -- Recipients
  recipient_filter JSONB, -- e.g., {"roles": ["parent"], "classes": ["class-id"]}
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Tracking
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_newsletters_preschool ON newsletters(preschool_id);
CREATE INDEX idx_newsletters_status ON newsletters(status);
CREATE INDEX idx_newsletters_scheduled ON newsletters(scheduled_for);

-- Newsletter Recipients (for tracking individual sends)
CREATE TABLE IF NOT EXISTS newsletter_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  email TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_newsletter_recipients_newsletter ON newsletter_recipients(newsletter_id);
CREATE INDEX idx_newsletter_recipients_user ON newsletter_recipients(user_id);
CREATE INDEX idx_newsletter_recipients_email ON newsletter_recipients(email);

-- Progress Reports Table
CREATE TABLE IF NOT EXISTS progress_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID NOT NULL REFERENCES preschools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id),
  
  report_period TEXT NOT NULL, -- e.g., "Q1 2025", "Term 1"
  report_type TEXT DEFAULT 'quarterly' CHECK (report_type IN ('weekly', 'monthly', 'quarterly', 'annual')),
  
  -- Content
  overall_comments TEXT,
  teacher_comments TEXT,
  strengths TEXT,
  areas_for_improvement TEXT,
  
  -- Academic data (flexible JSON structure)
  subjects_performance JSONB, -- e.g., {"Math": {"grade": "A", "comments": "..."}, ...}
  attendance_summary JSONB,  -- e.g., {"present": 45, "absent": 2, "percentage": 95.7}
  behavioral_notes JSONB,
  
  -- Grading
  overall_grade TEXT,
  
  -- Email tracking
  email_sent_at TIMESTAMPTZ,
  email_message_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(student_id, report_period)
);

CREATE INDEX idx_progress_reports_preschool ON progress_reports(preschool_id);
CREATE INDEX idx_progress_reports_student ON progress_reports(student_id);
CREATE INDEX idx_progress_reports_teacher ON progress_reports(teacher_id);
CREATE INDEX idx_progress_reports_period ON progress_reports(report_period);

-- Email Preferences (opt-in/opt-out management)
CREATE TABLE IF NOT EXISTS email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  
  -- Preferences
  newsletters_enabled BOOLEAN DEFAULT true,
  progress_reports_enabled BOOLEAN DEFAULT true,
  event_reminders_enabled BOOLEAN DEFAULT true,
  marketing_enabled BOOLEAN DEFAULT false,
  
  unsubscribed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id)
);

CREATE INDEX idx_email_preferences_user ON email_preferences(user_id);
CREATE INDEX idx_email_preferences_email ON email_preferences(email);

-- RLS Policies

-- Email Templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their preschool templates"
  ON email_templates FOR SELECT
  USING (
    preschool_id IN (
      SELECT preschool_id FROM users WHERE auth_user_id = auth.uid()
    )
    OR is_system_template = true
  );

CREATE POLICY "Principals and admins can manage templates"
  ON email_templates FOR ALL
  USING (
    preschool_id IN (
      SELECT preschool_id FROM users 
      WHERE auth_user_id = auth.uid() 
        AND role IN ('principal', 'principal_admin', 'superadmin')
    )
  );

-- Newsletters
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their preschool newsletters"
  ON newsletters FOR SELECT
  USING (
    preschool_id IN (
      SELECT preschool_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Principals can manage newsletters"
  ON newsletters FOR ALL
  USING (
    preschool_id IN (
      SELECT preschool_id FROM users 
      WHERE auth_user_id = auth.uid() 
        AND role IN ('principal', 'principal_admin', 'superadmin')
    )
  );

-- Progress Reports
ALTER TABLE progress_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their students' reports"
  ON progress_reports FOR SELECT
  USING (
    teacher_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR preschool_id IN (
      SELECT preschool_id FROM users 
      WHERE auth_user_id = auth.uid() 
        AND role IN ('principal', 'principal_admin', 'superadmin')
    )
  );

CREATE POLICY "Teachers can create reports for their students"
  ON progress_reports FOR INSERT
  WITH CHECK (
    teacher_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Teachers can update their own reports"
  ON progress_reports FOR UPDATE
  USING (
    teacher_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Email Preferences
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences"
  ON email_preferences FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Insert default system templates
INSERT INTO email_templates (name, template_type, subject_template, body_html, body_text, is_system_template, variables) VALUES
('Progress Report', 'progress_report', '{{student_name}} - Progress Report for {{report_period}}', 
'<html><body><h1>Progress Report</h1><p>Dear {{parent_name}},</p><p>Here is the progress report for {{student_name}} for {{report_period}}.</p><h2>Overall Grade: {{overall_grade}}</h2><h3>Teacher Comments:</h3><p>{{teacher_comments}}</p><h3>Subjects Performance:</h3>{{subjects_table}}<p>Best regards,<br>{{teacher_name}}<br>{{preschool_name}}</p></body></html>',
'Progress Report\n\nDear {{parent_name}},\n\nHere is the progress report for {{student_name}} for {{report_period}}.\n\nOverall Grade: {{overall_grade}}\n\nTeacher Comments:\n{{teacher_comments}}\n\nBest regards,\n{{teacher_name}}\n{{preschool_name}}',
true,
'["student_name", "parent_name", "report_period", "overall_grade", "teacher_comments", "subjects_table", "teacher_name", "preschool_name"]'::jsonb),

('Monthly Newsletter', 'newsletter', '{{preschool_name}} - {{month}} Newsletter',
'<html><body><h1>{{preschool_name}} Newsletter</h1><h2>{{month}}</h2><div>{{content}}</div><p>Stay connected,<br>{{preschool_name}} Team</p></body></html>',
'{{preschool_name}} Newsletter\n\n{{month}}\n\n{{content}}\n\nStay connected,\n{{preschool_name}} Team',
true,
'["preschool_name", "month", "content"]'::jsonb)

ON CONFLICT DO NOTHING;

COMMENT ON TABLE email_templates IS 'Reusable email templates for progress reports, newsletters, and notifications';
COMMENT ON TABLE newsletters IS 'Newsletter campaigns sent to parents and staff';
COMMENT ON TABLE progress_reports IS 'Student progress reports generated by teachers';
COMMENT ON TABLE email_preferences IS 'User email subscription preferences and opt-outs';