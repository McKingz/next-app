/**
 * Theme Demo Screen
 * 
 * Demonstrates the theme and language switching capabilities
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { RoleBasedHeader } from '@/components/RoleBasedHeader';
import { ThemeLanguageSettings } from '@/components/settings/ThemeLanguageSettings';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { ThemedModal } from '@/components/ui/ThemedModal';
import { useSimplePullToRefresh } from '@/hooks/usePullToRefresh';

export default function ThemeDemoScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation(); // Translation function
  const [modalVisible, setModalVisible] = useState(false);

  // Refresh function for theme data (mock functionality)
  const handleRefresh = async () => {
    // In a real app, this might refresh theme/language settings from server
    await new Promise(resolve => setTimeout(resolve, 500));
  };

  const { refreshing, onRefreshHandler } = useSimplePullToRefresh(handleRefresh, 'theme_demo');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <RoleBasedHeader title={t("Theme & Language Demo")} />
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefreshHandler}
            tintColor={theme.primary}
            title="Refreshing theme data..."
          />
        }
      >
        {/* Theme and Language Settings */}
        <ThemeLanguageSettings />
        
        {/* Button Showcase */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Button Components
          </Text>
          
          <View style={styles.buttonRow}>
            <ThemedButton
              title="Primary"
              variant="primary"
              onPress={() => setModalVisible(true)}
            />
            <ThemedButton
              title="Secondary"
              variant="secondary"
              onPress={() => {}}
            />
            <ThemedButton
              title="Success"
              variant="success"
              onPress={() => {}}
            />
          </View>
          
          <View style={styles.buttonRow}>
            <ThemedButton
              title="Danger"
              variant="danger"
              onPress={() => {}}
            />
            <ThemedButton
              title="Warning"
              variant="warning"
              onPress={() => {}}
            />
            <ThemedButton
              title="Ghost"
              variant="ghost"
              onPress={() => {}}
            />
          </View>
          
          <View style={styles.buttonRow}>
            <ThemedButton
              title="Small"
              size="small"
              onPress={() => {}}
            />
            <ThemedButton
              title="Medium"
              size="medium"
              onPress={() => {}}
            />
            <ThemedButton
              title="Large"
              size="large"
              onPress={() => {}}
            />
          </View>
          
          <View style={styles.buttonRow}>
            <ThemedButton
              title="Loading"
              loading
              onPress={() => {}}
            />
            <ThemedButton
              title="Disabled"
              disabled
              onPress={() => {}}
            />
          </View>
        </View>
        
        {/* Color Palette */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Color Palette
          </Text>
          
          <View style={styles.colorGrid}>
            <ColorSwatch color={theme.primary} label="Primary" textColor={theme.onPrimary} />
            <ColorSwatch color={theme.secondary} label="Secondary" textColor={theme.onSecondary} />
            <ColorSwatch color={theme.accent} label="Accent" textColor={theme.onAccent} />
            <ColorSwatch color={theme.success} label="Success" textColor={theme.onSuccess} />
            <ColorSwatch color={theme.warning} label="Warning" textColor={theme.onWarning} />
            <ColorSwatch color={theme.error} label="Error" textColor={theme.onError} />
            <ColorSwatch color={theme.info} label="Info" textColor={theme.onInfo} />
            <ColorSwatch color={theme.background} label="Background" textColor={theme.text} border />
            <ColorSwatch color={theme.surface} label="Surface" textColor={theme.text} border />
            <ColorSwatch color={theme.surfaceVariant} label="Surface Variant" textColor={theme.text} />
          </View>
        </View>
        
        {/* Text Hierarchy */}
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Text Hierarchy
          </Text>
          
          <Text style={[styles.heading1, { color: theme.text }]}>Heading 1</Text>
          <Text style={[styles.heading2, { color: theme.text }]}>Heading 2</Text>
          <Text style={[styles.heading3, { color: theme.text }]}>Heading 3</Text>
          <Text style={[styles.body, { color: theme.text }]}>Body text</Text>
          <Text style={[styles.caption, { color: theme.textSecondary }]}>Secondary text</Text>
          <Text style={[styles.caption, { color: theme.textTertiary }]}>Tertiary text</Text>
          <Text style={[styles.caption, { color: theme.textDisabled }]}>Disabled text</Text>
        </View>
      </ScrollView>
      
      {/* Demo Modal */}
      <ThemedModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Demo Modal"
        actions={[
          {
            text: 'Cancel',
            variant: 'ghost',
            onPress: () => setModalVisible(false),
          },
          {
            text: 'Confirm',
            variant: 'primary',
            onPress: () => setModalVisible(false),
          },
        ]}
      >
        <Text style={[styles.modalText, { color: theme.text }]}>
          This is a themed modal component. It automatically adapts to the current theme.
        </Text>
        <Text style={[styles.modalText, { color: theme.textSecondary, marginTop: 8 }]}>
          Notice how all colors, including the overlay and borders, change with the theme.
        </Text>
      </ThemedModal>
    </View>
  );
}

// Color swatch component
function ColorSwatch({ 
  color, 
  label, 
  textColor,
  border = false 
}: { 
  color: string; 
  label: string; 
  textColor: string;
  border?: boolean;
}) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.colorSwatch}>
      <View 
        style={[
          styles.colorBox, 
          { 
            backgroundColor: color,
            borderWidth: border ? 1 : 0,
            borderColor: theme.border,
          }
        ]} 
      >
        <Text style={[styles.colorLabel, { color: textColor }]}>{label}</Text>
      </View>
      <Text style={[styles.colorHex, { color: theme.textTertiary }]}>{color}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorSwatch: {
    width: '30%',
    alignItems: 'center',
  },
  colorBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  colorHex: {
    fontSize: 10,
  },
  heading1: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  heading2: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  heading3: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    marginBottom: 8,
  },
  caption: {
    fontSize: 14,
    marginBottom: 4,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
  },
});
