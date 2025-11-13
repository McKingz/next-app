import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getChildAgeText } from '@/lib/dashboard/parentDashboardHelpers';

interface ChildCardProps {
  child: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    date_of_birth?: string;
    grade: string;
    className: string | null;
    lastActivity: Date;
    homeworkPending: number;
    upcomingEvents: number;
    progressScore: number;
    status: 'active' | 'absent' | 'late';
  };
  onAttendancePress: () => void;
  onHomeworkPress: () => void;
  onMessagePress: () => void;
}

export const ChildCard: React.FC<ChildCardProps> = ({ 
  child, 
  onAttendancePress,
  onHomeworkPress,
  onMessagePress 
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    childCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: theme.shadow || '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    childHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    childInfo: {
      flex: 1,
    },
    childName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 4,
    },
    childDetails: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    childStats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    statItem: {
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    childStatValue: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    childActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      flex: 1,
      marginHorizontal: 2,
      justifyContent: 'center',
    },
    actionText: {
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 4,
    },
    lastActivityContainer: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    lastActivityText: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.childCard}>
      <View style={styles.childHeader}>
        <View style={styles.childInfo}>
          <Text style={styles.childName}>{child.firstName} {child.lastName}</Text>
          <Text style={styles.childDetails}>
            {getChildAgeText(child, t)} • {child.grade} • {child.className || t('common.noClass')}
          </Text>
        </View>
        <View style={[
          styles.statusBadge, 
          child.status === 'active' ? { backgroundColor: theme.success + '20' } :
          child.status === 'late' ? { backgroundColor: theme.warning + '20' } : 
          { backgroundColor: theme.error + '20' }
        ]}>
          <Text style={[
            styles.statusText, 
            child.status === 'active' ? { color: theme.success } :
            child.status === 'late' ? { color: theme.warning } : 
            { color: theme.error }
          ]}>
            {child.status}
          </Text>
        </View>
      </View>
      
      <View style={styles.childStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Attendance</Text>
          <Text style={[styles.childStatValue, { color: theme.success }]}>
            {child.progressScore}%
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Pending Homework</Text>
          <Text style={[
            styles.childStatValue, 
            child.homeworkPending > 0 ? { color: theme.warning } : { color: theme.success }
          ]}>
            {child.homeworkPending}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Upcoming Events</Text>
          <Text style={[styles.childStatValue, { color: theme.primary }]}>
            {child.upcomingEvents}
          </Text>
        </View>
      </View>
      
      <View style={styles.childActions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.primary + '10' }]}
          onPress={onAttendancePress}
        >
          <Ionicons name="calendar" size={16} color={theme.primary} />
          <Text style={[styles.actionText, { color: theme.primary }]}>Attendance</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.success + '10' }]}
          onPress={onHomeworkPress}
        >
          <Ionicons name="book" size={16} color={theme.success} />
          <Text style={[styles.actionText, { color: theme.success }]}>Homework</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.accent + '10' }]}
          onPress={onMessagePress}
        >
          <Ionicons name="chatbubble" size={16} color={theme.accent} />
          <Text style={[styles.actionText, { color: theme.accent }]}>Message</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.lastActivityContainer}>
        <Text style={styles.lastActivityText}>
          Last activity: {child.lastActivity.toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
};
