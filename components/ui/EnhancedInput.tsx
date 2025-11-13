// 🎨 Enhanced Input Component
// Beautiful form input with validation states and theming

import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface EnhancedInputProps extends TextInputProps {
  label?: string;
  error?: string;
  touched?: boolean;
  icon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  showError?: boolean;
}

export const EnhancedInput: React.FC<EnhancedInputProps> = ({
  label,
  error,
  touched,
  icon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  showError = true,
  ...textInputProps
}) => {
  const { theme } = useTheme();
  
  const hasError = touched && error;

  return (
    <View style={[
      {
        marginBottom: showError ? 20 : 12,
      },
      containerStyle
    ]}>
      {label && (
        <Text style={{
          fontSize: 14,
          fontWeight: '600',
          color: theme.text,
          marginBottom: 8,
        }}>
          {label}
        </Text>
      )}
      
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.inputBackground,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: hasError ? theme.error : theme.inputBorder,
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 52,
      }}>
        {icon && (
          <View style={{
            marginRight: 12,
          }}>
            <MaterialCommunityIcons
              name={icon as any}
              size={20}
              color={hasError ? theme.error : theme.inputPlaceholder}
            />
          </View>
        )}
        
        <TextInput
          style={[
            {
              flex: 1,
              fontSize: 16,
              color: theme.inputText,
              fontFamily: 'System',
            },
            inputStyle
          ]}
          placeholderTextColor={theme.inputPlaceholder}
          {...textInputProps}
        />
        
        {rightIcon && (
          <TouchableOpacity
            style={{
              marginLeft: 12,
              padding: 4,
            }}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            <MaterialCommunityIcons
              name={rightIcon as any}
              size={20}
              color={theme.inputPlaceholder}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {showError && hasError && (
        <Text style={{
          fontSize: 12,
          color: theme.error,
          marginTop: 6,
          marginLeft: 4,
        }}>
          {error}
        </Text>
      )}
    </View>
  );
};

// No static styles needed - using dynamic inline styles with theme
