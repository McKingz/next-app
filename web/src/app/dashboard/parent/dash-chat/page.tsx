'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import { ChatInterface } from '@/components/dash-chat/ChatInterface';
import { ConversationList } from '@/components/dash-chat/ConversationList';
import { ExamBuilderLauncher } from '@/components/dash-chat/ExamBuilderLauncher';
import { ArrowLeft, Sparkles, Menu, X, FileText } from 'lucide-react';

export default function DashChatPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState<string>('');
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showExamBuilder, setShowExamBuilder] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { 
        router.push('/sign-in'); 
        return; 
      }
      setEmail(session.user.email || '');
      setUserId(session.user.id);
      
      // Generate initial conversation ID
      if (!activeConversationId) {
        setActiveConversationId(`dash_conv_${Date.now()}_${Math.random().toString(36).substring(7)}`);
      }
    })();
  }, [router, supabase.auth, activeConversationId]);

  // Detect mobile
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
    <ParentShell tenantSlug={slug} userEmail={email}>
      <div style={{ 
        margin: 'calc(var(--space-3) * -1) calc(var(--space-2) * -1)', 
        marginBottom: 'calc(var(--bottomnav-h, 0px) * -1)',
        padding: 0, 
        height: '100vh',
        maxHeight: '100vh',
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div
          style={{
            padding: isMobile ? '10px 16px' : '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  padding: '8px',
                  borderRadius: 8,
                }}
              >
                {showSidebar ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: isMobile ? 32 : 40,
                  height: isMobile ? 32 : 40,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={isMobile ? 18 : 22} color="white" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: isMobile ? 16 : 18, fontWeight: 700 }}>Dash</h1>
                <p style={{ margin: 0, fontSize: isMobile ? 11 : 12, color: 'var(--muted)' }}>
                  AI Assistant • Multilingual • Context-aware
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setShowExamBuilder(true)}
              className="btn"
              style={{
                padding: isMobile ? '6px 12px' : '8px 16px',
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
                color: 'white',
                border: 'none',
              }}
            >
              <FileText size={14} />
              {!isMobile && 'Create Exam'}
            </button>
            <button
              onClick={handleNewConversation}
              className="btn btnPrimary"
              style={{
                padding: isMobile ? '6px 12px' : '8px 16px',
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Sparkles size={14} />
              {!isMobile && 'New Chat'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {/* Sidebar - Conversation List */}
          {!isMobile && (
            <div
              style={{
                width: 280,
                borderRight: '1px solid var(--border)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface-0)',
              }}
            >
              <ConversationList
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
              />
            </div>
          )}

          {/* Mobile Sidebar Overlay */}
          {isMobile && showSidebar && (
            <>
              <div
                onClick={() => setShowSidebar(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.6)',
                  zIndex: 999,
                }}
              />
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: '85%',
                  maxWidth: '320px',
                  background: 'var(--surface-0)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '4px 0 12px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div style={{ 
                  padding: '16px', 
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Conversations</h2>
                  <button
                    onClick={() => setShowSidebar(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 8,
                      cursor: 'pointer',
                      color: 'var(--text)',
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
                <ConversationList
                  activeConversationId={activeConversationId}
                  onSelectConversation={handleSelectConversation}
                  onNewConversation={handleNewConversation}
                />
              </div>
            </>
          )}

          {/* Chat Area */}
          <div
            style={{
              flex: 1,
              background: 'var(--surface-0)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
              position: 'relative',
            }}
          >
            <ChatInterface
              conversationId={activeConversationId}
              onNewConversation={handleNewConversation}
            />
            
            {/* Exam Builder Modal */}
            {showExamBuilder && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 100,
              }}>
                <ExamBuilderLauncher onClose={() => setShowExamBuilder(false)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </ParentShell>
  );
}
