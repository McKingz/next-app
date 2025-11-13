/**
 * SignatureDisplay Component
 * 
 * Displays a captured signature with signer name and timestamp
 * Used in report previews and principal review screens
 * 
 * References:
 * - React Native 0.79: https://reactnative.dev/docs/0.79/image
 * - date-fns v4: https://date-fns.org/docs/Getting-Started
 */

import { View, Text, Image, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { enZA } from 'date-fns/locale';
import { useTheme } from '@/contexts/ThemeContext';

export interface SignatureDisplayProps {
  /** Base64 PNG signature data (without data URI prefix) */
  signatureData: string;
  
  /** Name of person who signed */
  signerName: string;
  
  /** Role of signer */
  signerRole: 'teacher' | 'principal';
  
  /** ISO timestamp when signed */
  signedAt: string;
  
  /** Optional height override (default: 80) */
  height?: number;
}

/**
 * SignatureDisplay - Shows signature with metadata
 * 
 * Features:
 * - Displays base64 PNG signature
 * - Shows signer name and role
 * - Formats timestamp with South African locale (DD/MM/YYYY HH:mm)
 * - Dark mode support
 * 
 * @example
 * ```tsx
 * <SignatureDisplay
 *   signatureData={report.teacher_signature_data}
 *   signerName="Jane Smith"
 *   signerRole="teacher"
 *   signedAt={report.teacher_signed_at}
 * />
 * ```
 */
export const SignatureDisplay = ({
  signatureData,
  signerName,
  signerRole,
  signedAt,
  height = 80,
}: SignatureDisplayProps) => {
  const { theme, colorScheme } = useTheme();

  // Format timestamp with South African locale
  const formattedDate = format(new Date(signedAt), 'dd/MM/yyyy HH:mm', { locale: enZA });
  
  const roleLabel = signerRole === 'teacher' ? 'Teacher' : 'Principal';

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {roleLabel} Signature
      </Text>
      
      {/* Signature Image Container */}
      <View
        style={[
          styles.signatureBox,
          {
            borderColor: theme.colors.border,
            backgroundColor: '#FFFFFF', // Always white background for signature visibility
            height,
          },
        ]}
      >
        <Image
          source={{ uri: `data:image/png;base64,${signatureData}` }}
          style={styles.signatureImage}
          resizeMode="contain"
        />
      </View>
      
      {/* Metadata */}
      <View style={styles.metadata}>
        <Text style={[styles.signerName, { color: theme.colors.text }]}>
          {signerName}
        </Text>
        <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
          Signed on {formattedDate}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  signatureBox: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 8,
  },
  signatureImage: {
    width: '100%',
    height: '100%',
  },
  metadata: {
    marginTop: 8,
  },
  signerName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
  },
});

/**
 * Documentation Sources:
 * - React Native 0.79 Image: https://reactnative.dev/docs/0.79/image
 * - date-fns v4 format: https://date-fns.org/v4.1.0/docs/format
 * - date-fns enZA locale: https://date-fns.org/v4.1.0/docs/I18n
 */
