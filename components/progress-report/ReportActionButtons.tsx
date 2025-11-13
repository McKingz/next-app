import React from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface ReportActionButtonsProps {
  onPreview: () => void;
  onExportCSV: () => void;
  onSendPDF: () => void;
  onSendWhatsApp: () => void;
  onSendEmail: () => void;
  onSubmitForReview?: () => void;
  sending: boolean;
  disabled: boolean;
  parentEmail?: string;
  approvalStatus?: 'pending_review' | 'approved' | 'rejected' | null;
  isSubmitted?: boolean; // Has the report been submitted to database?
}

export const ReportActionButtons: React.FC<ReportActionButtonsProps> = ({
  onPreview,
  onExportCSV,
  onSendPDF,
  onSendWhatsApp,
  onSendEmail,
  onSubmitForReview,
  sending,
  disabled,
  parentEmail,
  approvalStatus = 'pending_review',
  isSubmitted = false,
}) => {
  const { theme } = useTheme();
  
  // Disable send actions until principal approves
  const isApproved = approvalStatus === 'approved';
  const sendDisabled = !isApproved || sending || disabled;

  return (
    <View style={styles.actionsContainer}>
      {/* Approval Status Banner - Only show after submission */}
      {isSubmitted && !isApproved && (
        <View style={[styles.approvalBanner, { 
          backgroundColor: approvalStatus === 'rejected' ? theme.error + '15' : theme.warning + '15',
          borderColor: approvalStatus === 'rejected' ? theme.error : theme.warning,
        }]}>
          <Ionicons 
            name={approvalStatus === 'rejected' ? 'close-circle' : 'time'} 
            size={20} 
            color={approvalStatus === 'rejected' ? theme.error : theme.warning} 
          />
          <Text style={[styles.approvalText, { 
            color: approvalStatus === 'rejected' ? theme.error : theme.warning 
          }]}>
            {approvalStatus === 'rejected' 
              ? '❌ Report rejected by principal - cannot send'
              : '⏳ Awaiting principal approval before sending'}
          </Text>
        </View>
      )}
      
      {isSubmitted && isApproved && (
        <View style={[styles.approvalBanner, { backgroundColor: theme.success + '15', borderColor: theme.success }]}>
          <Ionicons name="checkmark-circle" size={20} color={theme.success} />
          <Text style={[styles.approvalText, { color: theme.success }]}>
            ✅ Approved by principal - ready to send
          </Text>
        </View>
      )}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButtonSmall, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={onPreview}
          disabled={sending || disabled}
        >
          {sending ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <Ionicons name="eye-outline" size={18} color={theme.primary} />
              <Text style={[styles.actionButtonTextSmall, { color: theme.text }]}>Preview</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButtonSmall, { 
            backgroundColor: sendDisabled ? theme.surface : theme.surface, 
            borderColor: theme.border,
            opacity: sendDisabled ? 0.5 : 1,
          }]}
          onPress={onExportCSV}
          disabled={sendDisabled}
        >
          {sending ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <Ionicons name="stats-chart-outline" size={18} color={sendDisabled ? theme.textSecondary : theme.primary} />
              <Text style={[styles.actionButtonTextSmall, { color: sendDisabled ? theme.textSecondary : theme.text }]}>CSV</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Submit for Review Button - Show different states based on submission */}
      {!isSubmitted && approvalStatus === 'pending_review' && onSubmitForReview && (
        <TouchableOpacity
          style={[styles.submitButton, { 
            backgroundColor: sending ? theme.surface : theme.primary,
            borderWidth: sending ? 1 : 0,
            borderColor: theme.border,
            opacity: sending ? 0.6 : 1,
          }]}
          onPress={onSubmitForReview}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={20} color="#fff" />
              <Text style={[styles.submitButtonText, { color: '#fff' }]}>
                Submit for Principal Review
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Awaiting Approval Button - Show after submission */}
      {isSubmitted && approvalStatus === 'pending_review' && (
        <TouchableOpacity
          style={[styles.submitButton, { 
            backgroundColor: theme.surface,
            borderWidth: 2,
            borderColor: theme.warning,
            opacity: 0.7,
          }]}
          disabled
        >
          <Ionicons name="time" size={20} color={theme.warning} />
          <Text style={[styles.submitButtonText, { color: theme.warning }]}>
            Awaiting Principal Approval
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.actionButton, {
          backgroundColor: sendDisabled ? theme.surface : theme.primary,
          borderWidth: sendDisabled ? 1 : 0,
          borderColor: theme.border,
          opacity: sendDisabled ? 0.5 : 1,
        }]}
        onPress={onSendPDF}
        disabled={sendDisabled}
      >
        {sending ? (
          <ActivityIndicator size="small" color={theme.onPrimary} />
        ) : (
          <>
            <Ionicons name="document-text-outline" size={20} color={theme.onPrimary} />
            <Text style={[styles.actionButtonText, { color: theme.onPrimary }]}>Save as PDF</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { 
          backgroundColor: sendDisabled ? theme.surface : '#25D366',
          borderWidth: sendDisabled ? 1 : 0,
          borderColor: theme.border,
          opacity: sendDisabled ? 0.5 : 1,
        }]}
        onPress={onSendWhatsApp}
        disabled={sendDisabled}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>WhatsApp</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { 
          backgroundColor: (sendDisabled || !parentEmail) ? theme.surface : (theme.accent || '#8B5CF6'),
          borderWidth: (sendDisabled || !parentEmail) ? 1 : 0,
          borderColor: theme.border,
          opacity: (sendDisabled || !parentEmail) ? 0.5 : 1,
        }]}
        onPress={onSendEmail}
        disabled={sendDisabled || !parentEmail}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="mail-outline" size={20} color="#fff" />
            <Text style={[styles.actionButtonText, { color: '#fff' }]}>Email</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  actionsContainer: {
    gap: 12,
    paddingTop: 16,
  },
  approvalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  approvalText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
  },
  actionButtonTextSmall: {
    fontSize: 14,
    fontWeight: '500',
  },
});
