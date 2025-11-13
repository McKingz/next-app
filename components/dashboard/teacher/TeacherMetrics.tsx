/**
 * Teacher Dashboard Metrics Component
 */

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getStyles } from './styles';
import type { TeacherMetric } from './types';

interface TeacherMetricsProps {
  totalStudents: number;
  totalClasses: number;
  pendingGrading: number;
  upcomingLessons: number;
}

export const TeacherMetrics: React.FC<TeacherMetricsProps> = ({
  totalStudents,
  totalClasses,
  pendingGrading,
  upcomingLessons,
}) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme, isDark);

  const metrics: TeacherMetric[] = [
    {
      title: t("metrics.my_students"),
      value: totalStudents,
      subtitle: t("metrics.across_classes", { count: totalClasses }),
      icon: "people-outline",
      color: "#4F46E5",
    },
    {
      title: t("metrics.pending_grading"),
      value: pendingGrading,
      subtitle: t("metrics.assignments_to_review"),
      icon: "document-text-outline",
      color: "#DC2626",
    },
    {
      title: t("metrics.lessons_today"),
      value: upcomingLessons,
      subtitle: t("metrics.scheduled_classes"),
      icon: "book-outline",
      color: "#059669",
    },
  ];

  const renderMetricCard = (metric: TeacherMetric) => (
    <View
      key={metric.title}
      style={[styles.metricCard, { borderLeftColor: metric.color }]}
    >
      <View style={styles.metricHeader}>
        <Ionicons name={metric.icon as any} size={24} color={metric.color} />
        <Text style={styles.metricValue}>{metric.value}</Text>
      </View>
      <Text style={styles.metricTitle}>{metric.title}</Text>
      {metric.subtitle && (
        <Text style={styles.metricSubtitle}>{metric.subtitle}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("dashboard.todays_overview")}</Text>
      <View style={styles.metricsGrid}>{metrics.map(renderMetricCard)}</View>
    </View>
  );
};
