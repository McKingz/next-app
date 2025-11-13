import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { useParentThreads, MessageThread } from '@/hooks/useParentMessaging';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

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
  const { theme } = useTheme();
  const { t } = useTranslation();
  
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
  
  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      borderLeftWidth: hasUnread ? 4 : 0,
      borderLeftColor: theme.primary,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    name: {
      fontSize: 16,
      fontWeight: hasUnread ? '700' : '600',
      color: theme.text,
    },
    time: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    roleStudent: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    role: {
      fontSize: 12,
      color: theme.primary,
      textTransform: 'capitalize',
    },
    studentContext: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 8,
    },
    lastMessage: {
      fontSize: 14,
      color: hasUnread ? theme.text : theme.textSecondary,
      fontWeight: hasUnread ? '500' : '400',
    },
    rightSection: {
      alignItems: 'flex-end',
    },
    unreadBadge: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    unreadText: {
      color: theme.onPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
  });
  
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.avatar}>
        <Ionicons 
          name={participantRole === 'principal' ? 'school' : 'person'} 
          size={24} 
          color={theme.primary} 
        />
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{participantName}</Text>
          {thread.last_message && (
            <Text style={styles.time}>
              {formatMessageTime(thread.last_message.created_at)}
            </Text>
          )}
        </View>
        
        <View style={styles.roleStudent}>
          <Text style={styles.role}>{t(`roles.${participantRole}`)}</Text>
          {thread.student && (
            <Text style={styles.studentContext}>• {studentName}</Text>
          )}
        </View>
        
        {thread.last_message ? (
          <Text style={styles.lastMessage} numberOfLines={2}>
            {thread.last_message.content}
          </Text>
        ) : (
          <Text style={[styles.lastMessage, { fontStyle: 'italic' }]} numberOfLines={2}>
            {t('parent.noMessagesYet')}
          </Text>
        )}
      </View>
      
      <View style={styles.rightSection}>
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        {hasUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {thread.unread_count && thread.unread_count > 9 ? '9+' : thread.unread_count}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function ParentMessagesScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { data: threads, isLoading, error, refetch } = useParentThreads();
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textSecondary,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyIcon: {
      marginBottom: 16,
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
      marginBottom: 24,
    },
    emptyButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    emptyButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
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
  });
  
  const handleThreadPress = (thread: MessageThread) => {
    const title = thread.student ? 
      `${thread.student.first_name} ${thread.student.last_name}`.trim() :
      'Messages';
    router.push(`/message-thread?threadId=${thread.id}&title=${encodeURIComponent(title)}`);
  };
  
  const handleStartNewMessage = () => {
    // Navigate to child selection for new message
    router.push('/screens/parent-new-message');
  };
  
  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <RoleBasedHeader title={t('parent.messages')} />
        <View style={styles.content}>
          <SkeletonLoader width="100%" height={80} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} style={{ marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={80} borderRadius={12} style={{ marginBottom: 12 }} />
        </View>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <RoleBasedHeader title={t('parent.messages')} />
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={48} color={theme.error} />
          <Text style={styles.errorTitle}>{t('parent.messagesError')}</Text>
          <Text style={styles.errorText}>{t('parent.messagesErrorDesc')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // Empty state
  if (!threads || threads.length === 0) {
    return (
      <View style={styles.container}>
        <RoleBasedHeader title={t('parent.messages')} />
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color={theme.textSecondary} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>{t('parent.noMessagesTitle')}</Text>
          <Text style={styles.emptySubtitle}>
            {t('parent.noMessagesDesc')}
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleStartNewMessage}>
            <Text style={styles.emptyButtonText}>{t('parent.startNewMessage')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // Thread list
  return (
    <View style={styles.container}>
      <RoleBasedHeader title={t('parent.messages')} />
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
      >
        {threads.map((thread) => (
          <ThreadItem
            key={thread.id}
            thread={thread}
            onPress={() => handleThreadPress(thread)}
          />
        ))}
      </ScrollView>
    </View>
  );
}