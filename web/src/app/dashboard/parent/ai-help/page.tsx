'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { SubPageHeader } from '@/components/dashboard/SubPageHeader';
import { Sparkles, MessageCircle, Brain } from 'lucide-react';

export default function AIHelpPage() {
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
          title="AI Help & Tutoring"
          subtitle="Get instant homework help and explanations from our AI tutor"
          icon={<Sparkles size={28} color="white" />}
        />
        
        <div style={{ width: '100%', padding: 0 }}>
          <div className="section" style={{ margin: 0 }}>
            <div className="card" style={{
              padding: '32px 20px',
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, rgba(219, 39, 119, 0.05) 100%)',
              border: '1px solid rgba(236, 72, 153, 0.2)',
              borderRadius: 0,
              width: '100%'
            }}>
                            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: 18 }}>AI Tutor Features 🤖</h3>
              <p style={{ color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Get instant help with homework and studying:
              </p>
              <ul style={{ marginLeft: 20, marginBottom: 20, lineHeight: 1.8 }}>
                <li>💬 Natural conversation interface</li>
                <li>📚 Subject-specific explanations</li>
                <li>🔢 Step-by-step problem solving</li>
                <li>🎙️ Voice interaction support</li>
                <li>🌍 Multi-language support</li>
                <li>✅ Homework checking and feedback</li>
              </ul>

              <div style={{
                padding: 16,
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: 8,
                border: '1px solid rgba(16, 185, 129, 0.3)',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                  <Brain size={20} style={{ marginTop: 2, flexShrink: 0, color: '#10b981' }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                      ✨ Dash Chat is Now Available!
                    </p>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
                      Full conversational AI with image upload, continuous chat, and conversation history!
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
                <button
                  onClick={() => router.push('/dashboard/parent/dash-chat')}
                  className="btn btnPrimary"
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 24px',
                    fontSize: 15,
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                    border: 'none',
                  }}
                >
                  <Sparkles size={18} />
                  Open Dash Chat
                </button>
                <button
                  onClick={() => router.push('/dashboard/parent')}
                  className="btn"
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 24px',
                    fontSize: 15,
                    fontWeight: 600,
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <MessageCircle size={18} />
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ParentShell>
  );
}
