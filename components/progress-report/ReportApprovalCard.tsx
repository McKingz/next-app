/**
 * ReportApprovalCard Component
 * 
 * Card component for displaying pending progress reports in principal review list
 * Optimized for FlashList rendering
 * 
 * References:
 * - React Native 0.79: https://reactnative.dev/docs/0.79/touchableopacity
 * - date-fns v4: https://date-fns.org/docs/Getting-Started
 * - FlashList: https://shopify.github.io/flash-list/docs/
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, formatDistanceToNow } from 'date-fns';
import { enZA } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import type { ProgressReport } from '@/services/ProgressReportService';

export interface ReportApprovalCardProps {
  report: ProgressReport;
  onPress: () => void;
}

/**
 * ReportApprovalCard - List item for pending reports
 * 
 * Features:
 * - Displays student and teacher names
 * - Shows report type (Term 2 or School Readiness)
 * - Submission timestamp with relative time
 * - Urgency badge for recent submissions
 * - Resubmission indicator
 * - Touch target ≥44px for accessibility
 * 
 * @example
 * ```tsx
 * <FlashList
 *   data={pendingReports}
 *   renderItem={({ item }) => (
 *     <ReportApprovalCard
 *       report={item}
 *       onPress={() => navigateToReview(item.id)}
 *     />
 *   )}
 *   estimatedItemSize={120}
 * />
 * ```
 */
export const ReportApprovalCard = ({ report, onPress }: ReportApprovalCardProps) => {
  const { theme, colorScheme } = useTheme();

  // Calculate if submission is recent (< 24 hours)
  const submittedDate = new Date(report.teacher_signed_at || report.created_at);
  const isRecent = Date.now() - submittedDate.getTime() < 24 * 60 * 60 * 1000;
  
  // Format relative time (e.g., "2 hours ago")
  const relativeTime = formatDistanceToNow(submittedDate, { 
    addSuffix: true, 
    locale: enZA 
  });
  
  // Format absolute time (e.g., "22/10/2025 14:30")
  const absoluteTime = format(submittedDate, 'dd/MM/yyyy HH:mm', { locale: enZA });

  // Determine report type label
  const getReportTypeLabel = () => {
    if (report.report_category === 'school_readiness') {
      return 'School Readiness';
    }
    if (report.report_type === 'term' && report.report_period) {
      return report.report_period;
    }
    return report.report_type || 'General Report';
  };

  const isResubmission = report.submission_count > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
      ]}
      activeOpacity={0.7}
      accessibilityLabel={`Review progress report for ${report.student_name}`}
      accessibilityRole="button"
      accessibilityHint="Tap to review and approve or reject this report"
    >
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>
            {report.student_name || 'Unknown Student'}
          </Text>
          <Text style={[styles.teacherName, { color: theme.textSecondary }]} numberOfLines={1}>
            by {report.teacher_name || 'Unknown Teacher'}
          </Text>
        </View>
        {isRecent && (
          <View style={styles.urgencyBadge}>
            <Text style={styles.urgencyText}>NEW</Text>
          </View>
        )}
      </View>

      {/* Report Type */}
      <Text style={[styles.reportType, { color: theme.textSecondary }]} numberOfLines={1}>
        {getReportTypeLabel()}
      </Text>

      {/* Footer Row */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={[styles.timestamp, { color: theme.textSecondary }]}>
            {relativeTime}
          </Text>
          {isResubmission && (
            <View style={styles.resubmissionBadge}>
              <Text style={[styles.resubmissionText, { color: theme.colors.warning }]}>
                Resubmission #{report.submission_count}
              </Text>
            </View>
          )}
        </View>
        <ApprovalStatusBadge status={report.status} size="small" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44, // Minimum touch target
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  teacherName: {
    fontSize: 13,
  },
  urgencyBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  urgencyText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  reportType: {
    fontSize: 14,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flex: 1,
    marginRight: 12,
  },
  timestamp: {
    fontSize: 12,
    marginBottom: 4,
  },
  resubmissionBadge: {
    marginTop: 4,
  },
  resubmissionText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

/**
 * Documentation Sources:
 * - React Native 0.79 TouchableOpacity: https://reactnative.dev/docs/0.79/touchableopacity
 * - date-fns v4 formatDistanceToNow: https://date-fns.org/v4.1.0/docs/formatDistanceToNow
 * - FlashList performance: https://shopify.github.io/flash-list/docs/fundamentals/performant-components
 * - WCAG Touch Target: https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
 */
