/**
 * Theme and Language Settings Component
 * 
 * Provides UI for switching between themes and languages
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  changeLanguage,
  getCurrentLanguage,
  getAvailableLanguages,
  getComingSoonLanguages,
  SupportedLanguage,
} from '@/lib/i18n';
import { useDashboardPreferences, DashboardLayoutType } from '@/contexts/DashboardPreferencesContext';
import { Ionicons } from '@expo/vector-icons';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch (error) {
    // New Architecture no-op; ignore
    console.debug('[ThemeLanguageSettings] LayoutAnimation not available in New Architecture');
  }
}

export function ThemeLanguageSettings() {
  const { theme, mode, setMode, isDark } = useTheme();
  const { t } = useTranslation('common');
  const { preferences, setLayout } = useDashboardPreferences();
  const currentLanguage = getCurrentLanguage();
  const availableLanguages = getAvailableLanguages();
  const comingSoonLanguages = getComingSoonLanguages();
  
  // State for collapsible sections
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);
  const [isComingSoonExpanded, setIsComingSoonExpanded] = useState(false);
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(false);

  const themeModes: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { mode: 'light', label: t('settings.theme.light'), icon: 'sunny' },
    { mode: 'dark', label: t('settings.theme.dark'), icon: 'moon' },
    { mode: 'system', label: t('settings.theme.system'), icon: 'phone-portrait' },
  ];

  const handleThemeChange = async (newMode: ThemeMode) => {
    await setMode(newMode);
  };

  const handleLanguageChange = async (language: SupportedLanguage) => {
    await changeLanguage(language);
  };

  const toggleLanguageExpansion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsLanguageExpanded(!isLanguageExpanded);
  };

  const toggleComingSoonExpansion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsComingSoonExpanded(!isComingSoonExpanded);
  };

  const toggleDashboardExpansion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsDashboardExpanded(!isDashboardExpanded);
  };

  const dashboardLayouts: { layout: DashboardLayoutType; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { 
      layout: 'classic', 
      label: t('settings.dashboard.classic'), 
      description: t('settings.dashboard.classicDesc'), 
      icon: 'grid-outline' 
    },
    { 
      layout: 'enhanced', 
      label: t('settings.dashboard.enhanced'), 
      description: t('settings.dashboard.enhancedDesc'), 
      icon: 'apps-outline' 
    },
  ];

  const handleDashboardLayoutChange = async (layout: DashboardLayoutType) => {
    setLayout(layout);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Theme Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t('settings.theme.title')}
        </Text>
        
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          {themeModes.map((item, index) => (
            <TouchableOpacity
              key={item.mode}
              style={[
                styles.themeOption,
                index < themeModes.length - 1 && [styles.borderBottom, { borderBottomColor: theme.divider }],
              ]}
              onPress={() => handleThemeChange(item.mode)}
            >
              <View style={styles.optionLeft}>
                <Ionicons
                  name={item.icon}
                  size={24}
                  color={mode === item.mode ? theme.primary : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: mode === item.mode ? theme.primary : theme.text,
                      fontWeight: mode === item.mode ? '600' : '400',
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
              {mode === item.mode && (
                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Current Theme Preview */}
        <View style={[styles.previewCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.previewTitle, { color: theme.textSecondary }]}>
            {t('settings.theme.preview')}
          </Text>
          <View style={styles.previewContent}>
            <View style={[styles.colorSample, { backgroundColor: theme.primary }]}>
              <Text style={{ color: theme.onPrimary }}>{t('settings.theme.primary')}</Text>
            </View>
            <View style={[styles.colorSample, { backgroundColor: theme.secondary }]}>
              <Text style={{ color: theme.onSecondary }}>{t('settings.theme.secondary')}</Text>
            </View>
            <View style={[styles.colorSample, { backgroundColor: theme.accent }]}>
              <Text style={{ color: theme.onAccent }}>{t('settings.theme.accent')}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Language Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={toggleLanguageExpansion}
          activeOpacity={0.7}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('settings.language.title')}
          </Text>
          <Ionicons
            name={isLanguageExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {/* Current Language Preview */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.languageOption}>
            <View style={styles.languageInfo}>
              <Text style={[styles.currentLanguageLabel, { color: theme.textSecondary }]}>
                {t('settings.language.current')}
              </Text>
              <Text style={[styles.languageName, { color: theme.primary, fontWeight: '600' }]}>
                {availableLanguages.find(lang => lang.code === currentLanguage)?.nativeName || 'English'}
              </Text>
              <Text style={[styles.languageSubtext, { color: theme.textTertiary }]}>
                {availableLanguages.find(lang => lang.code === currentLanguage)?.name || 'English'}
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
          </View>
        </View>

        {/* Available Languages (Collapsible) */}
        {isLanguageExpanded && (
          <View style={[styles.card, styles.expandedCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.expandedSectionTitle, { color: theme.textSecondary }]}>
              {t('settings.language.available')}
            </Text>
            {availableLanguages.map((lang, index) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  currentLanguage === lang.code && styles.currentLanguageOption,
                  index < availableLanguages.length - 1 && [styles.borderBottom, { borderBottomColor: theme.divider }],
                ]}
                onPress={() => handleLanguageChange(lang.code)}
                disabled={currentLanguage === lang.code}
              >
                <View style={styles.languageInfo}>
                  <Text
                    style={[
                      styles.languageName,
                      {
                        color: currentLanguage === lang.code ? theme.primary : theme.text,
                        fontWeight: currentLanguage === lang.code ? '600' : '400',
                      },
                    ]}
                  >
                    {lang.nativeName}
                  </Text>
                  <Text style={[styles.languageSubtext, { color: theme.textTertiary }]}>
                    {lang.name}
                  </Text>
                </View>
                {currentLanguage === lang.code && (
                  <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Coming Soon Languages (Collapsible) */}
        {comingSoonLanguages.length > 0 && isLanguageExpanded && (
          <>
            <TouchableOpacity
              style={styles.collapsibleSubheader}
              onPress={toggleComingSoonExpansion}
              activeOpacity={0.7}
            >
              <Text style={[styles.subsectionTitle, { color: theme.textSecondary }]}>
                {t('settings.language.comingSoon')}
              </Text>
              <Ionicons
                name={isComingSoonExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.textTertiary}
              />
            </TouchableOpacity>
            
            {isComingSoonExpanded && (
              <View style={[styles.card, styles.expandedCard, { backgroundColor: theme.surface, opacity: 0.7 }]}>
                {comingSoonLanguages.map((lang, index) => (
                  <View
                    key={lang.code}
                    style={[
                      styles.languageOption,
                      index < comingSoonLanguages.length - 1 && [styles.borderBottom, { borderBottomColor: theme.divider }],
                    ]}
                  >
                    <View style={styles.languageInfo}>
                      <Text style={[styles.languageName, { color: theme.textDisabled }]}>
                        {lang.nativeName}
                      </Text>
                      <Text style={[styles.languageSubtext, { color: theme.textDisabled }]}>
                        {lang.name}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: theme.surfaceVariant }]}>
                      <Text style={[styles.badgeText, { color: theme.textTertiary }]}>
                        {t('settings.language.soon')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      {/* Dashboard Layout Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={toggleDashboardExpansion}
          activeOpacity={0.7}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('settings.dashboard.title')}
          </Text>
          <Ionicons
            name={isDashboardExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {/* Current Dashboard Layout Preview */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.languageOption}>
            <View style={styles.languageInfo}>
              <Text style={[styles.currentLanguageLabel, { color: theme.textSecondary }]}>
                {t('settings.dashboard.current')}
              </Text>
              <Text style={[styles.languageName, { color: theme.primary, fontWeight: '600' }]}>
                {dashboardLayouts.find(l => l.layout === preferences.layout)?.label || t('settings.dashboard.classic')}
              </Text>
              <Text style={[styles.languageSubtext, { color: theme.textTertiary }]}>
                {dashboardLayouts.find(l => l.layout === preferences.layout)?.description || t('settings.dashboard.classicDesc')}
              </Text>
            </View>
            <Ionicons 
              name={dashboardLayouts.find(l => l.layout === preferences.layout)?.icon || 'grid-outline'} 
              size={24} 
              color={theme.primary} 
            />
          </View>
        </View>

        {/* Available Dashboard Layouts (Collapsible) */}
        {isDashboardExpanded && (
          <View style={[styles.card, styles.expandedCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.expandedSectionTitle, { color: theme.textSecondary }]}>
              {t('settings.dashboard.available')}
            </Text>
            {dashboardLayouts.map((layout, index) => (
              <TouchableOpacity
                key={layout.layout}
                style={[
                  styles.languageOption,
                  preferences.layout === layout.layout && styles.currentLanguageOption,
                  index < dashboardLayouts.length - 1 && [styles.borderBottom, { borderBottomColor: theme.divider }],
                ]}
                onPress={() => handleDashboardLayoutChange(layout.layout)}
                disabled={preferences.layout === layout.layout}
              >
                <View style={styles.optionLeft}>
                  <Ionicons
                    name={layout.icon}
                    size={24}
                    color={preferences.layout === layout.layout ? theme.primary : theme.textSecondary}
                  />
                  <View style={styles.languageInfo}>
                    <Text
                      style={[
                        styles.languageName,
                        {
                          color: preferences.layout === layout.layout ? theme.primary : theme.text,
                          fontWeight: preferences.layout === layout.layout ? '600' : '400',
                        },
                      ]}
                    >
                      {layout.label}
                    </Text>
                    <Text style={[styles.languageSubtext, { color: theme.textTertiary }]}>
                      {layout.description}
                    </Text>
                  </View>
                </View>
                {preferences.layout === layout.layout && (
                  <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Additional Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t('settings.preferences.title')}
        </Text>
        
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceInfo}>
              <Text style={[styles.preferenceName, { color: theme.text }]}>
                {t('settings.preferences.autoTheme')}
              </Text>
              <Text style={[styles.preferenceDescription, { color: theme.textSecondary }]}>
                {t('settings.preferences.autoThemeDesc')}
              </Text>
            </View>
            <Switch
              value={mode === 'system'}
              onValueChange={(value) => handleThemeChange(value ? 'system' : (isDark ? 'dark' : 'light'))}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={mode === 'system' ? theme.onPrimary : theme.textTertiary}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 16,
  },
  borderBottom: {
    borderBottomWidth: 1,
  },
  previewCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  previewTitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  previewContent: {
    flexDirection: 'row',
    gap: 8,
  },
  colorSample: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    marginBottom: 4,
  },
  languageSubtext: {
    fontSize: 14,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  preferenceName: {
    fontSize: 16,
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 14,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  collapsibleSubheader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingTop: 16,
  },
  expandedCard: {
    marginTop: 8,
  },
  expandedSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    padding: 16,
    paddingBottom: 8,
  },
  currentLanguageLabel: {
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentLanguageOption: {
    opacity: 0.6,
  },
});
