import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface SearchInputProps extends TextInputProps {
  onClear?: () => void;
  showClearButton?: boolean;
  containerStyle?: any;
}

/**
 * SearchInput - Reusable search input component
 * 
 * Features:
 * - Search icon on the RIGHT side (design requirement)
 * - Optional clear button
 * - Theme-aware styling
 * - Accessible and optimized for mobile
 * 
 * Usage:
 * <SearchInput
 *   value={searchQuery}
 *   onChangeText={setSearchQuery}
 *   placeholder="Search students..."
 *   showClearButton
 *   onClear={() => setSearchQuery('')}
 * />
 */
export function SearchInput({ 
  onClear, 
  showClearButton = true,
  containerStyle,
  value,
  ...props 
}: SearchInputProps) {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 50,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      paddingRight: 12,
    },
    iconContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    clearButton: {
      padding: 4,
    },
  });

  const hasValue = value && value.toString().length > 0;

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        style={styles.input}
        placeholderTextColor={theme.textTertiary}
        value={value}
        {...props}
      />
      <View style={styles.iconContainer}>
        {showClearButton && hasValue && onClear && (
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={onClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
        <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
      </View>
    </View>
  );
}
