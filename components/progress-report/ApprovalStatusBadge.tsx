/**
 * ApprovalStatusBadge Component
 * 
 * Displays color-coded badge for progress report approval workflow status
 * 
 * References:
 * - React Native 0.79: https://reactnative.dev/docs/0.79/view
 * - Expo SDK 53: https://docs.expo.dev/versions/v53.0.0/
 */

import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type ReportStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'sent';

export interface ApprovalStatusBadgeProps {
  status: ReportStatus;
  size?: 'small' | 'medium' | 'large';
}

/**
 * ApprovalStatusBadge - Visual status indicator for reports
 * 
 * Color scheme matches readiness level colors from existing PDF design:
 * - draft: Gray
 * - pending_review: Amber/Orange (like "Developing")
 * - approved: Green (like "Ready")
 * - rejected: Red (like "Not Ready")
 * - sent: Purple (like "Exceeds Expectations")
 * 
 * @example
 * ```tsx
 * <ApprovalStatusBadge status="pending_review" size="medium" />
 * ```
 */
export const ApprovalStatusBadge = ({ status, size = 'medium' }: ApprovalStatusBadgeProps) => {
  const { theme, colorScheme } = useTheme();

  const getStatusConfig = (status: ReportStatus) => {
    switch (status) {
      case 'draft':
        return {
          label: 'Draft',
          bgColor: colorScheme === 'dark' ? '#4B5563' : '#E5E7EB',
          textColor: colorScheme === 'dark' ? '#D1D5DB' : '#374151',
          borderColor: colorScheme === 'dark' ? '#6B7280' : '#D1D5DB',
        };
      case 'pending_review':
        return {
          label: 'Pending Review',
          bgColor: colorScheme === 'dark' ? '#92400E' : '#FEF3C7',
          textColor: colorScheme === 'dark' ? '#FCD34D' : '#B45309',
          borderColor: '#F59E0B',
        };
      case 'approved':
        return {
          label: 'Approved',
          bgColor: colorScheme === 'dark' ? '#065F46' : '#D1FAE5',
          textColor: colorScheme === 'dark' ? '#6EE7B7' : '#047857',
          borderColor: '#059669',
        };
      case 'rejected':
        return {
          label: 'Rejected',
          bgColor: colorScheme === 'dark' ? '#7F1D1D' : '#FEE2E2',
          textColor: colorScheme === 'dark' ? '#FCA5A5' : '#B91C1C',
          borderColor: '#DC2626',
        };
      case 'sent':
        return {
          label: 'Sent',
          bgColor: colorScheme === 'dark' ? '#5B21B6' : '#EDE9FE',
          textColor: colorScheme === 'dark' ? '#C4B5FD' : '#6D28D9',
          borderColor: '#7C3AED',
        };
      default:
        return {
          label: status,
          bgColor: theme.colors.cardBackground,
          textColor: theme.colors.text,
          borderColor: theme.colors.border,
        };
    }
  };

  const config = getStatusConfig(status);

  const sizeStyles = {
    small: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 },
    medium: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 13 },
    large: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 15 },
  };

  const currentSize = sizeStyles[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: config.textColor,
            fontSize: currentSize.fontSize,
          },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});

/**
 * Documentation Sources:
 * - React Native 0.79 View: https://reactnative.dev/docs/0.79/view
 * - React Native 0.79 Text: https://reactnative.dev/docs/0.79/text
 * - Color accessibility: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */
