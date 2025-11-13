'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Trash2, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Conversation {
  id: string;
  conversation_id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

interface ConversationListProps {
  activeConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
}

export function ConversationList({ 
  activeConversationId, 
  onSelectConversation,
  onNewConversation 
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('id, conversation_id, title, updated_at, messages')
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedConversations = (data || []).map((conv: any) => ({
        id: conv.id,
        conversation_id: conv.conversation_id,
        title: conv.title,
        updated_at: conv.updated_at,
        message_count: Array.isArray(conv.messages) ? conv.messages.length : 0,
      }));

      setConversations(formattedConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Delete this conversation?')) return;

    try {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('conversation_id', conversationId);

      if (error) throw error;

      setConversations(conversations.filter(c => c.conversation_id !== conversationId));
      
      if (activeConversationId === conversationId) {
        onNewConversation();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>
        <p>Loading conversations...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-0)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Conversations
        </h3>
        <button
          onClick={onNewConversation}
          className="btn btnPrimary"
          style={{
            width: '100%',
            padding: '10px 16px',
            fontSize: 14,
            fontWeight: 600,
            background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <MessageSquare size={16} />
          New Chat
        </button>
      </div>

      {/* Conversations List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
        {conversations.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--muted)',
            }}
          >
            <MessageSquare size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, margin: 0 }}>No conversations yet</p>
            <p style={{ fontSize: 12, margin: '4px 0 0 0' }}>Start a new chat to get help!</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.conversation_id)}
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: activeConversationId === conv.conversation_id
                  ? 'rgba(124, 58, 237, 0.1)'
                  : 'transparent',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (activeConversationId !== conv.conversation_id) {
                  e.currentTarget.style.background = 'var(--surface-1)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeConversationId !== conv.conversation_id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <h4
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    paddingRight: 8,
                  }}
                >
                  {conv.title}
                </h4>
                <button
                  onClick={(e) => deleteConversation(conv.conversation_id, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    color: 'var(--muted)',
                    flexShrink: 0,
                  }}
                  title="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                <Clock size={12} />
                <span>{formatDate(conv.updated_at)}</span>
                <span>•</span>
                <span>{conv.message_count} messages</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
