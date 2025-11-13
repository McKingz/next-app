import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Types
export interface MessageThread {
  id: string;
  preschool_id: string;
  type: 'parent-teacher' | 'parent-principal' | 'general';
  student_id: string | null;
  subject: string;
  created_by: string;
  last_message_at: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  participants?: MessageParticipant[];
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  };
  unread_count?: number;
}

export interface MessageParticipant {
  id: string;
  thread_id: string;
  user_id: string;
  role: 'parent' | 'teacher' | 'principal' | 'admin';
  joined_at: string;
  is_muted: boolean;
  last_read_at: string;
  // Joined data
  user_profile?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  content_type: 'text' | 'system';
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  // Joined data
  sender?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

/**
 * Hook to get parent's message threads
 */
export const useParentThreads = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['parent', 'threads', user?.id],
    queryFn: async (): Promise<MessageThread[]> => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const client = assertSupabase();
      
      // Get threads with participants, student info, and last message
      const { data: threads, error } = await client
        .from('message_threads')
        .select(`
          *,
          student:students(id, first_name, last_name),
          participants:message_participants(
            *,
            user_profile:profiles(first_name, last_name, role)
          )
        `)
        .order('last_message_at', { ascending: false });
      
      if (error) throw error;
      
      // Get last message and unread count for each thread
      const threadsWithDetails = await Promise.all(
        (threads || []).map(async (thread) => {
          // Get last message
          const { data: lastMessage } = await client
            .from('messages')
            .select(`
              content,
              created_at,
              sender:profiles(first_name, last_name)
            `)
            .eq('thread_id', thread.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          // Get unread count (messages after user's last_read_at)
          const userParticipant = thread.participants?.find(p => p.user_id === user.id);
          let unreadCount = 0;
          
          if (userParticipant) {
            const { count } = await client
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('thread_id', thread.id)
              .gt('created_at', userParticipant.last_read_at)
              .neq('sender_id', user.id)
              .is('deleted_at', null);
            
            unreadCount = count || 0;
          }
          
          return {
            ...thread,
            last_message: lastMessage ? {
              content: lastMessage.content,
              sender_name: (() => {
                const s: any = lastMessage?.sender;
                const sender = Array.isArray(s) ? s[0] : s;
                return sender ? `${sender.first_name} ${sender.last_name}`.trim() : 'Unknown';
              })(),
              created_at: lastMessage.created_at
            } : undefined,
            unread_count: unreadCount
          };
        })
      );
      
      return threadsWithDetails;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

/**
 * Hook to get messages for a specific thread
 */
export const useThreadMessages = (threadId: string | null) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['messages', threadId],
    queryFn: async (): Promise<Message[]> => {
      if (!threadId) return [];
      
      const client = assertSupabase();
      const { data, error } = await client
        .from('messages')
        .select(`
          *,
          sender:profiles(first_name, last_name, role)
        `)
        .eq('thread_id', threadId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!threadId && !!user?.id,
    staleTime: 1000 * 30, // 30 seconds
  });
};

/**
 * Hook to send a message
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ threadId, content }: { threadId: string; content: string }) => {
      const client = assertSupabase();
      
      const { data, error } = await client
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: user?.id,
          content: content.trim(),
          content_type: 'text'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { threadId }) => {
      // Invalidate thread messages
      queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
      // Invalidate parent threads to update last message and unread counts
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
    },
  });
};

/**
 * Hook to create or get a parent-teacher thread
 */
export const useCreateThread = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ studentId }: { studentId: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const client = assertSupabase();
      
      // Call the database function to get or create thread
      const { data, error } = await client.rpc(
        'get_or_create_parent_teacher_thread',
        {
          p_student_id: studentId,
          p_parent_id: user.id
        }
      );
      
      if (error) throw error;
      return data; // Returns thread_id
    },
    onSuccess: () => {
      // Invalidate parent threads to show the new/existing thread
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
    },
  });
};

/**
 * Hook to mark thread as read
 */
export const useMarkThreadRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ threadId }: { threadId: string }) => {
      const client = assertSupabase();
      
      const { error } = await client
        .from('message_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('thread_id', threadId)
        .eq('user_id', user?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate parent threads to update unread counts
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
    },
  });
};

/**
 * Hook to get total unread message count for parent dashboard
 */
export const useUnreadMessageCount = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['parent', 'unread-count', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;
      
      const client = assertSupabase();
      
      // Get all thread IDs for this user
      const { data: participantData } = await client
        .from('message_participants')
        .select('thread_id, last_read_at')
        .eq('user_id', user.id);
      
      if (!participantData || participantData.length === 0) return 0;
      
      // Count unread messages across all threads
      let totalUnread = 0;
      
      for (const participant of participantData) {
        const { count } = await client
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('thread_id', participant.thread_id)
          .gt('created_at', participant.last_read_at)
          .neq('sender_id', user.id)
          .is('deleted_at', null);
        
        totalUnread += count || 0;
      }
      
      return totalUnread;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60, // 1 minute
  });
};