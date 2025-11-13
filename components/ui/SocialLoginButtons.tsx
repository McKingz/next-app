// 🎨 Social Login Buttons Component
// Beautiful social authentication buttons

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface SocialProvider {
  name: string;
  title: string;
  icon: string;
  backgroundColor: string;
  textColor: string;
}

const SOCIAL_PROVIDERS: SocialProvider[] = [
  {
    name: 'google',
    title: 'Continue with Google',
    icon: 'google',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937'
  },
  {
    name: 'apple',
    title: 'Continue with Apple',
    icon: 'apple',
    backgroundColor: '#000000',
    textColor: '#FFFFFF'
  },
  {
    name: 'microsoft',
    title: 'Continue with Microsoft',
    icon: 'microsoft',
    backgroundColor: '#0078D4',
    textColor: '#FFFFFF'
  }
];

interface SocialLoginButtonsProps {
  onSocialLogin?: (provider: string) => void;
  disabled?: boolean;
  showDivider?: boolean;
}

export const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({
  onSocialLogin,
  disabled = false,
  showDivider = true,
}) => {
  const { theme } = useTheme();

  const handleSocialLogin = (provider: string) => {
    if (!disabled && onSocialLogin) {
      onSocialLogin(provider);
    }
  };

  return (
    <View style={styles.container}>
      {showDivider && (
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
          <Text style={[styles.dividerText, { color: theme.textSecondary }]}>
            or continue with
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.divider }]} />
        </View>
      )}

      <View style={styles.buttonsContainer}>
        {SOCIAL_PROVIDERS.map((provider) => (
          <TouchableOpacity
            key={provider.name}
            style={[
              styles.socialButton,
              {
                backgroundColor: provider.backgroundColor,
                borderColor: theme.divider,
                opacity: disabled ? 0.6 : 1,
              }
            ]}
            onPress={() => handleSocialLogin(provider.name)}
            disabled={disabled}
          >
            <MaterialCommunityIcons
              name={provider.icon as any}
              size={20}
              color={provider.textColor}
            />
            <Text style={[styles.socialButtonText, { color: provider.textColor }]}>
              {provider.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.disclaimer, { color: theme.textSecondary }]}>
        By continuing, you agree to our Terms of Service and Privacy Policy
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
    paddingHorizontal: 16,
    fontWeight: '500',
  },
  buttonsContainer: {
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 52,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  disclaimer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
});