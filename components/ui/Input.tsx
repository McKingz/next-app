/**
 * Input Component
 * 
 * Text input with consistent styling and accessibility
 */

import React from 'react';
import { View, TextInput, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

export interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  editable = true,
  multiline = false,
  numberOfLines = 1,
  style,
  inputStyle,
  testID,
  accessibilityLabel,
  accessibilityHint,
  ...props
}: InputProps) {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 10,
      backgroundColor: theme.inputBackground,
      minHeight: 44,
    },
    input: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.inputText,
    },
    inputWithLeftIcon: {
      paddingLeft: 8,
    },
    inputWithRightIcon: {
      paddingRight: 8,
    },
    multilineInput: {
      paddingTop: 12,
      paddingBottom: 12,
      textAlignVertical: 'top',
    },
    disabledInput: {
      backgroundColor: theme.surfaceVariant,
      color: theme.textDisabled,
    },
    leftIcon: {
      marginLeft: 16,
    },
    rightIcon: {
      marginRight: 16,
    },
  });
  return (
    <View style={[styles.container, style]}>
      {leftIcon && (
        <Ionicons
          name={leftIcon}
          size={20}
          color={theme.textSecondary}
          style={styles.leftIcon}
        />
      )}
      <TextInput
        style={[
          styles.input,
          leftIcon && styles.inputWithLeftIcon,
          rightIcon && styles.inputWithRightIcon,
          multiline && styles.multilineInput,
          !editable && styles.disabledInput,
          inputStyle,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.inputPlaceholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={editable}
        multiline={multiline}
        numberOfLines={numberOfLines}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        {...props}
      />
      {rightIcon && (
        <Ionicons
          name={rightIcon}
          size={20}
          color={theme.textSecondary}
          style={styles.rightIcon}
          onPress={onRightIconPress}
        />
      )}
    </View>
  );
}
