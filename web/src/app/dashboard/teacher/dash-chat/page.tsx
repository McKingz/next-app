'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { TeacherShell } from '@/components/dashboard/teacher/TeacherShell';
import { ChatInterface } from '@/components/dash-chat/ChatInterface';
import { ConversationList } from '@/components/dash-chat/ConversationList';
import { ArrowLeft, Sparkles, Menu, X } from 'lucide-react';

export default function TeacherDashChatPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { 
        router.push('/sign-in'); 
        return; 
      }
      setEmail(session.user.email || '');
      setUserId(session.user.id);
      
      if (!activeConversationId) {
        setActiveConversationId(`dash_conv_${Date.now()}_${Math.random().toString(36).substring(7)}`);
      }
    })();
  }, [router, supabase.auth]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setShowSidebar(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleNewConversation = () => {
    const newId = `dash_conv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    setActiveConversationId(newId);
    if (isMobile) setShowSidebar(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    if (isMobile) setShowSidebar(false);
  };

  return (
    <TeacherShell tenantSlug={slug} userEmail={email}>
      <div className="container" style={{ maxWidth: 1400, padding: 0 }}>
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => router.push('/dashboard/teacher')}
              className="btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>

            {isMobile && (
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  padding: '8px 12px',
                  borderRadius: 8,
                }}
              >
                {showSidebar ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={20} color="white" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Dash Chat</h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                AI teaching assistant
              </p>
            </div>
          </div>

          <div style={{ width: isMobile ? 0 : 100 }} />
        </div>

        <div
          style={{
            display: 'flex',
            height: 'calc(100vh - 200px)',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: isMobile ? (showSidebar ? '100%' : 0) : 320,
              borderRight: isMobile ? 'none' : '1px solid var(--border)',
              overflow: 'hidden',
              transition: 'width 0.3s ease',
              position: isMobile ? 'absolute' : 'relative',
              height: '100%',
              zIndex: isMobile ? 10 : 1,
              background: 'var(--surface-0)',
            }}
          >
            {(!isMobile || showSidebar) && (
              <ConversationList
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
              />
            )}
          </div>

          <div
            style={{
              flex: 1,
              padding: 20,
              background: 'var(--surface-0)',
              display: isMobile && showSidebar ? 'none' : 'flex',
              flexDirection: 'column',
            }}
          >
            <ChatInterface
              conversationId={activeConversationId}
              onNewConversation={handleNewConversation}
            />
          </div>
        </div>

        {isMobile && showSidebar && (
          <div
            onClick={() => setShowSidebar(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 5,
            }}
          />
        )}
      </div>

      <div
        style={{
          margin: '20px auto',
          maxWidth: 1400,
          padding: '16px 24px',
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
          border: '1px solid rgba(124, 58, 237, 0.2)',
          borderRadius: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
          <Sparkles size={20} style={{ flexShrink: 0, marginTop: 2, color: '#7c3aed' }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              ✨ Dash Can Help Teachers With:
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              📝 Lesson planning • 📊 Assessment creation • 🎓 Educational content • 
              💡 Teaching strategies • 🔍 Resource suggestions • 📚 CAPS curriculum alignment
            </p>
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
