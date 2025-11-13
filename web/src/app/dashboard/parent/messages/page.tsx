'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenantSlug } from '@/lib/tenant/useTenantSlug';
import { useUserProfile } from '@/lib/hooks/useUserProfile';
import { ParentShell } from '@/components/dashboard/parent/ParentShell';
import type { MessageThread } from '@/lib/hooks/parent/useParentMessaging';
import { MessageSquare, Send, Search, ArrowLeft, User, School, ChevronRight } from 'lucide-react';

// Disable static generation for this page
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

// Format timestamp for message threads
const formatMessageTime = (timestamp: string): string => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInHours = Math.abs(now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 168) { // 7 days
    return messageTime.toLocaleDateString([], { weekday: 'short' });
  } else {
    return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

// Thread item component
interface ThreadItemProps {
  thread: MessageThread;
  onPress: () => void;
}

const ThreadItem: React.FC<ThreadItemProps> = ({ thread, onPress }) => {
  // Get the other participant (teacher/principal)
  const otherParticipant = thread.participants?.find(p => p.role !== 'parent');
  const participantName = otherParticipant?.user_profile ? 
    `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`.trim() :
    'Teacher';
    
  const participantRole = otherParticipant?.user_profile?.role || 'teacher';
  
  // Student name for context
  const studentName = thread.student ? 
    `${thread.student.first_name} ${thread.student.last_name}`.trim() :
    'General';
  
  const hasUnread = (thread.unread_count || 0) > 0;
  
  return (
    <div
      onClick={onPress}
      className="card"
      style={{
        padding: '16px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        borderLeft: hasUnread ? '4px solid var(--primary)' : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        background: 'var(--primary-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        flexShrink: 0
      }}>
        {participantRole === 'principal' ? (
          <School size={24} color="var(--primary)" />
        ) : (
          <User size={24} color="var(--primary)" />
        )}
      </div>
      
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{
            fontSize: 16,
            fontWeight: hasUnread ? 700 : 600,
            color: 'var(--text-primary)'
          }}>
            {participantName}
          </span>
          {thread.last_message && (
            <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {formatMessageTime(thread.last_message.created_at)}
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--primary)', textTransform: 'capitalize' }}>
            {participantRole}
          </span>
          {thread.student && (
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
              ? {studentName}
            </span>
          )}
        </div>
        
        {thread.last_message ? (
          <p style={{
            fontSize: 14,
            color: hasUnread ? 'var(--text-primary)' : 'var(--muted)',
            fontWeight: hasUnread ? 500 : 400,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {thread.last_message.content}
          </p>
        ) : (
          <p style={{
            fontSize: 14,
            color: 'var(--muted)',
            fontStyle: 'italic',
            margin: 0
          }}>
            No messages yet
          </p>
        )}
      </div>
      
      {/* Right section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 12 }}>
        <ChevronRight size={16} color="var(--muted)" />
        {hasUnread && (
          <div style={{
            background: 'var(--primary)',
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 4,
            padding: '0 6px'
          }}>
            <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>
              {thread.unread_count && thread.unread_count > 9 ? '9+' : thread.unread_count}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function MessagesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string>();
  const [userId, setUserId] = useState<string>();
  const { slug } = useTenantSlug(userId);
  const { profile, loading: profileLoading } = useUserProfile(userId);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch threads function
  const fetchThreads = async () => {
    if (!userId) return;
    
    setThreadsLoading(true);
    try {
      const { data, error: threadsError } = await supabase
        .from('message_threads')
        .select('*, participants(*), student:students(*), last_message:messages(*)')
        .eq('created_by', userId)
        .order('last_message_at', { ascending: false });
      
      if (threadsError) throw threadsError;
      setThreads((data as any[]) || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setThreadsLoading(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/sign-in');
        return;
      }

      setUserEmail(session.user.email);
      setUserId(session.user.id);
      setLoading(false);
    };

    initAuth();
  }, [router, supabase]);

  // Wrap fetchThreads in useCallback to avoid infinite re-renders
  useEffect(() => {
    fetchThreads();
  }, [userId, supabase]);

  // Filter threads based on search query
  const filteredThreads = threads?.filter(thread => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const participant = thread.participants?.find(p => p.role !== 'parent');
    const participantName = participant?.user_profile ? 
      `${participant.user_profile.first_name} ${participant.user_profile.last_name}`.toLowerCase() :
      '';
    const studentName = thread.student ? 
      `${thread.student.first_name} ${thread.student.last_name}`.toLowerCase() :
      '';
    const lastMessage = thread.last_message?.content.toLowerCase() || '';
    
    return participantName.includes(query) || 
           studentName.includes(query) || 
           lastMessage.includes(query) ||
           thread.subject.toLowerCase().includes(query);
  });

  if (loading || profileLoading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const totalUnread = threads?.reduce((sum, thread) => sum + (thread.unread_count || 0), 0) || 0;

  return (
    <ParentShell 
      tenantSlug={slug} 
      userEmail={userEmail} 
      userName={profile?.firstName}
      preschoolName={profile?.preschoolName}
      unreadCount={totalUnread}
    >
      <div className="container">
        {/* Header */}
        <div className="section">
          <h1 className="h1">Messages</h1>
          <p className="muted">Communicate with teachers and school staff</p>
        </div>

        {/* Search Bar */}
        <div className="section">
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px 12px 44px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--surface-1)',
                color: 'var(--text-primary)',
                fontSize: 15,
                outline: 'none'
              }}
            />
            <Search 
              size={20} 
              color="var(--muted)" 
              style={{ 
                position: 'absolute', 
                left: 14, 
                top: '50%', 
                transform: 'translateY(-50%)' 
              }} 
            />
          </div>
        </div>

        {/* Messages List */}
        <div className="section">
          {threadsLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          )}

          {error && (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <p style={{ color: 'var(--danger)', marginBottom: 12 }}>Failed to load messages</p>
              <button className="btn btnSecondary" onClick={() => window.location.reload()}>
                Try Again
              </button>
            </div>
          )}

          {!threadsLoading && !error && filteredThreads && filteredThreads.length > 0 && (
            <div>
              {filteredThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  onPress={() => router.push(`/dashboard/parent/messages/${thread.id}`)}
                />
              ))}
            </div>
          )}

          {!threadsLoading && !error && filteredThreads && filteredThreads.length === 0 && (
            <div className="card" style={{ padding: 48, textAlign: 'center' }}>
              <MessageSquare size={64} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                {searchQuery ? 'No matching messages' : 'No Messages Yet'}
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
                {searchQuery 
                  ? 'Try a different search term' 
                  : 'When teachers or school staff send you messages, they will appear here.'
                }
              </p>
              {!searchQuery && (
                <button className="btn btnPrimary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Send size={16} />
                  Start New Conversation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </ParentShell>
  );
}
