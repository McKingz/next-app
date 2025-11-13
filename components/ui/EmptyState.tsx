/**
 * Empty State Component
 *
 * A reusable component for showing meaningful empty states across dashboards
 * with consistent design and helpful actions.
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
  // Direct action node override (e.g., custom button)
  action?: React.ReactNode;
  // More compact spacing variant
  compact?: boolean;
  secondary?: boolean;
  size?: "small" | "medium" | "large";
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onActionPress,
  action,
  compact = false,
  secondary = false,
  size = "medium",
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const sizeStyles = {
    small: {
      container: styles.smallContainer,
      icon: 32,
      title: styles.smallTitle,
      description: styles.smallDescription,
    },
    medium: {
      container: styles.mediumContainer,
      icon: 48,
      title: styles.mediumTitle,
      description: styles.mediumDescription,
    },
    large: {
      container: styles.largeContainer,
      icon: 64,
      title: styles.largeTitle,
      description: styles.largeDescription,
    },
  };

  const currentSize = sizeStyles[size];

  return (
    <View style={[styles.container, currentSize.container, compact && { paddingVertical: 8 }]}>
      <Ionicons
        name={icon}
        size={currentSize.icon}
        color={secondary ? theme.textSecondary : "#9CA3AF"}
        style={styles.icon}
      />
      <Text style={[styles.title, currentSize.title]}>{title}</Text>
      <Text style={[styles.description, currentSize.description]}>
        {description}
      </Text>
      {action ? (
        <View style={{ marginTop: 12 }}>{action}</View>
      ) : actionLabel && onActionPress ? (
        <TouchableOpacity
          style={[styles.actionButton, secondary && styles.secondaryButton]}
          onPress={onActionPress}
        >
          <Text
            style={[
              styles.actionButtonText,
              secondary && styles.secondaryButtonText,
            ]}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// Preset empty states for common scenarios
export const EmptyClassesState: React.FC<{ onCreateClass?: () => void }> = ({
  onCreateClass,
}) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="school-outline"
      title={t("empty.no_classes_title")}
      description={t("empty.no_classes_description")}
      actionLabel={onCreateClass ? t("empty.create_first_class") : undefined}
      onActionPress={onCreateClass}
      size="medium"
    />
  );
};

export const EmptyAssignmentsState: React.FC<{
  onCreateAssignment?: () => void;
}> = ({ onCreateAssignment }) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="document-text-outline"
      title={t("empty.no_assignments_title")}
      description={t("empty.no_assignments_description")}
      actionLabel={
        onCreateAssignment ? t("empty.create_assignment") : undefined
      }
      onActionPress={onCreateAssignment}
      size="medium"
    />
  );
};

export const EmptyStudentsState: React.FC<{ onEnrollStudent?: () => void }> = ({
  onEnrollStudent,
}) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="people-outline"
      title={t("empty.no_students_title")}
      description={t("empty.no_students_description")}
      actionLabel={
        onEnrollStudent ? t("empty.enroll_first_student") : undefined
      }
      onActionPress={onEnrollStudent}
      size="medium"
    />
  );
};

export const EmptyTeachersState: React.FC<{ onInviteTeacher?: () => void }> = ({
  onInviteTeacher,
}) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="person-add-outline"
      title={t("empty.no_teachers_title")}
      description={t("empty.no_teachers_description")}
      actionLabel={onInviteTeacher ? t("empty.invite_teacher") : undefined}
      onActionPress={onInviteTeacher}
      size="medium"
    />
  );
};

export const EmptyEventsState: React.FC<{ onCreateEvent?: () => void }> = ({
  onCreateEvent,
}) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="calendar-outline"
      title={t("empty.no_events_title")}
      description={t("empty.no_events_description")}
      actionLabel={onCreateEvent ? t("empty.create_event") : undefined}
      onActionPress={onCreateEvent}
      size="small"
      secondary
    />
  );
};

export const EmptyActivityState: React.FC = () => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="pulse"
      title={t("empty.no_activity_title")}
      description={t("empty.no_activity_description")}
      size="small"
      secondary
    />
  );
};

export const EmptyFinancialDataState: React.FC<{
  onViewReports?: () => void;
}> = ({ onViewReports }) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="bar-chart-outline"
      title={t("empty.no_financial_data_title")}
      description={t("empty.no_financial_data_description")}
      actionLabel={onViewReports ? t("empty.view_reports") : undefined}
      onActionPress={onViewReports}
      size="medium"
    />
  );
};

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      justifyContent: "center",
    },
    smallContainer: {
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    mediumContainer: {
      paddingVertical: 40,
      paddingHorizontal: 24,
    },
    largeContainer: {
      paddingVertical: 60,
      paddingHorizontal: 32,
    },
    icon: {
      marginBottom: 16,
    },
    title: {
      fontWeight: "600",
      color: theme.text,
      textAlign: "center",
      marginBottom: 8,
    },
    smallTitle: {
      fontSize: 16,
    },
    mediumTitle: {
      fontSize: 18,
    },
    largeTitle: {
      fontSize: 22,
    },
    description: {
      color: theme.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 20,
    },
    smallDescription: {
      fontSize: 13,
    },
    mediumDescription: {
      fontSize: 14,
    },
    largeDescription: {
      fontSize: 16,
    },
    actionButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
    },
    secondaryButton: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.textSecondary,
    },
    actionButtonText: {
      color: "white",
      fontSize: 14,
      fontWeight: "600",
    },
    secondaryButtonText: {
      color: theme.textSecondary,
    },
  });
