/**
 * Teacher Dashboard Header Component
 */

import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getStyles } from './styles';

interface TeacherHeaderProps {
  teacherName: string;
  role: string;
  hasActiveSeat: boolean;
  seatStatus: string;
  onMenuPress: () => void;
}

export const TeacherHeader: React.FC<TeacherHeaderProps> = ({
  teacherName,
  role,
  hasActiveSeat,
  seatStatus,
  onMenuPress,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = getStyles(theme, isDark);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerCard}>
        <View style={styles.headerContent}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <Ionicons
                name="school"
                size={20}
                color={theme.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.greeting}>
                {getGreeting()}, {teacherName}! 👩‍🏫
              </Text>
            </View>
            <View style={styles.subRow}>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  {role === "teacher" ? "Teacher" : "Teacher"}
                </Text>
              </View>
              <View
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor: hasActiveSeat
                      ? "#10B98120"
                      : seatStatus === "pending"
                        ? "#F59E0B20"
                        : "#DC262620",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.roleBadgeText,
                    {
                      color: hasActiveSeat
                        ? "#10B981"
                        : seatStatus === "pending"
                          ? "#F59E0B"
                          : "#DC2626",
                    },
                  ]}
                >
                  Seat:{" "}
                  {hasActiveSeat
                    ? "Active"
                    : seatStatus === "pending"
                      ? "Pending"
                      : "Inactive"}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.themeToggleButton}
              onPress={async () => {
                await toggleTheme();
                try {
                  if (Platform.OS !== 'web') {
                    if (Platform.OS === 'ios') {
                      await require('expo-haptics').impactAsync(require('expo-haptics').ImpactFeedbackStyle.Light);
                    } else {
                      require('react-native').Vibration.vibrate(15);
                    }
                  }
                } catch {}
              }}
            >
              <Ionicons
                name={isDark ? 'sunny' : 'moon'}
                size={20}
                color={theme.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerMenuButton}
              onPress={onMenuPress}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={24}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};
