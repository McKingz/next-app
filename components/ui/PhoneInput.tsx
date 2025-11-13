import React, { useState } from 'react';
import { 
  TextInput, 
  TextInputProps, 
  View, 
  Text, 
  StyleSheet,
  ViewStyle,
  TextStyle
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  formatAsUserTypes, 
  validatePhoneNumber, 
  convertToE164, 
  EXAMPLE_PHONE_NUMBERS 
} from '../../lib/utils/phoneUtils';

interface PhoneInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string, e164?: string) => void;
  onValidationChange?: (isValid: boolean, e164?: string) => void;
  label?: string;
  error?: string;
  showValidation?: boolean;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
  returnE164?: boolean; // If true, onChangeText returns E.164 format
}

/**
 * PhoneInput component with automatic formatting and E.164 conversion
 * Specifically designed for South African mobile numbers
 */
export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChangeText,
  onValidationChange,
  label,
  error,
  showValidation = true,
  containerStyle,
  labelStyle,
  errorStyle,
  returnE164 = false,
  placeholder = EXAMPLE_PHONE_NUMBERS.local,
  ...textInputProps
}) => {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  
  // Validation state
  const validation = validatePhoneNumber(value);
  const e164Result = convertToE164(value);
  const displayError = error || (showValidation && !validation.isValid && value.length > 0 ? validation.message : '');

  const handleTextChange = (text: string) => {
    const formatted = formatAsUserTypes(text);
    const newValidation = validatePhoneNumber(formatted);
    const newE164Result = convertToE164(formatted);
    
    if (returnE164 && newE164Result.isValid && newE164Result.e164) {
      onChangeText(newE164Result.e164, newE164Result.e164);
    } else {
      onChangeText(formatted, newE164Result.e164);
    }
    
    // Notify parent of validation changes
    onValidationChange?.(newValidation.isValid, newE164Result.e164);
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 8,
    },
    inputContainer: {
      position: 'relative',
    },
    input: {
      borderWidth: 1,
      borderColor: displayError ? '#FF6B6B' : (isFocused ? theme.primary : theme.border),
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: theme.text,
      backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
    },
    inputFocused: {
      borderWidth: 2,
    },
    validationContainer: {
      marginTop: 4,
      minHeight: 16,
    },
    error: {
      fontSize: 12,
      color: '#FF6B6B',
      marginTop: 4,
    },
    success: {
      fontSize: 12,
      color: '#51CF66',
      marginTop: 4,
    },
    hint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>{label}</Text>
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          {...textInputProps}
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            textInputProps.style,
          ]}
          value={returnE164 ? (e164Result.formatted || value) : value}
          onChangeText={handleTextChange}
          onFocus={(e) => {
            setIsFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            textInputProps.onBlur?.(e);
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={13} // Allow for formatted input
        />
      </View>

      {showValidation && (
        <View style={styles.validationContainer}>
          {displayError ? (
            <Text style={[styles.error, errorStyle]}>{displayError}</Text>
          ) : validation.isValid && value.length > 0 ? (
            <Text style={styles.success}>
              ✓ {e164Result.formatted || value}
            </Text>
          ) : value.length === 0 ? (
            <Text style={styles.hint}>
              Format: {EXAMPLE_PHONE_NUMBERS.local}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
};

export default PhoneInput;