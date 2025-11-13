'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { SubPageHeader } from '@/components/dashboard/SubPageHeader';
import { BookOpen, Sparkles } from 'lucide-react';

export default function LessonsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/sign-in'); return; }
      setEmail(session.user.email || '');
      setUserId(session.user.id);
    })();
  }, [router, supabase.auth]);

  return (
    <ParentShell tenantSlug={slug} userEmail={email}>
      <div style={{ margin: 'calc(var(--space-3) * -1) calc(var(--space-2) * -1)', padding: 0 }}>
        <SubPageHeader 
          title="Lessons Library"
          subtitle="Interactive lessons aligned with the CAPS curriculum"
          icon={<BookOpen size={28} color="white" />}
        />
        
        <div style={{ width: '100%', padding: 0 }}>
          <div className="section" style={{ margin: 0 }}>
            <div className="card" style={{
              padding: '32px 20px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 0,
              width: '100%'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>Coming Soon! 📚</h3>
              <p style={{ color: 'var(--muted)', marginBottom: 16, fontSize: 14 }}>
                We're building an incredible lesson library for you. Here's what's coming:
              </p>
              <ul style={{ color: 'var(--muted)', marginLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
                <li>✅ CAPS-aligned curriculum for all grades</li>
                <li>🎥 Video lessons with interactive elements</li>
                <li>✍️ Practice exercises and quizzes</li>
                <li>📊 Progress tracking per subject</li>
              </ul>
              
              <div style={{
                padding: 16,
                background: 'var(--surface-1)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                marginTop: 16
              }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
                  💡 <strong>In the meantime:</strong> Try our AI Help feature to get instant homework assistance and explanations!
                </p>
              </div>

              <button
                onClick={() => router.push('/dashboard/parent/ai-help')}
                className="btn btnPrimary"
                style={{
                  marginTop: 24,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 24px',
                  fontSize: 15,
                  fontWeight: 600
                }}
              >
                <Sparkles size={18} />
                Try AI Help
              </button>
            </div>
          </div>
        </div>
      </div>
    </ParentShell>
  );
}
