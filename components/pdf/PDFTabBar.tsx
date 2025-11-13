/**
 * PDF Tab Bar Component
 * 
 * Navigation tabs for switching between PDF generation modes
 */

import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import type { PDFTab } from '@/types/pdf';

interface PDFTabBarProps {
  tabs: PDFTab[];
  activeTab: string;
  onTabChange: (tabId: 'prompt' | 'template' | 'structured') => void;
}

export function PDFTabBar({ tabs, activeTab, onTabChange }: PDFTabBarProps) {
  const { theme } = useTheme();

  const styles = useThemedStyles((theme) => ({
    container: {
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    scrollView: {
      flexGrow: 0,
    },
    tabsContainer: {
      flexDirection: 'row',
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginHorizontal: 4,
      borderRadius: 10,
      minHeight: 80,
    },
    activeTab: {
      backgroundColor: theme.primary,
    },
    inactiveTab: {
      backgroundColor: 'transparent',
    },
    tabIcon: {
      marginBottom: 8,
    },
    tabTitle: {
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
    },
    activeTitleText: {
      color: theme.onPrimary,
    },
    inactiveTitleText: {
      color: theme.text,
    },
    tabDescription: {
      fontSize: 11,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 14,
    },
    activeDescriptionText: {
      color: theme.onPrimary,
      opacity: 0.9,
    },
    inactiveDescriptionText: {
      color: theme.textSecondary,
    },
  }));

  const handleTabPress = (tabId: 'prompt' | 'template' | 'structured') => {
    if (tabId !== activeTab) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onTabChange(tabId);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tab,
                isActive ? styles.activeTab : styles.inactiveTab,
              ]}
              onPress={() => handleTabPress(tab.id as any)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.title} tab: ${tab.description}`}
            >
              <View style={styles.tabIcon}>
                <Ionicons
                  name={tab.icon as any}
                  size={24}
                  color={isActive ? theme.onPrimary : theme.text}
                />
              </View>
              
              <Text
                style={[
                  styles.tabTitle,
                  isActive ? styles.activeTitleText : styles.inactiveTitleText,
                ]}
                numberOfLines={1}
              >
                {tab.title}
              </Text>
              
              <Text
                style={[
                  styles.tabDescription,
                  isActive ? styles.activeDescriptionText : styles.inactiveDescriptionText,
                ]}
                numberOfLines={2}
              >
                {tab.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}