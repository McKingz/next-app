/**
 * StudentCard Component
 * 
 * Reusable student card with:
 * - Dark mode support
 * - Press and long-press handlers
 * - Age display
 * - Class/age group display
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Student, formatAge } from '@/services/students';

interface Props {
  student: Student;
  onPress?: () => void;
  onLongPress?: () => void;
  showClass?: boolean;
  ageGroupName?: string;
  className?: string;
}

export default function StudentCard({
  student,
  onPress,
  onLongPress,
  showClass = false,
  ageGroupName,
  className,
}: Props) {
  const { theme } = useTheme();

  const initials = `${student.first_name[0]}${student.last_name[0]}`.toUpperCase();
  const fullName = `${student.first_name} ${student.last_name}`;
  const age = formatAge(student.date_of_birth);

  // Status colors
  const statusColors = {
    active: theme.success,
    inactive: theme.textSecondary,
    pending: theme.warning,
  };

  const statusBgColors = {
    active: theme.success + '20',
    inactive: theme.textSecondary + '20',
    pending: theme.warning + '20',
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.surface,
          borderRadius: 12,
          marginBottom: 12,
          shadowColor: theme.shadow || '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        },
        cardContent: {
          flexDirection: 'row',
          padding: 16,
          alignItems: 'center',
        },
        avatar: {
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: theme.primary + '30',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        avatarText: {
          fontSize: 18,
          fontWeight: '600',
          color: theme.primary,
        },
        info: {
          flex: 1,
        },
        nameRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 4,
        },
        name: {
          fontSize: 16,
          fontWeight: '600',
          color: theme.text,
          flex: 1,
        },
        statusBadge: {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 12,
          marginLeft: 8,
        },
        statusText: {
          fontSize: 11,
          fontWeight: '600',
          textTransform: 'capitalize',
        },
        detailsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
        },
        age: {
          fontSize: 14,
          color: theme.textSecondary,
          marginRight: 12,
        },
        classText: {
          fontSize: 13,
          color: theme.textSecondary,
          marginRight: 12,
        },
        ageGroupBadge: {
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 8,
          marginTop: 4,
        },
        ageGroupText: {
          fontSize: 12,
          fontWeight: '500',
        },
      }),
    [theme]
  );

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{fullName}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusBgColors[student.status] },
              ]}
            >
              <Text style={[styles.statusText, { color: statusColors[student.status] }]}>
                {student.status}
              </Text>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <Text style={styles.age}>{age}</Text>

            {showClass && className && (
              <Text style={styles.classText}>📚 {className}</Text>
            )}

            {ageGroupName && (
              <View
                style={[
                  styles.ageGroupBadge,
                  { backgroundColor: theme.primary + '15' },
                ]}
              >
                <Text style={[styles.ageGroupText, { color: theme.primary }]}>
                  {ageGroupName}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
