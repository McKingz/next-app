import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getCurrentLanguage, changeLanguage, getAvailableLanguages } from '@/lib/i18n';
import { track } from '@/lib/analytics';

interface LanguageModalProps {
  visible: boolean;
  onClose: () => void;
  userId?: string;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({ 
  visible, 
  onClose,
  userId 
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 20,
      width: '100%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    languageOption: {
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: theme.elevated,
    },
    activeLanguageOption: {
      backgroundColor: theme.primary + '20',
    },
    languageText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
    },
    languageSubtext: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    modalCloseButton: {
      padding: 12,
      alignItems: 'center',
    },
    modalCloseText: {
      color: theme.textSecondary,
      fontSize: 16,
    },
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{t('settings.language')}</Text>
          {getAvailableLanguages().map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageOption,
                getCurrentLanguage() === lang.code && styles.activeLanguageOption
              ]}
              onPress={async () => {
                const previousLang = getCurrentLanguage();
                await changeLanguage(lang.code);
                
                // Track language change from parent dashboard
                track('edudash.language.changed', {
                  user_id: userId,
                  from: previousLang,
                  to: lang.code,
                  source: 'parent_dashboard',
                  role: 'parent',
                });
                
                onClose();
              }}
            >
              <Text style={styles.languageText}>{lang.nativeName}</Text>
              <Text style={styles.languageSubtext}>{lang.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={onClose}
          >
            <Text style={styles.modalCloseText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
