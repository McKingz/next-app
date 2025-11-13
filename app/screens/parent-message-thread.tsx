import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { 
  useThreadMessages, 
  useSendMessage, 
  useMarkThreadRead, 
  Message 
} from '@/hooks/useParentMessaging';
import { useAuth } from '@/contexts/AuthContext';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

// Format message timestamp
const formatMessageTime = (timestamp: string): string => {
  const messageTime = new Date(timestamp);
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return messageTime.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
};

// Message bubble component - Memoized for better performance
interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ message, isOwnMessage }) => {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      marginVertical: 4,
      marginHorizontal: 16,
      alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
      maxWidth: '75%',
    },
    bubble: {
      backgroundColor: isOwnMessage ? theme.primary : theme.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    text: {
      fontSize: 16,
      color: isOwnMessage ? theme.onPrimary : theme.text,
      lineHeight: 20,
    },
    footer: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
    },
    senderName: {
      fontSize: 12,
      color: isOwnMessage ? theme.onPrimary + '80' : theme.textSecondary,
      marginRight: 8,
    },
    timestamp: {
      fontSize: 12,
      color: isOwnMessage ? theme.onPrimary + '80' : theme.textSecondary,
    },
  });
  
  const senderName = message.sender ? 
    `${message.sender.first_name} ${message.sender.last_name}`.trim() :
    (isOwnMessage ? 'You' : 'Teacher');
  
  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <Text style={styles.text}>{message.content}</Text>
        <View style={styles.footer}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          <Text style={styles.timestamp}>
            {formatMessageTime(message.created_at)}
          </Text>
        </View>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if message content or isOwnMessage changes
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.content === nextProps.message.content &&
         prevProps.isOwnMessage === nextProps.isOwnMessage;
});

export default function ParentMessageThreadScreen() {
  const { threadId, title } = useLocalSearchParams<{ threadId: string; title: string }>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<FlatList>(null);
  // Hooks
  const { data: messages = [], isLoading, error, refetch } = useThreadMessages(threadId);
  const sendMessageMutation = useSendMessage();
  const markReadMutation = useMarkThreadRead();
  
  // Mark thread as read when messages load
  useEffect(() => {
    if (threadId && messages.length > 0 && !isLoading) {
      markReadMutation.mutate({ threadId });
    }
  }, [threadId, messages.length, isLoading, markReadMutation]);
  
  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);
  
  const handleSendMessage = async () => {
    const content = messageText.trim();
    if (!content || !threadId || isSending) return;
    
    setIsSending(true);
    try {
      await sendMessageMutation.mutateAsync({
        threadId,
        content
      });
      setMessageText('');
    } catch (error) {
      Alert.alert(
        t('common.error'),
        t('parent.messageSendError')
      );
    } finally {
      setIsSending(false);
    }
  };
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
    },
    messagesContainer: {
      flex: 1,
      paddingVertical: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.error,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    inputContainer: {
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    textInput: {
      flex: 1,
      backgroundColor: theme.elevated,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      maxHeight: 100,
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: theme.textSecondary + '40',
    },
    skeletonMessage: {
      marginHorizontal: 16,
      marginVertical: 4,
    },
  });
  
  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <RoleBasedHeader 
          title={title ? decodeURIComponent(title) : t('parent.messages')} 
          showBackButton 
        />
        <View style={styles.messagesContainer}>
          <View style={[styles.skeletonMessage, { alignSelf: 'flex-start' }]}>
            <SkeletonLoader width={200} height={60} borderRadius={16} />
          </View>
          <View style={[styles.skeletonMessage, { alignSelf: 'flex-end' }]}>
            <SkeletonLoader width={150} height={60} borderRadius={16} />
          </View>
          <View style={[styles.skeletonMessage, { alignSelf: 'flex-start' }]}>
            <SkeletonLoader width={180} height={60} borderRadius={16} />
          </View>
        </View>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <RoleBasedHeader 
          title={title ? decodeURIComponent(title) : t('parent.messages')} 
          showBackButton 
        />
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color={theme.error} />
          <Text style={styles.errorTitle}>{t('parent.threadError')}</Text>
          <Text style={styles.errorText}>{t('parent.threadErrorDesc')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <RoleBasedHeader 
        title={title ? decodeURIComponent(title) : t('parent.messages')} 
        showBackButton 
      />
      
      <View style={styles.content}>
        {messages.length === 0 ? (
          // Empty state
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.textSecondary} />
            <Text style={styles.emptyTitle}>{t('parent.startConversation')}</Text>
            <Text style={styles.emptySubtitle}>
              {t('parent.startConversationDesc')}
            </Text>
          </View>
        ) : (
          // Messages list - Using FlatList for better performance with large message lists
          <FlatList
            ref={scrollViewRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item: message }) => (
              <MessageBubble
                message={message}
                isOwnMessage={message.sender_id === user?.id}
              />
            )}
            style={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={true}
            onContentSizeChange={() => {
              // Auto-scroll to bottom on new messages
              (scrollViewRef.current as any)?.scrollToEnd?.({ animated: true });
            }}
            onLayout={() => {
              // Scroll to bottom on initial load
              (scrollViewRef.current as any)?.scrollToEnd?.({ animated: false });
            }}
          />
        )}
      </View>
      
      {/* Message input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder={t('parent.typeMessage')}
          placeholderTextColor={theme.textSecondary}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!messageText.trim() || isSending) && styles.sendButtonDisabled
          ]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={theme.onPrimary} />
          ) : (
            <Ionicons name="send" size={20} color={theme.onPrimary} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}