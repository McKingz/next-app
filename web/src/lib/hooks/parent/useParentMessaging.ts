'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

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
export const useParentThreads = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['parent', 'threads', userId],
    queryFn: async (): Promise<MessageThread[]> => {
      if (!userId) throw new Error('User not authenticated');
      
      const client = createClient();
      
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
            .maybeSingle();
          
          // Get unread count (messages after user's last_read_at)
          const userParticipant = thread.participants?.find(p => p.user_id === userId);
          let unreadCount = 0;
          
          if (userParticipant) {
            const { count } = await client
              .from('messages')
              .select('id', { count: 'exact', head: true })
              .eq('thread_id', thread.id)
              .gt('created_at', userParticipant.last_read_at)
              .neq('sender_id', userId)
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
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

/**
 * Hook to get messages for a specific thread
 */
export const useThreadMessages = (threadId: string | undefined, userId: string | undefined) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['messages', threadId],
    queryFn: async (): Promise<Message[]> => {
      if (!threadId) throw new Error('Thread ID required');
      
      const client = createClient();
      
      const { data: messages, error } = await client
        .from('messages')
        .select(`
          *,
          sender:profiles(first_name, last_name, role)
        `)
        .eq('thread_id', threadId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Mark messages as read
      if (userId) {
        await client
          .from('message_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('thread_id', threadId)
          .eq('user_id', userId);
        
        // Invalidate threads query to update unread counts
        queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
      }
      
      return messages || [];
    },
    enabled: !!threadId && !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });
};

/**
 * Hook to send a message
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      threadId,
      content,
      userId
    }: {
      threadId: string;
      content: string;
      userId: string;
    }) => {
      const client = createClient();
      
      // Insert message
      const { data: message, error } = await client
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: userId,
          content,
          content_type: 'text'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update thread last_message_at
      await client
        .from('message_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId);
      
      return message;
    },
    onSuccess: (_, variables) => {
      // Invalidate both threads and messages queries
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
      queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
    }
  });
};

/**
 * Hook to create a new message thread
 */
export const useCreateThread = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      preschoolId,
      type,
      subject,
      studentId,
      recipientId,
      userId,
      initialMessage
    }: {
      preschoolId: string;
      type: 'parent-teacher' | 'parent-principal' | 'general';
      subject: string;
      studentId?: string;
      recipientId: string;
      userId: string;
      initialMessage: string;
    }) => {
      const client = createClient();
      
      // Create thread
      const { data: thread, error: threadError } = await client
        .from('message_threads')
        .insert({
          preschool_id: preschoolId,
          type,
          subject,
          student_id: studentId || null,
          created_by: userId,
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (threadError) throw threadError;
      
      // Add participants
      const { error: participantsError } = await client
        .from('message_participants')
        .insert([
          {
            thread_id: thread.id,
            user_id: userId,
            role: 'parent',
            last_read_at: new Date().toISOString()
          },
          {
            thread_id: thread.id,
            user_id: recipientId,
            role: type === 'parent-principal' ? 'principal' : 'teacher',
            last_read_at: new Date().toISOString()
          }
        ]);
      
      if (participantsError) throw participantsError;
      
      // Send initial message
      const { error: messageError } = await client
        .from('messages')
        .insert({
          thread_id: thread.id,
          sender_id: userId,
          content: initialMessage,
          content_type: 'text'
        });
      
      if (messageError) throw messageError;
      
      return thread;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
    }
  });
};
