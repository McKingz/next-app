/**
 * React Query hooks for DashAI Conversations
 * 
 * Simple, automatic UI updates with caching and optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashAIAssistant } from '@/services/dash-ai/DashAICompat';
import type { DashConversation, DashMessage } from '@/services/dash-ai/types';

/**
 * Get conversation with automatic updates and caching
 * 
 * @example
 * const { data: conversation, isLoading } = useDashConversation(conversationId);
 */
export function useDashConversation(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['dash-conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const dash = DashAIAssistant.getInstance();
      await dash.initialize();
      return dash.getConversation(conversationId);
    },
    enabled: !!conversationId,
    staleTime: 10000, // Consider data fresh for 10 seconds
    refetchOnWindowFocus: true, // Auto-refresh when user returns to app
  });
}

/**
 * Get all conversations with automatic caching
 * 
 * @example
 * const { data: conversations, isLoading } = useDashConversations();
 */
export function useDashConversations() {
  return useQuery({
    queryKey: ['dash-conversations'],
    queryFn: async () => {
      const dash = DashAIAssistant.getInstance();
      await dash.initialize();
      return dash.getAllConversations();
    },
    staleTime: 5000,
  });
}

/**
 * Send message with optimistic updates (UI updates immediately)
 * 
 * @example
 * const { mutate: sendMessage, isLoading } = useSendMessage();
 * sendMessage({ conversationId, content: 'Hello!' });
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const dash = DashAIAssistant.getInstance();
      await dash.initialize();
      
      // Send message
      const message = await dash.sendMessage(content, conversationId);
      
      return { conversationId, message };
    },
    
    // ✅ Optimistic update: UI updates immediately before server response
    onMutate: async ({ conversationId, content }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['dash-conversation', conversationId] });

      // Get current conversation
      const previousConversation = queryClient.getQueryData<DashConversation>([
        'dash-conversation',
        conversationId,
      ]);

      // Optimistically update UI
      if (previousConversation) {
        const optimisticMessage: DashMessage = {
          id: `temp_${Date.now()}`,
          type: 'user',
          content,
          timestamp: Date.now(),
        };

        queryClient.setQueryData<DashConversation>(['dash-conversation', conversationId], {
          ...previousConversation,
          messages: [...previousConversation.messages, optimisticMessage],
          updated_at: Date.now(),
        });
      }

      // Return context for rollback if needed
      return { previousConversation };
    },

    // ✅ Auto-refresh after message sent
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dash-conversation', data.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['dash-conversations'] });
    },

    // ✅ Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousConversation) {
        queryClient.setQueryData(
          ['dash-conversation', variables.conversationId],
          context.previousConversation
        );
      }
    },
  });
}

/**
 * Delete conversation with automatic UI updates
 * 
 * @example
 * const { mutate: deleteConversation } = useDeleteConversation();
 * deleteConversation(conversationId);
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const dash = DashAIAssistant.getInstance();
      await dash.initialize();
      await dash.deleteConversation(conversationId);
      return conversationId;
    },
    onSuccess: () => {
      // ✅ Auto-refresh conversation list
      queryClient.invalidateQueries({ queryKey: ['dash-conversations'] });
    },
  });
}

/**
 * Start new conversation
 * 
 * @example
 * const { mutate: startConversation } = useStartConversation();
 * startConversation({ title: 'New Chat' });
 */
export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title }: { title?: string }) => {
      const dash = DashAIAssistant.getInstance();
      await dash.initialize();
      const conversationId = await dash.startNewConversation(title);
      return conversationId;
    },
    onSuccess: () => {
      // ✅ Auto-refresh conversation list
      queryClient.invalidateQueries({ queryKey: ['dash-conversations'] });
    },
  });
}
