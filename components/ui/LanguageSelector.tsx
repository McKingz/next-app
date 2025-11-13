/**
 * Language Selector Component with Coming Soon Support
 * 
 * Shows available languages and coming soon languages with appropriate badges
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getAvailableLanguages, getComingSoonLanguages, changeLanguage, getCurrentLanguage, SupportedLanguage } from '@/lib/i18n';
import { Colors } from '@/constants/Colors';
import { useTranslation } from 'react-i18next';

interface LanguageSelectorProps {
  onLanguageSelect?: (language: SupportedLanguage) => void;
  showComingSoon?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  onLanguageSelect,
  showComingSoon = true,
}) => {
  const { t } = useTranslation();
  const currentLanguage = getCurrentLanguage();
  const availableLanguages = getAvailableLanguages();
  const comingSoonLanguages = getComingSoonLanguages();

  const handleLanguagePress = async (languageCode: SupportedLanguage) => {
    try {
      await changeLanguage(languageCode);
      onLanguageSelect?.(languageCode);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  const renderLanguageItem = (
    language: { code: string; name: string; nativeName: string; comingSoon?: boolean },
    isActive: boolean = false
  ) => (
    <TouchableOpacity
      key={language.code}
      style={[
        styles.languageItem,
        isActive && styles.activeLanguageItem,
        language.comingSoon && styles.comingSoonLanguageItem,
      ]}
      onPress={() => !language.comingSoon && handleLanguagePress(language.code as SupportedLanguage)}
      disabled={language.comingSoon}
    >
      <View style={styles.languageContent}>
        <Text style={[styles.languageName, isActive && styles.activeLanguageName]}>
          {language.name}
        </Text>
        <Text style={[styles.nativeName, isActive && styles.activeNativeName]}>
          {language.nativeName}
        </Text>
      </View>
      
      {language.comingSoon && (
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>{t('settings.language.comingSoon', { defaultValue: 'Coming Soon' })}</Text>
        </View>
      )}
      
      {isActive && !language.comingSoon && (
        <View style={styles.activeBadge}>
          <Text style={styles.activeText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('settings.language.available', { defaultValue: 'Available Languages' })}</Text>
      {availableLanguages.map((language) =>
        renderLanguageItem(language, language.code === currentLanguage)
      )}

      {showComingSoon && comingSoonLanguages.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('settings.language.comingSoon', { defaultValue: 'Coming Soon' })}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('settings.language.sa_blurb', { defaultValue: "We're working on adding support for all 11 official South African languages" })}
          </Text>
          {comingSoonLanguages.map((language) => renderLanguageItem(language))}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginVertical: 4,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.tabIconDefault,
  },
  activeLanguageItem: {
    borderColor: Colors.light.tint,
    backgroundColor: Colors.light.tint + '10',
  },
  comingSoonLanguageItem: {
    opacity: 0.6,
    backgroundColor: '#f5f5f5',
    borderStyle: 'dashed',
  },
  languageContent: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  activeLanguageName: {
    color: Colors.light.tint,
  },
  nativeName: {
    fontSize: 14,
    color: Colors.light.tabIconDefault,
  },
  activeNativeName: {
    color: Colors.light.tint,
  },
  comingSoonBadge: {
    backgroundColor: '#FFA500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  activeBadge: {
    backgroundColor: Colors.light.tint,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LanguageSelector;
